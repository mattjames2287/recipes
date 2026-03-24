const STORAGE_KEY = "recipe-book-local-v1";
const STARTER_DATA_PATH = "data/recipes.json";
const CLOUD_ENDPOINT = ""; // Paste your Apps Script web app URL here
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80";
const CATEGORY_OPTIONS = ["Breakfast", "Lunch", "Dinner", "Dessert", "Snacks", "Drinks"];
const TAG_SUGGESTIONS = ["All", "Quick", "Family Favorite", "Holiday", "Crock Pot", "Dessert", "Dinner", "Breakfast"];

const recipeCard = document.getElementById("recipeCard");
const recipeImage = document.getElementById("recipeImage");
const recipeCategory = document.getElementById("recipeCategory");
const recipeTitle = document.getElementById("recipeTitle");
const recipeDescription = document.getElementById("recipeDescription");
const ingredientsList = document.getElementById("ingredientsList");
const stepsList = document.getElementById("stepsList");
const notesBox = document.getElementById("notesBox");
const recipeNotes = document.getElementById("recipeNotes");
const recipeCount = document.getElementById("recipeCount");
const counterText = document.getElementById("counterText");
const categoryRow = document.getElementById("categoryRow");
const tagRow = document.getElementById("tagRow");
const recipeTagChips = document.getElementById("recipeTagChips");
const cloudStatus = document.getElementById("cloudStatus");
const searchInput = document.getElementById("searchInput");

const recipeFront = document.querySelector(".recipe-front");
const recipeBack = document.querySelector(".recipe-back");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const flipBtn = document.getElementById("flipBtn");
const openFormBtn = document.getElementById("openFormBtn");
const closeFormBtn = document.getElementById("closeFormBtn");
const cancelBtn = document.getElementById("cancelBtn");
const recipeModal = document.getElementById("recipeModal");
const recipeForm = document.getElementById("recipeForm");
const formCategoryPills = document.getElementById("formCategoryPills");
const categoryInput = document.getElementById("category");
const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("photoPreview");
const ocrStatus = document.getElementById("ocrStatus");

const titleInput = document.getElementById("title");
const descriptionInput = document.getElementById("description");
const tagsInput = document.getElementById("tags");
const imageInput = document.getElementById("image");
const ingredientsInput = document.getElementById("ingredients");
const stepsInput = document.getElementById("steps");
const notesInput = document.getElementById("notes");

let starterRecipes = [];
let userRecipes = loadLocalRecipes();
let activeCategory = "All";
let activeTag = "All";
let currentIndex = 0;
let searchTerm = "";
let ocrWorker = null;
let ocrInProgress = false;

function isMobileView() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function syncFlipDisplay() {
  if (!recipeFront || !recipeBack) return;
  const flipped = recipeCard.classList.contains("flipped");
  if (isMobileView()) {
    recipeFront.style.display = flipped ? "none" : "flex";
    recipeBack.style.display = flipped ? "flex" : "none";
  } else {
    recipeFront.style.display = "";
    recipeBack.style.display = "";
  }
}

function cloudEnabled() {
  return !!String(CLOUD_ENDPOINT || "").trim();
}

function setCloudStatus(message) {
  cloudStatus.textContent = message;
}

function setOcrStatus(message, state = "") {
  if (!ocrStatus) return;
  ocrStatus.textContent = message || "";
  ocrStatus.classList.remove("is-busy", "is-error");
  if (state === "busy") ocrStatus.classList.add("is-busy");
  if (state === "error") ocrStatus.classList.add("is-error");
}

function loadLocalRecipes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeRecipe) : [];
  } catch (error) {
    console.warn("Could not load local recipes", error);
    return [];
  }
}

function saveLocalRecipes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userRecipes));
}

function ensureArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function parseTags(value) {
  if (Array.isArray(value)) return value.map(tag => String(tag).trim()).filter(Boolean);
  return String(value || "")
    .split(/[\n,]/)
    .map(tag => tag.trim())
    .filter(Boolean);
}

function normalizeRecipe(recipe) {
  const category = String(recipe.category || "Dinner").trim();
  return {
    title: String(recipe.title || "Untitled Recipe").trim(),
    category: CATEGORY_OPTIONS.includes(category) ? category : "Dinner",
    image: String(recipe.image || "").trim(),
    description: String(recipe.description || "").trim(),
    ingredients: ensureArray(recipe.ingredients),
    steps: ensureArray(recipe.steps),
    notes: String(recipe.notes || "").trim(),
    tags: parseTags(recipe.tags),
    createdAt: String(recipe.createdAt || "").trim()
  };
}

