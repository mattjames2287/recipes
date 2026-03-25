const STORAGE_KEY = "recipe-book-local-v1";
const STARTER_DATA_PATHS = ["data/recipes.json", "data_recipes_tmp.json"];
const CLOUD_ENDPOINT = ""; // Paste your Apps Script web app URL here
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80";
const CATEGORY_OPTIONS = ["Breakfast", "Lunch", "Dinner", "Dessert", "Snacks", "Drinks"];

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
const recipeTagChips = document.getElementById("recipeTagChips");
const cloudStatus = document.getElementById("cloudStatus");
const searchInput = document.getElementById("searchInput");

const recipeFront = document.querySelector(".recipe-front");
const recipeBack = document.querySelector(".recipe-back");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const flipBtn = document.getElementById("flipBtn");
const openFormBtn = document.getElementById("openFormBtn");
const searchBtn = document.getElementById("searchBtn");
const menuToggleBtn = document.getElementById("menuToggleBtn");
const closeMenuBtn = document.getElementById("closeMenuBtn");
const filterMenu = document.getElementById("filterMenu");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
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
let currentIndex = 0;
let searchTerm = "";
let ocrWorker = null;
let ocrInProgress = false;

function isMobileView() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function syncFlipDisplay() {
  if (!recipeFront || !recipeBack || !recipeCard) return;
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
  if (cloudStatus) cloudStatus.textContent = message;
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
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  return String(value || "")
    .split(/[\n,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function normalizeRecipe(recipe) {
  const category = String(recipe?.category || "Dinner").trim();
  return {
    title: String(recipe?.title || "Untitled Recipe").trim(),
    category: CATEGORY_OPTIONS.includes(category) ? category : "Dinner",
    image: String(recipe?.image || "").trim(),
    description: String(recipe?.description || "").trim(),
    ingredients: ensureArray(recipe?.ingredients),
    steps: ensureArray(recipe?.steps),
    notes: String(recipe?.notes || "").trim(),
    tags: parseTags(recipe?.tags),
    createdAt: String(recipe?.createdAt || "").trim()
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
    return categoryMatch && matchesSearch(recipe);
  });
}

function renderList(items, target) {
  if (!target) return;
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
  if (!container) return;
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

function resetToFirstRecipe() {
  currentIndex = 0;
  if (recipeCard) recipeCard.classList.remove("flipped");
  syncFlipDisplay();
}

function renderCategories() {
  renderPills(categoryRow, ["All", ...CATEGORY_OPTIONS], activeCategory, (value) => {
    activeCategory = value;
    resetToFirstRecipe();
    renderCategories();
    renderRecipe();
    if (isMobileView()) setMenuOpen(false);
  });
}

function renderTags() {
  return;
}

function renderRecipeTags(tags) {
  if (!recipeTagChips) return;
  recipeTagChips.innerHTML = "";
  (tags || []).forEach((tag) => {
    const pill = document.createElement("div");
    pill.className = "meta-pill";
    pill.textContent = tag;
    recipeTagChips.appendChild(pill);
  });
}

function renderFormCategoryPills() {
  if (!formCategoryPills || !categoryInput) return;
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

function applySearch() {
  searchTerm = String(searchInput?.value || "").trim().toLowerCase();
  resetToFirstRecipe();
  renderRecipe();
}

function setMenuOpen(open) {
  if (!filterMenu || !menuToggleBtn) return;
  filterMenu.classList.toggle("hidden", !open);
  menuToggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
}

function toggleMenu() {
  if (!filterMenu) return;
  setMenuOpen(filterMenu.classList.contains("hidden"));
}

function clearFilters() {
  activeCategory = "All";
  searchTerm = "";
  if (searchInput) searchInput.value = "";
  resetToFirstRecipe();
  renderCategories();
  renderRecipe();
}

function renderRecipe() {
  const recipes = filteredRecipes();
  if (!recipes.length) {
    if (recipeImage) {
      recipeImage.src = FALLBACK_IMAGE;
      recipeImage.alt = "No recipe available";
    }
    if (recipeCategory) recipeCategory.textContent = activeCategory === "All" ? "Recipe" : activeCategory;
    if (recipeTitle) recipeTitle.textContent = "No recipes match right now";
    if (recipeDescription) recipeDescription.textContent = "Try clearing a filter, changing your search, or adding a new recipe.";
    if (ingredientsList) ingredientsList.innerHTML = "";
    if (stepsList) stepsList.innerHTML = "";
    if (recipeTagChips) recipeTagChips.innerHTML = "";
    if (notesBox) notesBox.classList.add("hidden");
    if (recipeCount) recipeCount.textContent = "0 / 0";
    if (counterText) counterText.textContent = "No recipes found";
    syncFlipDisplay();
    return;
  }

  if (currentIndex >= recipes.length) currentIndex = 0;
  if (currentIndex < 0) currentIndex = recipes.length - 1;

  const recipe = recipes[currentIndex];
  if (recipeImage) {
    recipeImage.src = recipe.image || FALLBACK_IMAGE;
    recipeImage.alt = recipe.title || "Recipe image";
  }
  if (recipeCategory) recipeCategory.textContent = recipe.category || "Recipe";
  if (recipeTitle) recipeTitle.textContent = recipe.title || "Untitled Recipe";
  if (recipeDescription) recipeDescription.textContent = recipe.description || "";
  renderRecipeTags(recipe.tags || []);

  if (recipe.notes) {
    if (notesBox) notesBox.classList.remove("hidden");
    if (recipeNotes) recipeNotes.textContent = recipe.notes;
  } else {
    if (notesBox) notesBox.classList.add("hidden");
    if (recipeNotes) recipeNotes.textContent = "";
  }

  if (recipeCount) recipeCount.textContent = `${currentIndex + 1} / ${recipes.length}`;
  if (counterText) counterText.textContent = `${recipes.length} recipe${recipes.length === 1 ? "" : "s"} shown`;

  renderList(recipe.ingredients || [], ingredientsList);
  renderList(recipe.steps || [], stepsList);
  syncFlipDisplay();
}

function openModal() {
  setMenuOpen(false);
  if (!recipeModal) return;
  recipeModal.classList.add("show");
  recipeModal.setAttribute("aria-hidden", "false");
  renderFormCategoryPills();
}

function closeModal() {
  if (!recipeModal || !recipeForm || !categoryInput) return;
  recipeModal.classList.remove("show");
  recipeModal.setAttribute("aria-hidden", "true");
  recipeForm.reset();
  categoryInput.value = "Dinner";
  renderFormCategoryPills();
  if (photoPreview) {
    photoPreview.classList.add("hidden");
    photoPreview.removeAttribute("src");
  }
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
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fetchCloudRecipes() {
  const response = await fetch(`${CLOUD_ENDPOINT}?action=list&t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!data || !Array.isArray(data.recipes)) throw new Error("Invalid cloud response");
  return data.recipes.map(normalizeRecipe);
}

async function tryLoadBuiltInRecipes() {
  for (const path of STARTER_DATA_PATHS) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data)) {
        starterRecipes = data.map(normalizeRecipe);
        return true;
      }
    } catch (error) {
      console.warn(`Could not load starter recipes from ${path}`, error);
    }
  }
  starterRecipes = [];
  return false;
}

async function refreshRecipeSources(options = {}) {
  const { preserveIndex = false } = options;
  const previousTitle = preserveIndex ? filteredRecipes()[currentIndex]?.title : "";

  if (cloudEnabled()) {
    try {
      starterRecipes = await fetchCloudRecipes();
      setCloudStatus("Cloud sync is live. This cookbook now loads and saves through your shared sheet.");
    } catch (error) {
      console.warn("Cloud recipe load failed, falling back to built-in and local recipes.", error);
      setCloudStatus("Cloud URL is set, but loading failed. Using built-in and local recipes right now.");
      await tryLoadBuiltInRecipes();
    }
  } else {
    setCloudStatus("Cloud sync is off until you paste your Apps Script web app URL into app.js.");
    await tryLoadBuiltInRecipes();
  }

  renderCategories();

  const recipes = filteredRecipes();
  if (preserveIndex && previousTitle) {
    const matchIndex = recipes.findIndex((recipe) => recipe.title === previousTitle);
    currentIndex = matchIndex >= 0 ? matchIndex : 0;
  } else if (currentIndex >= recipes.length) {
    currentIndex = 0;
  }

  renderRecipe();
}

function showPrevRecipe() {
  currentIndex -= 1;
  if (recipeCard) recipeCard.classList.remove("flipped");
  syncFlipDisplay();
  renderRecipe();
}

function showNextRecipe() {
  currentIndex += 1;
  if (recipeCard) recipeCard.classList.remove("flipped");
  syncFlipDisplay();
  renderRecipe();
}

function toggleFlip() {
  if (!recipeCard) return;
  recipeCard.classList.toggle("flipped");
  syncFlipDisplay();
}

async function saveRecipe(recipe, imageData) {
  if (cloudEnabled()) {
    const payload = { action: "add", recipe };
    if (imageData) payload.imageDataUrl = imageData;

    const response = await fetch(CLOUD_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Cloud save failed");

    await refreshRecipeSources();
    return data.recipe ? normalizeRecipe(data.recipe) : recipe;
  }

  userRecipes.unshift(recipe);
  saveLocalRecipes();
  return recipe;
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
    if (/(ingredients?|directions?|instructions?|method|prep time|cook time|servings?)/.test(lower)) continue;
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
  return lines.map((line) => line.replace(/^[-*]\s*/, "").trim()).filter(Boolean);
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
  if (titleInput) titleInput.value = parsed.title || titleInput.value;
  if (descriptionInput) descriptionInput.value = parsed.description || descriptionInput.value;
  if (ingredientsInput && parsed.ingredients?.length) ingredientsInput.value = parsed.ingredients.join("\n");
  if (stepsInput && parsed.steps?.length) stepsInput.value = parsed.steps.join("\n");
  if (tagsInput) tagsInput.value = mergeTags(tagsInput.value, parsed.tags || []);

  if (parsed.category && CATEGORY_OPTIONS.includes(parsed.category) && categoryInput) {
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

  return new Promise((resolve, reject) => {
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
    if (photoPreview) {
      photoPreview.src = previewUrl;
      photoPreview.classList.remove("hidden");
    }

    const processedImage = await preprocessImageForOCR(file);
    setOcrStatus("Reading recipe text...", "busy");
    const worker = await getOcrWorker();
    const result = await worker.recognize(processedImage);
    const rawText = result?.data?.text || "";

    if (!rawText.trim()) {
      throw new Error("No readable text found in image");
    }

    setOcrStatus("Organizing recipe into fields...", "busy");
    const parsed = parseRecipeText(rawText);
    applyParsedRecipeToForm(parsed);

    if (!parsed.ingredients.length || !parsed.steps.length) {
      setOcrStatus("Text was found, but please check ingredients and directions carefully before saving.", "error");
    } else {
      setOcrStatus("Recipe imported. Review and edit anything before saving.");
    }
  } catch (error) {
    console.error("OCR import failed", error);
    setOcrStatus("Could not read this image clearly. Try a sharper photo or fill the form manually.", "error");
  } finally {
    ocrInProgress = false;
  }
}

function bindEvents() {
  prevBtn?.addEventListener("click", showPrevRecipe);
  nextBtn?.addEventListener("click", showNextRecipe);
  flipBtn?.addEventListener("click", toggleFlip);
  openFormBtn?.addEventListener("click", openModal);
  closeFormBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);

  searchBtn?.addEventListener("click", applySearch);
  menuToggleBtn?.addEventListener("click", toggleMenu);
  closeMenuBtn?.addEventListener("click", () => setMenuOpen(false));
  clearFiltersBtn?.addEventListener("click", clearFilters);

  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applySearch();
      searchInput.blur();
    }
  });

  recipeModal?.addEventListener("click", (event) => {
    if (event.target === recipeModal) closeModal();
  });

  document.addEventListener("click", (event) => {
    if (!filterMenu || !menuToggleBtn) return;
    if (filterMenu.classList.contains("hidden")) return;
    if (filterMenu.contains(event.target) || menuToggleBtn.contains(event.target)) return;
    setMenuOpen(false);
  });

  window.addEventListener("keydown", (event) => {
    const modalOpen = recipeModal?.classList.contains("show");
    if (event.key === "Escape" && modalOpen) {
      closeModal();
      return;
    }
    if (modalOpen) return;
    if (event.key === "ArrowLeft") showPrevRecipe();
    if (event.key === "ArrowRight") showNextRecipe();
    if (event.key.toLowerCase() === "f") toggleFlip();
  });

  photoInput?.addEventListener("change", async () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) {
      photoPreview?.classList.add("hidden");
      photoPreview?.removeAttribute("src");
      setOcrStatus("");
      return;
    }
    await importRecipeFromPhoto(file);
  });

  recipeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(recipeForm);
    const file = photoInput?.files && photoInput.files[0];
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
      searchTerm = "";
      if (searchInput) searchInput.value = "";
      resetToFirstRecipe();
      renderCategories();
      renderRecipe();
      closeModal();
      setMenuOpen(false);
    } catch (error) {
      console.error(error);
      alert("Recipe save failed. Check your Apps Script URL if cloud sync is turned on.");
    }
  });

  window.addEventListener("resize", syncFlipDisplay);
}

function init() {
  bindEvents();
  renderCategories();
  renderFormCategoryPills();
  setMenuOpen(false);
  renderRecipe();
  syncFlipDisplay();
  refreshRecipeSources();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
