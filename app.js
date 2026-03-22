const STORAGE_KEY = "recipe-book-local-v1";
const STARTER_DATA_PATH = "data/recipes.json";
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

const recipeFront = document.querySelector(".recipe-front");
const recipeBack = document.querySelector(".recipe-back");

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

let starterRecipes = [];
let userRecipes = loadLocalRecipes();
let activeCategory = "All";
let currentIndex = 0;

function loadLocalRecipes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const cleaned = parsed
      .map(normalizeRecipe)
      .filter((recipe) => String(recipe.title || "").trim().toLowerCase() !== "test");
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch (error) {
    console.warn("Could not load local recipes", error);
    return [];
  }
}

function saveLocalRecipes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userRecipes));
}

function allRecipes() {
  const seen = new Set();
  return [...userRecipes, ...starterRecipes].filter((recipe) => {
    const key = String(recipe.title || "").trim().toLowerCase();
    if (!key) return false;
    if (key === "test") return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filteredRecipes() {
  const recipes = allRecipes();
  if (activeCategory === "All") return recipes;
  return recipes.filter((recipe) => recipe.category === activeCategory);
}

function ensureArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
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
    notes: String(recipe.notes || "").trim()
  };
}

function renderList(items, target) {
  target.innerHTML = "";
  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const li = document.createElement(target.tagName.toLowerCase() === 'ol' ? "li" : "li");
    li.textContent = item;
    fragment.appendChild(li);
  });
  target.appendChild(fragment);
}

function renderCategories() {
  const categories = ["All", ...CATEGORY_OPTIONS];
  categoryRow.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${category === activeCategory ? " active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      activeCategory = category;
      currentIndex = 0;
      recipeCard.classList.remove("flipped");
      renderCategories();
      renderRecipe();
    });
    categoryRow.appendChild(button);
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
    recipeCategory.textContent = activeCategory;
    recipeTitle.textContent = activeCategory === "All" ? "No recipes here yet" : `No ${activeCategory.toLowerCase()} recipes yet`;
    recipeDescription.textContent = "Add your first recipe with the button above.";
    ingredientsList.innerHTML = "";
    stepsList.innerHTML = "";
    notesBox.classList.add("hidden");
    recipeCount.textContent = "0 / 0";
    counterText.textContent = activeCategory === "All" ? "No recipes yet" : `No recipes in ${activeCategory}`;
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
  if (recipe.notes) {
    notesBox.classList.remove("hidden");
    recipeNotes.textContent = recipe.notes;
  } else {
    notesBox.classList.add("hidden");
    recipeNotes.textContent = "";
  }
  recipeCount.textContent = `${currentIndex + 1} / ${recipes.length}`;
  counterText.textContent = `${recipes.length} recipe${recipes.length === 1 ? "" : "s"} in ${activeCategory === "All" ? "your book" : activeCategory}`;

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
}

function parseLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function loadStarterRecipes() {
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

prevBtn.onclick = showPrevRecipe;
nextBtn.onclick = showNextRecipe;
flipBtn.onclick = toggleFlip;

openFormBtn.addEventListener("click", openModal);
closeFormBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);

recipeModal.addEventListener("click", (event) => {
  if (event.target === recipeModal) closeModal();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && recipeModal.classList.contains("show")) closeModal();
});

recipeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(recipeForm);
  const newRecipe = normalizeRecipe({
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description"),
    image: formData.get("image"),
    ingredients: parseLines(formData.get("ingredients")),
    steps: parseLines(formData.get("steps")),
    notes: formData.get("notes")
  });
  if (!newRecipe.title || !newRecipe.ingredients.length || !newRecipe.steps.length) return;
  userRecipes.unshift(newRecipe);
  saveLocalRecipes();
  activeCategory = "All";
  currentIndex = 0;
  recipeCard.classList.remove("flipped");
  renderCategories();
  renderRecipe();
  closeModal();
});

window.addEventListener("resize", syncFlipDisplay);

renderCategories();
renderFormCategoryPills();
renderRecipe();
syncFlipDisplay();
loadStarterRecipes();