function allRecipes() {
  const seen = new Set();
  return [...userRecipes, ...starterRecipes].map(normalizeRecipe).filter((recipe) => {
    const key = recipe.title.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchesSearch(recipe) {
  if (!searchTerm) return true;
  const haystack = [
    recipe.title,
    recipe.category,
    recipe.description,
    recipe.notes,
    ...(recipe.ingredients || []),
    ...(recipe.steps || []),
    ...(recipe.tags || [])
  ].join(" ").toLowerCase();
  return haystack.includes(searchTerm);
}

function filteredRecipes() {
  return allRecipes().filter((recipe) => {
    const categoryMatch = activeCategory === "All" || recipe.category === activeCategory;
    const tagMatch = activeTag === "All" || (recipe.tags || []).includes(activeTag);
    return categoryMatch && tagMatch && matchesSearch(recipe);
  });
}

function renderList(items, target) {
  target.innerHTML = "";
  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    fragment.appendChild(li);
  });
  target.appendChild(fragment);
}

function renderPills(container, values, activeValue, onClick) {
  container.innerHTML = "";
  values.forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${value === activeValue ? " active" : ""}`;
    button.textContent = value;
    button.addEventListener("click", () => onClick(value));
    container.appendChild(button);
  });
}

function renderCategories() {
  renderPills(categoryRow, ["All", ...CATEGORY_OPTIONS], activeCategory, (value) => {
    activeCategory = value;
    currentIndex = 0;
    recipeCard.classList.remove("flipped");
    renderCategories();
    renderRecipe();
  });
}

function renderTags() {
  const dynamic = new Set(TAG_SUGGESTIONS);
  allRecipes().forEach(recipe => (recipe.tags || []).forEach(tag => dynamic.add(tag)));
  renderPills(tagRow, Array.from(dynamic), activeTag, (value) => {
    activeTag = value;
    currentIndex = 0;
    recipeCard.classList.remove("flipped");
    renderTags();
    renderRecipe();
  });
}

function renderRecipeTags(tags) {
  recipeTagChips.innerHTML = "";
  (tags || []).forEach((tag) => {
    const pill = document.createElement("div");
    pill.className = "meta-pill";
    pill.textContent = tag;
    recipeTagChips.appendChild(pill);
  });
}

function renderFormCategoryPills() {
  formCategoryPills.innerHTML = "";
  CATEGORY_OPTIONS.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `pill-btn${categoryInput.value === category ? " active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      categoryInput.value = category;
      renderFormCategoryPills();
    });
    formCategoryPills.appendChild(button);
  });
}

function renderRecipe() {
  const recipes = filteredRecipes();
  if (!recipes.length) {
    recipeImage.src = FALLBACK_IMAGE;
    recipeImage.alt = "No recipe available";
    recipeCategory.textContent = activeCategory === "All" ? "Recipe" : activeCategory;
    recipeTitle.textContent = "No recipes match right now";
    recipeDescription.textContent = "Try clearing a filter, changing the tag, or adding a new recipe.";
    ingredientsList.innerHTML = "";
    stepsList.innerHTML = "";
    recipeTagChips.innerHTML = "";
    notesBox.classList.add("hidden");
    recipeCount.textContent = "0 / 0";
    counterText.textContent = "No recipes found";
    syncFlipDisplay();
    return;
  }

  if (currentIndex >= recipes.length) currentIndex = 0;
  if (currentIndex < 0) currentIndex = recipes.length - 1;

  const recipe = recipes[currentIndex];
  recipeImage.src = recipe.image || FALLBACK_IMAGE;
  recipeImage.alt = recipe.title || "Recipe image";
  recipeCategory.textContent = recipe.category || "Recipe";
  recipeTitle.textContent = recipe.title || "Untitled Recipe";
  recipeDescription.textContent = recipe.description || "";
  renderRecipeTags(recipe.tags || []);
  if (recipe.notes) {
    notesBox.classList.remove("hidden");
    recipeNotes.textContent = recipe.notes;
  } else {
    notesBox.classList.add("hidden");
    recipeNotes.textContent = "";
  }
  recipeCount.textContent = `${currentIndex + 1} / ${recipes.length}`;
  counterText.textContent = `${recipes.length} recipe${recipes.length === 1 ? "" : "s"} shown`;

  renderList(recipe.ingredients || [], ingredientsList);
  renderList(recipe.steps || [], stepsList);
  syncFlipDisplay();
}

