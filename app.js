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
const browseTagRow = document.getElementById("browseTagRow");
const browseCategoryList = document.getElementById("browseCategoryList");
const recipeTagChips = document.getElementById("recipeTagChips");
const searchInput = document.getElementById("searchInput");

const recipeFront = document.querySelector(".recipe-front");
const recipeBack = document.querySelector(".recipe-back");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const flipBtn = document.getElementById("flipBtn");
const openFormBtn = document.getElementById("openFormBtn");
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
    const tagMatch = activeTag === "All" || (recipe.tags || []).includes(activeTag);
    return categoryMatch && tagMatch && matchesSearch(recipe);
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
  const values = ["All", ...CATEGORY_OPTIONS];
  renderPills(categoryRow, values, activeCategory, (value) => {
    activeCategory = value;
    resetToFirstRecipe();
    renderCategories();
  renderBrowseCategories();
  renderBrowseTags();
    renderBrowseCategories();
    renderRecipe();
    if (isMobileView()) setMenuOpen(false);
  });
}

function allTags() {
  const counts = new Map();
  allRecipes().forEach((recipe) => {
    (recipe.tags || []).forEach((tag) => {
      const clean = String(tag || "").trim();
      if (!clean) return;
      counts.set(clean, (counts.get(clean) || 0) + 1);
    });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

function renderBrowseTags() {
  if (!browseTagRow) return;
  renderPills(browseTagRow, ["All", ...allTags()], activeTag, (value) => {
    activeTag = value;
    resetToFirstRecipe();
    renderBrowseTags();
    renderRecipe();
  });
}

function renderBrowseCategories() {
  if (!browseCategoryList) return;
  browseCategoryList.innerHTML = "";
  const values = ["All", ...CATEGORY_OPTIONS];
  values.forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-link${value === activeCategory ? " active" : ""}`;
    button.textContent = value;
    button.addEventListener("click", () => {
      activeCategory = value;
      resetToFirstRecipe();
      renderCategories();
      renderBrowseCategories();
      renderRecipe();
    });
    browseCategoryList.appendChild(button);
  });
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
  activeTag = "All";
  searchTerm = "";
  if (searchInput) searchInput.value = "";
  resetToFirstRecipe();
  renderCategories();
  renderBrowseCategories();
  renderBrowseTags();
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
    if (recipeDescription) recipeDescription.textContent = "Try clearing a filter, choosing a different tag, changing your search, or adding a new recipe.";
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
    } catch (error) {
      console.warn("Cloud recipe load failed, falling back to built-in and local recipes.", error);
      await tryLoadBuiltInRecipes();
    }
  } else {
    await tryLoadBuiltInRecipes();
  }

  renderCategories();
  renderBrowseCategories();
  renderBrowseTags();

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

function bindEvents() {

  prevBtn?.addEventListener("click", showPrevRecipe);
  nextBtn?.addEventListener("click", showNextRecipe);
  flipBtn?.addEventListener("click", toggleFlip);
  openFormBtn?.addEventListener("click", openModal);
  closeFormBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);

  menuToggleBtn?.addEventListener("click", toggleMenu);
  closeMenuBtn?.addEventListener("click", () => setMenuOpen(false));
  clearFiltersBtn?.addEventListener("click", clearFilters);

  searchInput?.addEventListener("input", applySearch);
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
    return;
  }

  const previewUrl = await fileToDataUrl(file);
  if (photoPreview) {
    photoPreview.src = previewUrl;
    photoPreview.classList.remove("hidden");
  }
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
  renderBrowseCategories();
  renderBrowseTags();
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
