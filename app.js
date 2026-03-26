const STORAGE_KEY = "recipe-book-local-v1";
const STARTER_DATA_PATH = "data/recipes.json";
const CLOUD_ENDPOINT = ""; // Paste your Apps Script web app URL here
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=80";
const CATEGORY_OPTIONS = ["Breakfast", "Lunch", "Dinner", "Dessert", "Snacks", "Drinks"];
const FAVORITES_CATEGORY = "Favorites";

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
const clearSearchBtn = document.getElementById("clearSearchBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const flipBtn = document.getElementById("flipBtn");
const openFormBtn = document.getElementById("openFormBtn");
const editRecipeBtn = document.getElementById("editRecipeBtn");
const deleteRecipeBtn = document.getElementById("deleteRecipeBtn");
const viewAllBtn = document.getElementById("viewAllBtn");
const favoriteBtn = document.getElementById("favoriteBtn");
const recipeModal = document.getElementById("recipeModal");
const closeFormBtn = document.getElementById("closeFormBtn");
const cancelBtn = document.getElementById("cancelBtn");
const recipeForm = document.getElementById("recipeForm");
const formCategoryPills = document.getElementById("formCategoryPills");
const categoryInput = document.getElementById("category");
const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("photoPreview");
const indexModal = document.getElementById("indexModal");
const closeIndexBtn = document.getElementById("closeIndexBtn");
const recipeIndexList = document.getElementById("recipeIndexList");
const toast = document.getElementById("toast");

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
  return {
    id: String(recipe?.id || recipe?.createdAt || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).trim(),
    title: String(recipe?.title || "Untitled Recipe").trim(),
    category: CATEGORY_OPTIONS.includes(category) ? category : "Dinner",
    image: String(recipe?.image || "").trim(),
    description: String(recipe?.description || "").trim(),
    ingredients: ensureArray(recipe?.ingredients),
    steps: ensureArray(recipe?.steps),
    notes: String(recipe?.notes || "").trim(),
    favorite: Boolean(recipe?.favorite),
    createdAt: String(recipe?.createdAt || new Date().toISOString()).trim()
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
    const key = recipeIdOf(recipe);
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
  ].join(" ").toLowerCase();
  return haystack.includes(searchTerm);
}

