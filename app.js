
const STORAGE_KEY = "recipe-book-local-v1";
const STARTER_DATA_PATH = "data/recipes.json";
const CLOUD_ENDPOINT = ""; // Paste your Apps Script web app URL here

const CATEGORY_OPTIONS = ["Breakfast", "Lunch", "Dinner", "Dessert", "Snacks", "Drinks"];
const CATEGORY_FALLBACKS = {
  Breakfast: "https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=1200&q=80",
  Lunch: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80",
  Dinner: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=1200&q=80",
  Dessert: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=1200&q=80",
  Snacks: "https://images.unsplash.com/photo-1519864600265-abb23847ef2c?auto=format&fit=crop&w=1200&q=80",
  Drinks: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=1200&q=80"
};
const GENERIC_FALLBACK = CATEGORY_FALLBACKS.Dinner;

const $ = (id) => document.getElementById(id);

const recipeCard = $("recipeCard");
const recipeImage = $("recipeImage");
const recipeCategory = $("recipeCategory");
const recipeTitle = $("recipeTitle");
const recipeDescription = $("recipeDescription");
const recipeCount = $("recipeCount");
const ingredientsList = $("ingredientsList");
const stepsList = $("stepsList");
const counterText = $("counterText");

const searchInput = $("searchInput");
const openFormBtn = $("openFormBtn");
const favoriteRecipesBtn = $("favoriteRecipesBtn");
const viewAllBtn = $("viewAllBtn");
const clearSearchBtn = $("clearSearchBtn");
const browseCategoryList = $("browseCategoryList");
const emptyState = $("emptyState");
const clearFiltersBtn = $("clearFiltersBtn");

const prevBtn = $("prevBtn");
const nextBtn = $("nextBtn");
const flipBtn = $("flipBtn");

const recipeModal = $("recipeModal");
const closeFormBtn = $("closeFormBtn");
const cancelBtn = $("cancelBtn");
const recipeForm = $("recipeForm");
const formCategoryPills = $("formCategoryPills");
const categoryInput = $("category");
const photoInput = $("photo");
const photoPreview = $("photoPreview");

const indexModal = $("indexModal");
const closeIndexBtn = $("closeIndexBtn");
const recipeIndexList = $("recipeIndexList");
const toast = $("toast");

let starterRecipes = [];
let userRecipes = loadLocalRecipes();
let currentIndex = 0;
let activeCategory = "All";
let searchTerm = "";
let editingRecipeId = null;

function isMobileView() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function cloudEnabled() {
  return Boolean(String(CLOUD_ENDPOINT || "").trim());
}