function openModal() {
  recipeModal.classList.add("show");
  recipeModal.setAttribute("aria-hidden", "false");
  renderFormCategoryPills();
}

function closeModal() {
  recipeModal.classList.remove("show");
  recipeModal.setAttribute("aria-hidden", "true");
  recipeForm.reset();
  categoryInput.value = "Dinner";
  renderFormCategoryPills();
  photoPreview.classList.add("hidden");
  photoPreview.removeAttribute("src");
  setOcrStatus("");
}

function parseLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function fileToDataUrl(file) {
  if (!file) return "";
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadStarterRecipes() {
  if (cloudEnabled()) {
    try {
      const response = await fetch(`${CLOUD_ENDPOINT}?action=list`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      starterRecipes = Array.isArray(data.recipes) ? data.recipes.map(normalizeRecipe) : [];
      setCloudStatus("Cloud sync is live. Recipes save to the shared sheet for both phones.");
      renderCategories();
      renderTags();
      renderRecipe();
      return;
    } catch (error) {
      console.warn("Cloud recipe load failed, falling back to local JSON.", error);
      setCloudStatus("Cloud URL is set, but loading failed. Using built-in recipes right now.");
    }
  } else {
    setCloudStatus("Cloud sync is off until you paste your Apps Script web app URL into app.js.");
  }

  try {
    const response = await fetch(STARTER_DATA_PATH, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    starterRecipes = Array.isArray(data) ? data.map(normalizeRecipe) : [];
  } catch (error) {
    console.warn("Could not load starter recipe JSON", error);
    starterRecipes = [];
  }
  renderCategories();
  renderTags();
  renderRecipe();
}

function showPrevRecipe() {
  currentIndex -= 1;
  recipeCard.classList.remove("flipped");
  syncFlipDisplay();
  renderRecipe();
}

function showNextRecipe() {
  currentIndex += 1;
  recipeCard.classList.remove("flipped");
  syncFlipDisplay();
  renderRecipe();
}

function toggleFlip() {
  recipeCard.classList.toggle("flipped");
  syncFlipDisplay();
}

async function saveRecipe(recipe, imageData) {
  if (cloudEnabled()) {
    const payload = { action: "add", recipe };
    if (imageData) {
      payload.imageDataUrl = imageData;
    }
    const response = await fetch(CLOUD_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Cloud save failed");
    if (data.recipe) {
      starterRecipes.unshift(normalizeRecipe(data.recipe));
    } else {
      starterRecipes.unshift(recipe);
    }
    return;
  }

  userRecipes.unshift(recipe);
  saveLocalRecipes();
}

function normalizeOcrText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[•●▪■]/g, "- ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toTitleCase(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function detectTitle(lines) {
  if (!lines.length) return "";

  for (const line of lines.slice(0, 6)) {
    const lower = line.toLowerCase();
    if (/(ingredients?|directions?|instructions?|method|prep time|cook time|servings?)/.test(lower)) {
      continue;
    }
    if (line.length >= 3 && line.length <= 70) return toTitleCase(line);
  }

  return toTitleCase(lines[0]);
}

function looksLikeIngredient(line) {
  return /^(\d+\/\d+|\d+\.\d+|\d+|¼|½|¾|⅓|⅔|1\/2|1\/4|3\/4)/.test(line)
    || /\b(cup|cups|tsp|tbsp|teaspoon|teaspoons|tablespoon|tablespoons|oz|ounce|ounces|lb|lbs|pound|pounds|clove|cloves|can|cans|package|packages|pkg)\b/i.test(line);
}

function looksLikeStep(line) {
  return /^step\s*\d+/i.test(line)
    || /^\d+[.)]/.test(line)
    || /\b(bake|mix|stir|combine|whisk|cook|preheat|simmer|serve|add|pour|fold|boil|saute|sauté|broil|grill|spread|layer|drain)\b/i.test(line);
}

function cleanupIngredients(lines) {
  return lines
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function cleanupDirections(lines) {
  const cleaned = lines.map((line) => line.trim()).filter(Boolean);
  if (cleaned.some((line) => /^\d+[.)]/.test(line))) {
    return cleaned.map((line) => line.replace(/^(\d+)\)/, "$1."));
  }
  return cleaned.map((line, index) => `${index + 1}. ${line.replace(/^\d+\s*/, "")}`);
}

function splitIngredientsAndDirections(lines) {
  let ingredientStart = -1;
  let directionStart = -1;

  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    if (ingredientStart === -1 && /ingredients?/.test(lower)) ingredientStart = index;
    if (directionStart === -1 && /(directions?|instructions?|method)/.test(lower)) directionStart = index;
  });

  let ingredients = [];
  let directions = [];

  if (ingredientStart !== -1 && directionStart !== -1) {
    ingredients = lines.slice(ingredientStart + 1, directionStart);
    directions = lines.slice(directionStart + 1);
  } else if (directionStart !== -1) {
    ingredients = lines.slice(1, directionStart);
    directions = lines.slice(directionStart + 1);
  } else {
    const ingredientLike = [];
    const directionLike = [];
    let reachedDirections = false;

    for (const line of lines.slice(1)) {
      if (looksLikeStep(line)) reachedDirections = true;
      if (!reachedDirections && looksLikeIngredient(line)) ingredientLike.push(line);
      else directionLike.push(line);
    }

    ingredients = ingredientLike;
    directions = directionLike;
  }

  return {
    ingredients: cleanupIngredients(ingredients),
    directions: cleanupDirections(directions),
    leftover: lines
  };
}