function filteredRecipes() {
  return allRecipes().filter((recipe) => {
    const favoriteMatch = activeCategory !== FAVORITES_CATEGORY || recipe.favorite;
    const categoryMatch = activeCategory === "All" || activeCategory === FAVORITES_CATEGORY || recipe.category === activeCategory;
    return favoriteMatch && categoryMatch && matchesSearch(recipe);
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


function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function updateSearchUi() {
  if (!clearSearchBtn) return;
  const active = Boolean(searchTerm || activeCategory !== "All");
  clearSearchBtn.classList.toggle("hidden", !active);
}

function clearFilters() {
  activeCategory = "All";
  searchTerm = "";
  currentIndex = 0;
  if (searchInput) searchInput.value = "";
  resetFlip();
  renderCategoryFilters();
  updateSearchUi();
  renderRecipe();
}

function isEditableRecipe(recipe) {
  const localIds = new Set(userRecipes.map(recipeIdOf));
  return Boolean(recipe && (cloudEnabled() || localIds.has(recipeIdOf(recipe))));
}

function updateActionButtons(currentRecipe) {
  const editable = isEditableRecipe(currentRecipe);
  if (editRecipeBtn) editRecipeBtn.disabled = !editable;
  if (deleteRecipeBtn) deleteRecipeBtn.disabled = !editable;
  if (favoriteBtn) {
    favoriteBtn.disabled = !editable;
    favoriteBtn.textContent = currentRecipe?.favorite ? "★ Favorite" : "☆ Favorite";
    favoriteBtn.classList.toggle("active-favorite", Boolean(currentRecipe?.favorite));
  }
}

function renderRecipe() {
  const recipes = filteredRecipes();
  updateSearchUi();

  if (!recipes.length) {
    recipeImage.src = FALLBACK_IMAGE;
    recipeImage.alt = "No recipe available";
    recipeCategory.textContent = activeCategory === "All" ? "Recipe" : activeCategory;
    recipeTitle.textContent = "No recipes match right now";
    recipeDescription.textContent = "Try another search or category, or clear filters to see everything again.";
    renderList([], ingredientsList);
    renderList([], stepsList);
    recipeCount.textContent = "0 / 0";
    counterText.textContent = "No recipes found";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    updateActionButtons(null);
    return;
  }

  const recipe = getCurrentRecipe();
  prevBtn.disabled = recipes.length <= 1;
  nextBtn.disabled = recipes.length <= 1;

  recipeImage.src = recipe.image || FALLBACK_IMAGE;
  recipeImage.alt = recipe.title || "Recipe image";
  recipeCategory.textContent = recipe.category || "Recipe";
  recipeTitle.textContent = recipe.title || "Untitled Recipe";
  recipeDescription.textContent = recipe.description || recipe.notes || "";
  renderList(recipe.ingredients || [], ingredientsList);
  renderList(recipe.steps || [], stepsList);
  recipeCount.textContent = `${currentIndex + 1} / ${recipes.length}`;
  counterText.textContent = `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"} shown`;
  updateActionButtons(recipe);
}

function renderCategoryFilters() {
  if (!browseCategoryList) return;
  browseCategoryList.innerHTML = "";
  ["All", FAVORITES_CATEGORY, ...CATEGORY_OPTIONS].forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-link${category === activeCategory ? " active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      activeCategory = category;
      currentIndex = 0;
      resetFlip();
      renderCategoryFilters();
      updateSearchUi();
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

function resetFormState() {
  recipeForm.reset();
  categoryInput.value = "Dinner";
  renderFormCategoryPills();
  photoPreview.classList.add("hidden");
  photoPreview.removeAttribute("src");
  editingRecipeId = null;
  recipeModal.querySelector(".modal-head h2").textContent = "Add a recipe";
}

function closeModal() {
  recipeModal.classList.remove("show");
  recipeModal.setAttribute("aria-hidden", "true");
  resetFormState();
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
    main.innerHTML = `<span class="index-title">${recipe.favorite ? "★ " : ""}${recipe.title}</span><span class="index-meta">${recipe.category}</span>`;
    main.addEventListener("click", () => {
      activeCategory = "All";
      searchTerm = "";
      searchInput.value = "";
      renderCategoryFilters();
      updateSearchUi();
      const visible = filteredRecipes();
      currentIndex = Math.max(0, visible.findIndex((item) => recipeIdOf(item) === recipeIdOf(recipe)));
      resetFlip();
      renderRecipe();
      closeIndexModal();
    });

    const actions = document.createElement("div");
    actions.className = "index-actions";

    const fav = document.createElement("button");
    fav.type = "button";
    fav.className = `index-inline-btn${recipe.favorite ? " active-favorite" : ""}`;
    fav.textContent = recipe.favorite ? "★" : "☆";
    fav.title = recipe.favorite ? "Remove favorite" : "Add favorite";
    fav.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavorite(recipe, true);
    });
    actions.appendChild(fav);

    const editable = isEditableRecipe(recipe);
    if (editable) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "index-inline-btn";
      edit.textContent = "Edit";
      edit.addEventListener("click", (event) => {
        event.stopPropagation();
        closeIndexModal();
        populateFormForEdit(recipe);
      });
      actions.appendChild(edit);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "index-inline-btn danger-text";
      del.textContent = "Delete";
      del.addEventListener("click", async (event) => {
        event.stopPropagation();
        await deleteRecipeById(recipeIdOf(recipe), recipe.title);
      });
      actions.appendChild(del);
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
    const payload = { action: editingRecipeId ? "update" : "add", recipe };
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

  if (editingRecipeId) {
    const idx = userRecipes.findIndex((item) => recipeIdOf(item) === editingRecipeId);
    if (idx !== -1) {
      userRecipes[idx] = recipe;
    } else {
      userRecipes.unshift(recipe);
    }
  } else {
    userRecipes.unshift(recipe);
  }
  saveLocalRecipes();
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
  }
  editingRecipeId = recipeIdOf(recipe);
  recipeModal.querySelector(".modal-head h2").textContent = "Edit recipe";
  openModal();
}

async function deleteRecipeById(id, title = "this recipe") {
  if (!confirm(`Delete "${title}"?`)) return;

  if (cloudEnabled()) {
    const response = await fetch(CLOUD_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "delete", id })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Cloud delete failed");
    await loadStarterRecipes();
  } else {
    userRecipes = userRecipes.filter((item) => recipeIdOf(item) !== id);
    saveLocalRecipes();
  }

  currentIndex = 0;
  resetFlip();
  renderCategoryFilters();
  renderRecipe();
  renderRecipeIndex();
  showToast("Recipe deleted");
}

async function handleDelete() {
  const current = getCurrentRecipe();
  if (!current) return;
  try {
    await deleteRecipeById(recipeIdOf(current), current.title);
  } catch (error) {
    console.error(error);
    alert("Delete failed.");
  }
}

async function toggleFavorite(recipe = getCurrentRecipe(), shouldRerender = true) {
  if (!recipe) return;
  const updated = normalizeRecipe({ ...recipe, favorite: !recipe.favorite });

  if (cloudEnabled()) {
    const response = await fetch(CLOUD_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "update", recipe: updated })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Favorite update failed");
    await loadStarterRecipes();
  } else {
    const idx = userRecipes.findIndex((item) => recipeIdOf(item) === recipeIdOf(recipe));
    if (idx !== -1) {
      userRecipes[idx] = updated;
      saveLocalRecipes();
    }
  }

  if (shouldRerender) {
    renderCategoryFilters();
    renderRecipe();
    renderRecipeIndex();
    showToast(updated.favorite ? "Added to favorites" : "Removed from favorites");
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(recipeForm);
  const file = photoInput.files?.[0] || null;
  const imageData = file ? await fileToDataUrl(file) : "";
  const existing = editingRecipeId ? userRecipes.find((item) => recipeIdOf(item) === editingRecipeId) : null;

  const newRecipe = normalizeRecipe({
    id: editingRecipeId || existing?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description"),
    image: imageData || formData.get("image") || existing?.image || "",
    ingredients: parseLines(formData.get("ingredients")),
    steps: parseLines(formData.get("steps")),
    notes: formData.get("notes"),
    favorite: existing?.favorite || false,
    createdAt: existing?.createdAt || new Date().toISOString()
  });

  if (!newRecipe.title || !newRecipe.ingredients.length || !newRecipe.steps.length) return;

  const wasEditing = Boolean(editingRecipeId);
  try {
    await saveRecipe(newRecipe, imageData);
    activeCategory = "All";
    searchTerm = "";
    searchInput.value = "";
    currentIndex = 0;
    renderCategoryFilters();
    updateSearchUi();
    renderRecipe();
    closeModal();
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
  editRecipeBtn.addEventListener("click", () => {
    const current = getCurrentRecipe();
    if (!current) return;
    populateFormForEdit(current);
  });
  deleteRecipeBtn.addEventListener("click", handleDelete);
  favoriteBtn.addEventListener("click", async () => {
    try {
      await toggleFavorite();
    } catch (error) {
      console.error(error);
      alert("Favorite update failed.");
    }
  });
  viewAllBtn.addEventListener("click", openIndexModal);
  closeFormBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  closeIndexBtn.addEventListener("click", closeIndexModal);
  recipeModal.addEventListener("click", (event) => {
    if (event.target === recipeModal) closeModal();
  });
  indexModal.addEventListener("click", (event) => {
    if (event.target === indexModal) closeIndexModal();
  });

  searchInput.addEventListener("input", () => {
    searchTerm = searchInput.value.trim().toLowerCase();
    currentIndex = 0;
    resetFlip();
    updateSearchUi();
    renderRecipe();
  });

  clearSearchBtn.addEventListener("click", clearFilters);

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
    const modalOpen = recipeModal.classList.contains("show") || indexModal.classList.contains("show");
    if (event.key === "Escape" && modalOpen) {
      closeModal();
      closeIndexModal();
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
  updateSearchUi();
  renderRecipe();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