function fallbackForCategory(category) {
  return CATEGORY_FALLBACKS[category] || GENERIC_FALLBACK;
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function recipeIdOf(recipe) {
  return String(recipe?.id || "").trim() || `${String(recipe?.title || "untitled").trim().toLowerCase()}__${String(recipe?.createdAt || "").trim()}`;
}

function ensureArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeRecipe(recipe) {
  const category = String(recipe?.category || "Dinner").trim();
  const normalizedCategory = CATEGORY_OPTIONS.includes(category) ? category : "Dinner";
  return {
    id: String(recipe?.id || recipe?.createdAt || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    title: String(recipe?.title || "Untitled Recipe").trim(),
    category: normalizedCategory,
    image: String(recipe?.image || "").trim(),
    description: String(recipe?.description || "").trim(),
    ingredients: ensureArray(recipe?.ingredients),
    steps: ensureArray(recipe?.steps),
    notes: String(recipe?.notes || "").trim(),
    createdAt: String(recipe?.createdAt || new Date().toISOString()).trim(),
    favorite: Boolean(recipe?.favorite)
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

function isUserRecipe(recipe) {
  const id = recipeIdOf(recipe);
  return userRecipes.some((item) => recipeIdOf(item) === id);
}

function allRecipes() {
  const byTitle = new Map();

  [...starterRecipes, ...userRecipes].forEach((recipe) => {
    const normalized = normalizeRecipe(recipe);
    const titleKey = String(normalized.title || "").trim().toLowerCase();
    const hasImage = Boolean(String(normalized.image || "").trim());

    if (!titleKey) {
      byTitle.set(recipeIdOf(normalized), normalized);
      return;
    }

    const existing = byTitle.get(titleKey);
    if (!existing) {
      byTitle.set(titleKey, normalized);
      return;
    }

    const existingHasImage = Boolean(String(existing.image || "").trim());

    if (hasImage && !existingHasImage) {
      byTitle.set(titleKey, normalized);
      return;
    }

    if (hasImage === existingHasImage) {
      const existingTime = Date.parse(existing.createdAt || "") || 0;
      const newTime = Date.parse(normalized.createdAt || "") || 0;
      if (newTime >= existingTime) {
        byTitle.set(titleKey, normalized);
      }
    }
  });

  return [...byTitle.values()].sort((a, b) => {
    return String(a.title || "").localeCompare(String(b.title || ""));
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
  ].join(" ").toLowerCase();
  return haystack.includes(searchTerm);
}

function filteredRecipes() {
  return allRecipes().filter((recipe) => {
    const categoryMatch = activeCategory === "All"
      ? true
      : activeCategory === "Favorites"
        ? recipe.favorite
        : recipe.category === activeCategory;
    return categoryMatch && matchesSearch(recipe);
  });
}

function getCurrentRecipe() {
  const recipes = filteredRecipes();
  if (!recipes.length) return null;
  if (currentIndex >= recipes.length) currentIndex = 0;
  if (currentIndex < 0) currentIndex = recipes.length - 1;
  return recipes[currentIndex];
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

function updateFilterUi() {
  const hasActiveSearch = Boolean(searchTerm);
  if (clearSearchBtn) clearSearchBtn.classList.toggle("hidden", !hasActiveSearch && activeCategory === "All");
  if (favoriteRecipesBtn) favoriteRecipesBtn.classList.toggle("active", activeCategory === "Favorites");
}

function renderEmptyState() {
  if (!emptyState) return;
  const noResults = filteredRecipes().length === 0;
  emptyState.classList.toggle("hidden", !noResults);
}

function renderRecipe() {
  const recipes = filteredRecipes();
  const activeFallback = activeCategory === "Favorites" ? GENERIC_FALLBACK : fallbackForCategory(activeCategory);

  if (!recipes.length) {
    recipeImage.src = activeFallback;
    recipeImage.alt = "No recipe available";
    recipeCategory.textContent = activeCategory === "All" ? "Recipe" : activeCategory;
    recipeTitle.textContent = "No recipes found";
    recipeDescription.textContent = "Try another search or clear your filters.";
    renderList([], ingredientsList);
    renderList([], stepsList);
    recipeCount.textContent = "0 / 0";
    counterText.textContent = "No recipes shown";
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    renderEmptyState();
    updateFilterUi();
    return;
  }

  renderEmptyState();
  const recipe = getCurrentRecipe();
  prevBtn.disabled = recipes.length <= 1;
  nextBtn.disabled = recipes.length <= 1;

  recipeImage.src = recipe.image || fallbackForCategory(recipe.category);
  recipeImage.alt = recipe.title || "Recipe image";
  recipeCategory.textContent = recipe.category || "Recipe";
  recipeTitle.textContent = recipe.title || "Untitled Recipe";
  recipeDescription.textContent = recipe.description || recipe.notes || "";
  renderList(recipe.ingredients || [], ingredientsList);
  renderList(recipe.steps || [], stepsList);
  recipeCount.textContent = `${currentIndex + 1} / ${recipes.length}`;
  counterText.textContent = `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"} shown`;
  updateFilterUi();
}

function renderCategoryFilters() {
  if (!browseCategoryList) return;
  browseCategoryList.innerHTML = "";
  ["All", "Favorites", ...CATEGORY_OPTIONS].forEach((category) => {
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
}

function closeModal() {
  recipeModal.classList.remove("show");
  recipeModal.setAttribute("aria-hidden", "true");
  resetFormState();
}

function resetFormState() {
  recipeForm.reset();
  categoryInput.value = CATEGORY_OPTIONS[0];
  renderFormCategoryPills();
  photoPreview.src = "";
  photoPreview.classList.add("hidden");
  photoInput.value = "";
  editingRecipeId = null;
  recipeModal.querySelector(".modal-head h2").textContent = "Add a recipe";
}

function openIndexModal() {
  renderRecipeIndex();
  indexModal.classList.add("show");
  indexModal.setAttribute("aria-hidden", "false");
}

function closeIndexModal() {
  indexModal.classList.remove("show");
  indexModal.setAttribute("aria-hidden", "true");
}

function jumpToRecipe(recipe) {
  activeCategory = "All";
  searchTerm = "";
  searchInput.value = "";
  renderCategoryFilters();
  const visible = filteredRecipes();
  currentIndex = Math.max(0, visible.findIndex((item) => recipeIdOf(item) === recipeIdOf(recipe)));
  resetFlip();
  renderRecipe();
}

function makeIconButton(text, className, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    handler();
  });
  return button;
}

async function toggleFavorite(recipeId) {
  let recipe = allRecipes().find((item) => recipeIdOf(item) === recipeId);
  if (!recipe) return;
  const updated = normalizeRecipe({ ...recipe, favorite: !recipe.favorite });
  await upsertRecipe(updated, "");
  if (activeCategory === "Favorites") currentIndex = 0;
  renderCategoryFilters();
  renderRecipe();
  renderRecipeIndex();
  showToast(updated.favorite ? "Added to favorites" : "Removed from favorites");
}

function renderRecipeIndex() {
  recipeIndexList.innerHTML = "";
  const recipes = [...allRecipes()].sort((a, b) => a.title.localeCompare(b.title));
  const current = getCurrentRecipe();
  const currentId = current ? recipeIdOf(current) : "";
  const fragment = document.createDocumentFragment();

  recipes.forEach((recipe) => {
    const row = document.createElement("div");
    row.className = `index-item${recipeIdOf(recipe) === currentId ? " active" : ""}`;

    const main = document.createElement("button");
    main.type = "button";
    main.className = "index-main";
    main.innerHTML = `<span class="index-title">${recipe.title}</span><span class="index-meta">${recipe.category}</span>`;
    main.addEventListener("click", () => {
      jumpToRecipe(recipe);
      closeIndexModal();
    });

    const actions = document.createElement("div");
    actions.className = "index-actions";

    actions.appendChild(
      makeIconButton(recipe.favorite ? "★" : "☆", `index-mini-btn${recipe.favorite ? " active" : ""}`, () => toggleFavorite(recipeIdOf(recipe)))
    );

    if (isUserRecipe(recipe)) {
      actions.appendChild(
        makeIconButton("Edit", "index-mini-btn text", () => populateFormForEdit(recipe))
      );
      actions.appendChild(
        makeIconButton("Delete", "index-mini-btn text danger", async () => {
          if (!confirm(`Delete "${recipe.title}"?`)) return;
          await deleteRecipeById(recipeIdOf(recipe));
          renderRecipeIndex();
          renderRecipe();
        })
      );
    }

    row.appendChild(main);
    row.appendChild(actions);
    fragment.appendChild(row);
  });

  recipeIndexList.appendChild(fragment);
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
      userRecipes = [];
      return;
    } catch (error) {
      console.warn("Cloud load failed, falling back to starter data", error);
    }
  }
  const response = await fetch(STARTER_DATA_PATH, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  starterRecipes = Array.isArray(data) ? data.map(normalizeRecipe) : [];
}

function populateFormForEdit(recipe) {
  recipeForm.title.value = recipe.title;
  recipeForm.description.value = recipe.description;
  recipeForm.image.value = recipe.image;
  recipeForm.ingredients.value = (recipe.ingredients || []).join("\n");
  recipeForm.steps.value = (recipe.steps || []).join("\n");
  recipeForm.notes.value = recipe.notes;
  categoryInput.value = recipe.category;
  renderFormCategoryPills();
  if (recipe.image) {
    photoPreview.src = recipe.image;
    photoPreview.classList.remove("hidden");
  } else {
    photoPreview.src = "";
    photoPreview.classList.add("hidden");
  }
  editingRecipeId = recipeIdOf(recipe);
  recipeModal.querySelector(".modal-head h2").textContent = "Edit recipe";
  openModal();
}

async function upsertRecipe(recipe, imageData) {
  if (cloudEnabled()) {
    const payload = { action: "upsert", recipe };
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

  const idx = userRecipes.findIndex((item) => recipeIdOf(item) === recipeIdOf(recipe));
  if (idx >= 0) userRecipes[idx] = recipe;
  else userRecipes.unshift(recipe);
  saveLocalRecipes();
}

async function deleteRecipeById(recipeId) {
  if (cloudEnabled()) {
    const response = await fetch(CLOUD_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "delete", id: recipeId })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Delete failed");
    await loadStarterRecipes();
    return;
  }
  userRecipes = userRecipes.filter((item) => recipeIdOf(item) !== recipeId);
  saveLocalRecipes();
}

function duplicateTitleExists(title, excludeId) {
  const normalizedTitle = String(title || "").trim().toLowerCase();
  return allRecipes().some((recipe) => {
    if (excludeId && recipeIdOf(recipe) === excludeId) return false;
    return String(recipe.title || "").trim().toLowerCase() === normalizedTitle;
  });
}

async function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(recipeForm);
  const file = photoInput.files?.[0] || null;
  const imageData = file ? await fileToDataUrl(file) : "";
  const existing = editingRecipeId ? allRecipes().find((item) => recipeIdOf(item) === editingRecipeId) : null;
  const title = String(formData.get("title") || "").trim();

  if (duplicateTitleExists(title, editingRecipeId)) {
    const shouldContinue = confirm(`"${title}" already exists. Save anyway?`);
    if (!shouldContinue) return;
  }

  const newRecipe = normalizeRecipe({
    id: editingRecipeId || existing?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    category: formData.get("category"),
    description: formData.get("description"),
    image: imageData || formData.get("image") || existing?.image || "",
    ingredients: parseLines(formData.get("ingredients")),
    steps: parseLines(formData.get("steps")),
    notes: formData.get("notes"),
    favorite: existing?.favorite || false,
    createdAt: existing?.createdAt || new Date().toISOString()
  });

  if (!newRecipe.title || !newRecipe.ingredients.length || !newRecipe.steps.length) {
    alert("Please add a title, ingredients, and directions.");
    return;
  }

  const wasEditing = Boolean(editingRecipeId);
  try {
    await upsertRecipe(newRecipe, imageData);
    activeCategory = "All";
    searchTerm = "";
    searchInput.value = "";
    currentIndex = 0;
    renderCategoryFilters();
    renderRecipe();
    closeModal();
    jumpToRecipe(newRecipe);
    showToast(wasEditing ? "Recipe updated" : "Recipe added");
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

  openFormBtn.addEventListener("click", () => {
    resetFormState();
    openModal();
  });

  viewAllBtn.addEventListener("click", openIndexModal);

  favoriteRecipesBtn.addEventListener("click", () => {
    activeCategory = "Favorites";
    currentIndex = 0;
    renderCategoryFilters();
    resetFlip();
    renderRecipe();
  });

  clearSearchBtn?.addEventListener("click", () => {
    activeCategory = "All";
    searchTerm = "";
    searchInput.value = "";
    currentIndex = 0;
    renderCategoryFilters();
    resetFlip();
    renderRecipe();
  });

  clearFiltersBtn?.addEventListener("click", () => {
    activeCategory = "All";
    searchTerm = "";
    searchInput.value = "";
    currentIndex = 0;
    renderCategoryFilters();
    resetFlip();
    renderRecipe();
  });

  closeFormBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  closeIndexBtn.addEventListener("click", closeIndexModal);

  recipeModal.addEventListener("click", (event) => {
    if (event.target === recipeModal) closeModal();
  });

  indexModal.addEventListener("click", (event) => {
    if (event.target === indexModal) closeIndexModal();
  });

  recipeForm.addEventListener("submit", handleSubmit);

  searchInput.addEventListener("input", (event) => {
    searchTerm = event.target.value.trim().toLowerCase();
    currentIndex = 0;
    resetFlip();
    renderRecipe();
  });

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files?.[0];
    if (!file) {
      photoPreview.src = "";
      photoPreview.classList.add("hidden");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    photoPreview.src = dataUrl;
    photoPreview.classList.remove("hidden");
  });

  window.addEventListener("resize", syncFlipDisplay);
}

async function init() {
  categoryInput.value = CATEGORY_OPTIONS[0];
  renderFormCategoryPills();
  bindEvents();
  await loadStarterRecipes();
  renderCategoryFilters();
  renderRecipe();
  syncFlipDisplay();
}

init().catch((error) => {
  console.error(error);
  recipeTitle.textContent = "Could not load recipes";
  recipeDescription.textContent = "Check your files and try again.";
});
