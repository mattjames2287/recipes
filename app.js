const STORAGE_KEY = "recipe-book-local-v1";
const STARTER_DATA_PATH = "data/recipes.json";
const CLOUD_ENDPOINT = ""; // Paste your Apps Script web app URL here
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80";
const CATEGORY_OPTIONS = ["Breakfast", "Lunch", "Dinner", "Dessert", "Snacks", "Drinks"];

const recipeCard = document.getElementById("recipeCard");
const recipeImage = document.getElementById("recipeImage");
const recipeCategory = document.getElementById("recipeCategory");
const recipeTitle = document.getElementById("recipeTitle");
const recipeDescription = document.getElementById("recipeDescription");
const recipeCount = document.getElementById("recipeCount");
const counterText = document.getElementById("counterText");
const ingredientsList = document.getElementById("ingredientsList");
const stepsList = document.getElementById("stepsList");
const browseCategoryList = document.getElementById("browseCategoryList");
const searchInput = document.getElementById("searchInput");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const flipBtn = document.getElementById("flipBtn");
const openFormBtn = document.getElementById("openFormBtn");
const recipeModal = document.getElementById("recipeModal");
const closeFormBtn = document.getElementById("closeFormBtn");
const cancelBtn = document.getElementById("cancelBtn");
const recipeForm = document.getElementById("recipeForm");
const formCategoryPills = document.getElementById("formCategoryPills");
const categoryInput = document.getElementById("category");
const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("photoPreview");

let starterRecipes = [];
let userRecipes = loadLocalRecipes();
let currentIndex = 0;
let activeCategory = "All";
let searchTerm = "";

function isMobileView() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function cloudEnabled() {
  return Boolean(String(CLOUD_ENDPOINT || "").trim());
}

function ensureArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
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
    createdAt: String(recipe?.createdAt || "").trim()
  };
}

function loadLocalRecipes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeRecipe) : [];
  } catch (error) {
    console.warn("Could not read local recipes", error);
    return [];
  }
}

function saveLocalRecipes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userRecipes));
}

