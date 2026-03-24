const SHEET_NAME = "Recipes";
const IMAGE_FOLDER_ID = ""; // Optional: paste a Drive folder ID here for uploaded camera photos
const SEED_RECIPES = [
  {
    "title": "Chocolate Chip Cookies",
    "category": "Dessert",
    "image": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e",
    "ingredients": [
      "8 tbsp salted butter",
      "1/2 cup white sugar",
      "1/4 cup brown sugar",
      "1 tsp vanilla",
      "1 egg",
      "1 1/2 cups flour",
      "1/2 tsp baking soda",
      "1/4 tsp salt",
      "3/4 cup chocolate chips"
    ],
    "steps": [
      "Preheat oven to 350",
      "Melt butter",
      "Mix sugars + butter",
      "Add egg + vanilla",
      "Add dry ingredients",
      "Add chocolate chips",
      "Bake 9\u201311 minutes"
    ],
    "tags": [
      "Family Favorite",
      "Dessert",
      "Holiday"
    ]
  },
  {
    "title": "Garlic Parmesan Chicken Pasta",
    "category": "Dinner",
    "image": "https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5",
    "ingredients": [
      "Parmesan garlic sauce",
      "2 lbs chicken",
      "1 cup milk",
      "8 oz cream cheese",
      "4 oz parmesan",
      "12 oz pasta"
    ],
    "steps": [
      "Add chicken + sauce",
      "Add milk + cheese",
      "Cook",
      "Shred chicken",
      "Cook pasta",
      "Combine"
    ],
    "tags": [
      "Dinner",
      "Crock Pot",
      "Family Favorite"
    ]
  },
  {
    "title": "Raspberry Custard Pie",
    "category": "Dessert",
    "image": "https://images.unsplash.com/photo-1519681393784-d120267933ba",
    "ingredients": [
      "Pie crust",
      "4 cups raspberries",
      "3 eggs",
      "1 1/3 cup sugar",
      "1/4 cup flour",
      "1 cup milk",
      "1 tbsp vanilla"
    ],
    "steps": [
      "Preheat 375",
      "Mix ingredients",
      "Add raspberries to crust",
      "Pour mixture",
      "Bake 45 min",
      "Cool completely"
    ],
    "tags": [
      "Dessert",
      "Holiday",
      "Family Favorite"
    ]
  },
  {
    "title": "Creamy Pesto Chicken Pasta",
    "category": "Dinner",
    "image": "https://images.unsplash.com/photo-1551183053-bf91a1d81141",
    "ingredients": [
      "Chicken",
      "Butter",
      "Garlic",
      "Penne",
      "Broth",
      "Milk",
      "Cream cheese",
      "Pesto",
      "Parmesan",
      "Spinach"
    ],
    "steps": [
      "Cook chicken",
      "Add pasta + broth",
      "Simmer",
      "Add sauce ingredients",
      "Add spinach",
      "Serve"
    ],
    "tags": [
      "Dinner",
      "Quick",
      "Family Favorite"
    ]
  },
  {
    "title": "Crockpot Banana Bread",
    "category": "Breakfast",
    "image": "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa",
    "ingredients": [
      "Butter",
      "Sugar",
      "Brown sugar",
      "Eggs",
      "Bananas",
      "Flour",
      "Baking powder",
      "Chocolate chips"
    ],
    "steps": [
      "Mix wet",
      "Mix dry",
      "Combine",
      "Add to crockpot",
      "Cook 4 hours low",
      "Cool"
    ],
    "tags": [
      "Breakfast",
      "Crock Pot",
      "Family Favorite"
    ]
  }
];

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : "list";
  if (action === "list") return outputJson_({ ok: true, recipes: getRecipes_() });
  if (action === "seed") {
    seedRecipes_();
    return outputJson_({ ok: true, message: "Seeded recipes" });
  }
  return outputJson_({ ok: false, error: "Unknown action" });
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(payload.action || "");
    if (action === "add") {
      const saved = addRecipe_(payload.recipe || {}, payload.imageDataUrl || "");
      return outputJson_({ ok: true, recipe: saved });
    }
    return outputJson_({ ok: false, error: "Unknown action" });
  } catch (error) {
    return outputJson_({ ok: false, error: String(error) });
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(["title","category","description","ingredients","steps","notes","tags","image","createdAt"]);
  }
  return sh;
}

function getRecipes_() {
  const sh = getSheet_();
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).filter(r => String(r[0] || "").trim()).map(rowToRecipe_);
}

function rowToRecipe_(row) {
  return {
    title: String(row[0] || ""),
    category: String(row[1] || "Dinner"),
    description: String(row[2] || ""),
    ingredients: splitLines_(row[3]),
    steps: splitLines_(row[4]),
    notes: String(row[5] || ""),
    tags: splitComma_(row[6]),
    image: String(row[7] || ""),
    createdAt: String(row[8] || "")
  };
}

function addRecipe_(recipe, imageDataUrl) {
  const sh = getSheet_();
  const clean = normalizeRecipe_(recipe);
  if (imageDataUrl && IMAGE_FOLDER_ID) {
    clean.image = saveImageToDrive_(imageDataUrl, clean.title);
  }
  sh.appendRow([
    clean.title,
    clean.category,
    clean.description,
    clean.ingredients.join("\n"),
    clean.steps.join("\n"),
    clean.notes,
    clean.tags.join(", "),
    clean.image,
    clean.createdAt || new Date().toISOString()
  ]);
  return clean;
}

function seedRecipes_() {
  const sh = getSheet_();
  const existing = getRecipes_().map(r => String(r.title || "").toLowerCase());
  SEED_RECIPES.forEach(recipe => {
    if (existing.indexOf(String(recipe.title || "").toLowerCase()) !== -1) return;
    addRecipe_(recipe, "");
  });
}

function normalizeRecipe_(recipe) {
  return {
    title: String(recipe.title || "").trim(),
    category: String(recipe.category || "Dinner").trim(),
    description: String(recipe.description || "").trim(),
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients.map(String).map(s => s.trim()).filter(Boolean) : [],
    steps: Array.isArray(recipe.steps) ? recipe.steps.map(String).map(s => s.trim()).filter(Boolean) : [],
    notes: String(recipe.notes || "").trim(),
    tags: Array.isArray(recipe.tags) ? recipe.tags.map(String).map(s => s.trim()).filter(Boolean) : splitComma_(recipe.tags),
    image: String(recipe.image || "").trim(),
    createdAt: String(recipe.createdAt || "").trim()
  };
}

function splitLines_(value) {
  return String(value || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function splitComma_(value) {
  return String(value || "").split(",").map(s => s.trim()).filter(Boolean);
}

function saveImageToDrive_(dataUrl, title) {
  const folder = DriveApp.getFolderById(IMAGE_FOLDER_ID);
  const match = String(dataUrl || "").match(/^data:(.+?);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL");
  const mimeType = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const ext = mimeType.indexOf("png") !== -1 ? "png" : "jpg";
  const blob = Utilities.newBlob(bytes, mimeType, sanitizeFileName_(title || "recipe") + "." + ext);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/uc?export=view&id=" + file.getId();
}

function sanitizeFileName_(name) {
  return String(name || "recipe").replace(/[^a-z0-9\-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function outputJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}