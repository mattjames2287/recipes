const SHEET_NAME = "Recipes";
const IMAGE_FOLDER_ID = ""; // Optional: paste a Drive folder ID here for uploaded image files
const HEADERS = ["id","title","category","description","ingredients","steps","notes","image","favorite","createdAt"];
const SEED_RECIPES = [
  {"title":"Chocolate Chip Cookies","category":"Dessert","image":"https://images.unsplash.com/photo-1499636136210-6f4ee915583e","ingredients":["8 tbsp salted butter","1/2 cup white sugar","1/4 cup brown sugar","1 tsp vanilla","1 egg","1 1/2 cups flour","1/2 tsp baking soda","1/4 tsp salt","3/4 cup chocolate chips"],"steps":["Preheat oven to 350","Melt butter","Mix sugars + butter","Add egg + vanilla","Add dry ingredients","Add chocolate chips","Bake 9–11 minutes"],"favorite":true},
  {"title":"Garlic Parmesan Chicken Pasta","category":"Dinner","image":"https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5","ingredients":["Parmesan garlic sauce","2 lbs chicken","1 cup milk","8 oz cream cheese","4 oz parmesan","12 oz pasta"],"steps":["Add chicken + sauce","Add milk + cheese","Cook","Shred chicken","Cook pasta","Combine"],"favorite":false},
  {"title":"Raspberry Custard Pie","category":"Dessert","image":"https://images.unsplash.com/photo-1519681393784-d120267933ba","ingredients":["Pie crust","4 cups raspberries","3 eggs","1 1/3 cup sugar","1/4 cup flour","1 cup milk","1 tbsp vanilla"],"steps":["Preheat 375","Mix ingredients","Add raspberries to crust","Pour mixture","Bake 45 min","Cool completely"],"favorite":false},
  {"title":"Creamy Pesto Chicken Pasta","category":"Dinner","image":"https://images.unsplash.com/photo-1551183053-bf91a1d81141","ingredients":["Chicken","Butter","Garlic","Penne","Broth","Milk","Cream cheese","Pesto","Parmesan","Spinach"],"steps":["Cook chicken","Add pasta + broth","Simmer","Add sauce ingredients","Add spinach","Serve"],"favorite":true},
  {"title":"Crockpot Banana Bread","category":"Breakfast","image":"https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa","ingredients":["Butter","Sugar","Brown sugar","Eggs","Bananas","Flour","Baking powder","Chocolate chips"],"steps":["Mix wet","Mix dry","Combine","Add to crockpot","Cook 4 hours low","Cool"],"favorite":false}
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
    if (action === "add") return outputJson_({ ok: true, recipe: addRecipe_(payload.recipe || {}, payload.imageDataUrl || "") });
    if (action === "update") return outputJson_({ ok: true, recipe: updateRecipe_(payload.recipe || {}, payload.imageDataUrl || "") });
    if (action === "delete") return outputJson_({ ok: true, deleted: deleteRecipe_(String(payload.id || "")) });
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
    sh.appendRow(HEADERS);
  }
  ensureHeaders_(sh);
  return sh;
}

function ensureHeaders_(sh) {
  const lastCol = Math.max(sh.getLastColumn(), HEADERS.length);
  const current = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  const needed = HEADERS.slice();
  const missing = needed.filter(h => current.indexOf(h) === -1);
  missing.forEach(h => sh.getRange(1, sh.getLastColumn() + 1).setValue(h));
}

function headerMap_(sh) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h || "").trim());
  const map = {};
  headers.forEach((h, i) => map[h] = i);
  return map;
}

function getRecipes_() {
  const sh = getSheet_();
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const map = headerMap_(sh);
  return data.slice(1).filter(row => String(readCell_(row, map, "title") || "").trim()).map(row => rowToRecipe_(row, map));
}

function readCell_(row, map, key) {
  const idx = map[key];
  return idx === undefined ? "" : row[idx];
}