function suggestCategory(title, ingredients, directions) {
  const haystack = `${title}\n${ingredients.join(" ")}\n${directions.join(" ")}`.toLowerCase();

  if (/\b(pancake|waffle|omelet|omelette|oatmeal|breakfast|french toast|muffin|banana bread|coffee cake)\b/.test(haystack)) return "Breakfast";
  if (/\b(cookie|cake|brownie|dessert|pie|frosting|cobbler|cupcake|pudding)\b/.test(haystack)) return "Dessert";
  if (/\b(lemonade|smoothie|tea|latte|coffee|punch|drink|cocktail|mocktail)\b/.test(haystack)) return "Drinks";
  if (/\b(chips|dip|snack|popcorn|trail mix|nacho|granola bar)\b/.test(haystack)) return "Snacks";
  if (/\b(sandwich|wrap|salad|lunch)\b/.test(haystack)) return "Lunch";
  return "Dinner";
}

function suggestTags(title, ingredients, directions, rawText) {
  const haystack = `${title}\n${ingredients.join(" ")}\n${directions.join(" ")}\n${rawText}`.toLowerCase();
  const tags = [];

  if (/\b(15 minute|20 minute|30 minute|quick|fast|easy)\b/.test(haystack)) tags.push("Quick");
  if (/\b(family|kid|kids|crowd)\b/.test(haystack)) tags.push("Family Favorite");
  if (/\b(holiday|thanksgiving|christmas|easter)\b/.test(haystack)) tags.push("Holiday");
  if (/\b(crock pot|crockpot|slow cooker)\b/.test(haystack)) tags.push("Crock Pot");

  const categoryTag = suggestCategory(title, ingredients, directions);
  if (categoryTag) tags.push(categoryTag);

  return [...new Set(tags)];
}

function parseRecipeText(rawText) {
  const text = normalizeOcrText(rawText);
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const title = detectTitle(lines);
  const parts = splitIngredientsAndDirections(lines);
  const category = suggestCategory(title, parts.ingredients, parts.directions);
  const tags = suggestTags(title, parts.ingredients, parts.directions, text);

  const descParts = [];
  if (parts.ingredients.length) descParts.push(`${parts.ingredients.length} ingredient${parts.ingredients.length === 1 ? "" : "s"}`);
  if (parts.directions.length) descParts.push(`${parts.directions.length} step${parts.directions.length === 1 ? "" : "s"}`);

  return {
    title,
    category,
    tags,
    description: descParts.length ? `Imported from image • ${descParts.join(" • ")}` : "Imported from image",
    ingredients: parts.ingredients,
    steps: parts.directions,
    rawText: text
  };
}

function mergeTags(currentValue, newTags) {
  return [...new Set([...parseTags(currentValue), ...parseTags(newTags)])].join(", ");
}

function applyParsedRecipeToForm(parsed) {
  if (!parsed) return;

  titleInput.value = parsed.title || titleInput.value;
  descriptionInput.value = parsed.description || descriptionInput.value;
  if (parsed.ingredients && parsed.ingredients.length) ingredientsInput.value = parsed.ingredients.join("\n");
  if (parsed.steps && parsed.steps.length) stepsInput.value = parsed.steps.join("\n");
  tagsInput.value = mergeTags(tagsInput.value, parsed.tags || []);

  if (parsed.category && CATEGORY_OPTIONS.includes(parsed.category)) {
    categoryInput.value = parsed.category;
    renderFormCategoryPills();
  }
}