function allRecipes() {
  const seen = new Set();
  return [...userRecipes, ...starterRecipes].filter((recipe) => {
    const key = `${recipe.title}__${recipe.category}`.toLowerCase();
    if (seen.has(key)) return false;
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
    ...(recipe.ingredients || []),
    ...(recipe.steps || []),
    recipe.notes
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(searchTerm);
}

function filteredRecipes() {
  return allRecipes().filter((recipe) => {
    const categoryMatch = activeCategory === "All" || recipe.category === activeCategory;
    return categoryMatch && matchesSearch(recipe);
  });
}

function syncFlipDisplay() {
  const front = recipeCard?.querySelector(".recipe-front");
  const back = recipeCard?.querySelector(".recipe-back");
  if (!recipeCard || !front || !back) return;

  const flipped = recipeCard.classList.contains("flipped");
  if (isMobileView()) {
    front.style.display = flipped ? "none" : "flex";
    back.style.display = flipped ? "flex" : "none";
  } else {
    front.style.display = "";
    back.style.display = "";
  }
}

function resetFlip() {
  recipeCard?.classList.remove("flipped");
  syncFlipDisplay();
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

function renderRecipe() {
  const recipes = filteredRecipes();

  if (!recipes.length) {
    recipeImage.src = FALLBACK_IMAGE;
    recipeImage.alt = "No recipe available";
    recipeCategory.textContent = activeCategory === "All" ? "Recipe" : activeCategory;
    recipeTitle.textContent = "No recipes match right now";
    recipeDescription.textContent = "Try a different search, choose another category, or add a new recipe.";
    renderList([], ingredientsList);
    renderList([], stepsList);
    recipeCount.textContent = "0 / 0";
    counterText.textContent = "No recipes found";
    return;
  }

  if (currentIndex >= recipes.length) currentIndex = 0;
  if (currentIndex < 0) currentIndex = recipes.length - 1;

  prevBtn.disabled = recipes.length <= 1;
  nextBtn.disabled = recipes.length <= 1;

  const recipe = recipes[currentIndex];
  recipeImage.src = recipe.image || FALLBACK_IMAGE;
  recipeImage.alt = recipe.title || "Recipe image";
  recipeCategory.textContent = recipe.category || "Recipe";
  recipeTitle.textContent = recipe.title || "Untitled Recipe";
  recipeDescription.textContent = recipe.description || recipe.notes || "";
  renderList(recipe.ingredients || [], ingredientsList);
  renderList(recipe.steps || [], stepsList);
  recipeCount.textContent = `${currentIndex + 1} / ${recipes.length}`;
  counterText.textContent = `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"} shown`;
}

function renderCategoryFilters() {
  if (!browseCategoryList) return;
  browseCategoryList.innerHTML = "";
  ["All", ...CATEGORY_OPTIONS].forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-link${category === activeCategory ? " active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      activeCategory = category;
      currentIndex = 0;
      resetFlip();
      renderCategoryFilters();
      renderRecipe();
    });
    browseCategoryList.appendChild(button);
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
}

function parseLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function fileToDataUrl(file) {
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
  if (!Array.isArray(data?.recipes)) throw new Error("Invalid cloud response");
  return data.recipes.map(normalizeRecipe);
}

async function loadStarterRecipes() {
  if (cloudEnabled()) {
    try {
      starterRecipes = await fetchCloudRecipes();
      return;
    } catch (error) {
      console.warn("Cloud load failed, falling back to starter data", error);
    }
  }

  try {
    const response = await fetch(STARTER_DATA_PATH, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    starterRecipes = Array.isArray(data) ? data.map(normalizeRecipe) : [];
  } catch (error) {
    console.error("Could not load starter recipes", error);
    starterRecipes = [];
  }
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
    await loadStarterRecipes();
    return;
  }

  userRecipes.unshift(recipe);
  saveLocalRecipes();
}

async function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(recipeForm);
  const file = photoInput.files?.[0] || null;
  const imageData = file ? await fileToDataUrl(file) : "";

  const newRecipe = normalizeRecipe({
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description"),
    image: formData.get("image") || imageData,
    ingredients: parseLines(formData.get("ingredients")),
    steps: parseLines(formData.get("steps")),
    notes: formData.get("notes"),
    createdAt: new Date().toISOString()
  });

  if (!newRecipe.title || !newRecipe.ingredients.length || !newRecipe.steps.length) return;

  try {
    await saveRecipe(newRecipe, imageData);
    activeCategory = "All";
    searchTerm = "";
    searchInput.value = "";
    currentIndex = 0;
    renderCategoryFilters();
    renderRecipe();
    closeModal();
  } catch (error) {
    console.error(error);
    alert("Recipe save failed. Check your Apps Script URL if cloud sync is turned on.");
  }
}

function bindEvents() {
  prevBtn.addEventListener("click", () => {
    currentIndex -= 1;
    resetFlip();
    renderRecipe();
  });

  nextBtn.addEventListener("click", () => {
    currentIndex += 1;
    resetFlip();
    renderRecipe();
  });

  flipBtn.addEventListener("click", () => {
    recipeCard.classList.toggle("flipped");
    syncFlipDisplay();
  });

  openFormBtn.addEventListener("click", openModal);
  closeFormBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  recipeModal.addEventListener("click", (event) => {
    if (event.target === recipeModal) closeModal();
  });

  searchInput.addEventListener("input", () => {
    searchTerm = searchInput.value.trim().toLowerCase();
    currentIndex = 0;
    resetFlip();
    renderRecipe();
  });

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files?.[0] || null;
    if (!file) {
      photoPreview.classList.add("hidden");
      photoPreview.removeAttribute("src");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    photoPreview.src = dataUrl;
    photoPreview.classList.remove("hidden");
  });

  recipeForm.addEventListener("submit", handleSubmit);

  window.addEventListener("resize", syncFlipDisplay);
  window.addEventListener("keydown", (event) => {
    const modalOpen = recipeModal.classList.contains("show");
    if (event.key === "Escape" && modalOpen) {
      closeModal();
      return;
    }
    if (modalOpen) return;
    if (event.key === "ArrowLeft") prevBtn.click();
    if (event.key === "ArrowRight") nextBtn.click();
    if (event.key.toLowerCase() === "f") flipBtn.click();
  });
}

async function init() {
  bindEvents();
  renderFormCategoryPills();
  syncFlipDisplay();
  await loadStarterRecipes();
  renderCategoryFilters();
  renderRecipe();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