function rowToRecipe_(row, map) {
  return normalizeRecipe_({
    id: String(readCell_(row, map, "id") || ""),
    title: String(readCell_(row, map, "title") || ""),
    category: String(readCell_(row, map, "category") || "Dinner"),
    description: String(readCell_(row, map, "description") || ""),
    ingredients: splitLines_(readCell_(row, map, "ingredients")),
    steps: splitLines_(readCell_(row, map, "steps")),
    notes: String(readCell_(row, map, "notes") || ""),
    image: String(readCell_(row, map, "image") || ""),
    favorite: String(readCell_(row, map, "favorite") || "").toLowerCase() === "true",
    createdAt: String(readCell_(row, map, "createdAt") || "")
  });
}

function rowValues_(recipe) {
  return [
    recipe.id,
    recipe.title,
    recipe.category,
    recipe.description,
    recipe.ingredients.join("\n"),
    recipe.steps.join("\n"),
    recipe.notes,
    recipe.image,
    String(Boolean(recipe.favorite)),
    recipe.createdAt
  ];
}

function addRecipe_(recipe, imageDataUrl) {
  const sh = getSheet_();
  const clean = normalizeRecipe_(recipe);
  if (imageDataUrl && IMAGE_FOLDER_ID) clean.image = saveImageToDrive_(imageDataUrl, clean.title);
  sh.appendRow(rowValues_(clean));
  return clean;
}

function updateRecipe_(recipe, imageDataUrl) {
  const sh = getSheet_();
  const clean = normalizeRecipe_(recipe);
  if (imageDataUrl && IMAGE_FOLDER_ID) clean.image = saveImageToDrive_(imageDataUrl, clean.title);
  const data = sh.getDataRange().getValues();
  const map = headerMap_(sh);
  const idIdx = map.id;
  if (idIdx === undefined) throw new Error("Missing id column");
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idIdx] || "") === clean.id) {
      sh.getRange(r + 1, 1, 1, HEADERS.length).setValues([rowValues_(clean)]);
      return clean;
    }
  }
  sh.appendRow(rowValues_(clean));
  return clean;
}

function deleteRecipe_(id) {
  if (!id) throw new Error("Missing recipe id");
  const sh = getSheet_();
  const data = sh.getDataRange().getValues();
  const map = headerMap_(sh);
  const idIdx = map.id;
  if (idIdx === undefined) throw new Error("Missing id column");
  for (let r = data.length - 1; r >= 1; r--) {
    if (String(data[r][idIdx] || "") === id) {
      sh.deleteRow(r + 1);
      return true;
    }
  }
  return false;
}

function normalizeRecipe_(recipe) {
  return {
    id: String(recipe.id || recipe.createdAt || (Date.now() + "-" + Math.random().toString(36).slice(2, 8))).trim(),
    title: String(recipe.title || "Untitled Recipe").trim(),
    category: String(recipe.category || "Dinner").trim(),
    description: String(recipe.description || "").trim(),
    ingredients: arrayLines_(recipe.ingredients),
    steps: arrayLines_(recipe.steps),
    notes: String(recipe.notes || "").trim(),
    image: String(recipe.image || "").trim(),
    favorite: Boolean(recipe.favorite),
    createdAt: String(recipe.createdAt || new Date().toISOString()).trim()
  };
}

function arrayLines_(value) {
  if (Array.isArray(value)) return value.map(v => String(v || "").trim()).filter(Boolean);
  return splitLines_(value);
}

function splitLines_(value) {
  return String(value || "").split(/\r?\n/).map(v => v.trim()).filter(Boolean);
}

function seedRecipes_() {
  const sh = getSheet_();
  if (sh.getLastRow() > 1) return;
  SEED_RECIPES.forEach(recipe => sh.appendRow(rowValues_(normalizeRecipe_(recipe))));
}

function outputJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function saveImageToDrive_(dataUrl, title) {
  const match = String(dataUrl || "").match(/^data:(.+?);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data");
  const mimeType = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const ext = mimeType.indexOf("png") !== -1 ? "png" : "jpg";
  const blob = Utilities.newBlob(bytes, mimeType, (title || "recipe") + "." + ext);
  const folder = DriveApp.getFolderById(IMAGE_FOLDER_ID);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/uc?export=view&id=" + file.getId();
}