async function getOcrWorker() {
  if (ocrWorker) return ocrWorker;
  if (!window.Tesseract || typeof window.Tesseract.createWorker !== "function") {
    throw new Error("OCR library did not load");
  }
  ocrWorker = await window.Tesseract.createWorker("eng");
  return ocrWorker;
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load selected image"));
    img.src = src;
  });
}

async function preprocessImageForOCR(file) {
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImageElement(dataUrl);

  const maxWidth = 1800;
  const scale = Math.min(1, maxWidth / img.width);
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    let gray = (0.299 * r) + (0.587 * g) + (0.114 * b);
    gray = ((gray - 128) * 1.35) + 128;
    gray = gray > 160 ? 255 : 0;

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }

  ctx.putImageData(imageData, 0, 0);

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not prepare image for OCR"));
    }, "image/png");
  });
}

async function importRecipeFromPhoto(file) {
  if (!file || ocrInProgress) return;
  ocrInProgress = true;

  try {
    setOcrStatus("Preparing image...", "busy");
    const previewUrl = await fileToDataUrl(file);
    photoPreview.src = previewUrl;
    photoPreview.classList.remove("hidden");

    const processedImage = await preprocessImageForOCR(file);

    setOcrStatus("Reading recipe text...", "busy");
    const worker = await getOcrWorker();
    const result = await worker.recognize(processedImage);
    const rawText = result && result.data && result.data.text ? result.data.text : "";

    if (!rawText.trim()) {
      throw new Error("No readable text found in image");
    }

    setOcrStatus("Organizing recipe into fields...", "busy");
    const parsed = parseRecipeText(rawText);

    if (!parsed.ingredients.length || !parsed.steps.length) {
      setOcrStatus("Text was found, but please check ingredients and directions carefully before saving.", "error");
    } else {
      setOcrStatus("Recipe imported. Review and edit anything before saving.");
    }

    applyParsedRecipeToForm(parsed);
  } catch (error) {
    console.error("OCR import failed", error);
    setOcrStatus("Could not read this image clearly. Try a sharper photo or fill the form manually.", "error");
  } finally {
    ocrInProgress = false;
  }
}

prevBtn.onclick = showPrevRecipe;
nextBtn.onclick = showNextRecipe;
flipBtn.onclick = toggleFlip;

openFormBtn.addEventListener("click", openModal);
closeFormBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);

searchInput.addEventListener("input", (event) => {
  searchTerm = String(event.target.value || "").trim().toLowerCase();
  currentIndex = 0;
  recipeCard.classList.remove("flipped");
  renderRecipe();
});

recipeModal.addEventListener("click", (event) => {
  if (event.target === recipeModal) closeModal();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && recipeModal.classList.contains("show")) closeModal();
});

photoInput.addEventListener("change", async () => {
  const file = photoInput.files && photoInput.files[0];
  if (!file) {
    photoPreview.classList.add("hidden");
    photoPreview.removeAttribute("src");
    setOcrStatus("");
    return;
  }
  await importRecipeFromPhoto(file);
});

recipeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(recipeForm);
  const file = photoInput.files && photoInput.files[0];
  const imageData = file ? await fileToDataUrl(file) : "";
  const newRecipe = normalizeRecipe({
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description"),
    image: formData.get("image"),
    ingredients: parseLines(formData.get("ingredients")),
    steps: parseLines(formData.get("steps")),
    notes: formData.get("notes"),
    tags: parseTags(formData.get("tags")),
    createdAt: new Date().toISOString()
  });
  if (!newRecipe.title || !newRecipe.ingredients.length || !newRecipe.steps.length) return;

  try {
    await saveRecipe(newRecipe, imageData);
    activeCategory = "All";
    activeTag = "All";
    searchTerm = "";
    searchInput.value = "";
    currentIndex = 0;
    recipeCard.classList.remove("flipped");
    renderCategories();
    renderTags();
    renderRecipe();
    closeModal();
  } catch (error) {
    console.error(error);
    alert("Recipe save failed. Check your cloud URL if you turned cloud sync on.");
  }
});

window.addEventListener("resize", syncFlipDisplay);

renderCategories();
renderTags();
renderFormCategoryPills();
renderRecipe();
syncFlipDisplay();
loadStarterRecipes();
