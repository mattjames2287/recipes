
const SHEET_NAME = "Recipes";
const IMAGE_FOLDER_ID = ""; // Optional Drive folder ID for uploaded images
const SEED_RECIPES = [];

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

    if (action === "add" || action === "upsert") {
      const saved = upsertRecipe_(payload.recipe || {}, payload.imageDataUrl || "");
      return outputJson_({ ok: true, recipe: saved });
    }

    if (action === "delete") {
      deleteRecipe_(String(payload.id || ""));
      return outputJson_({ ok: true });
    }

    return outputJson_({ ok: false, error: "Unknown action" });
  } catch (error) {
    return outputJson_({ ok: false, error: String(error) });
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  ensureHeaders_(sheet);
  return sheet;
}

function ensureHeaders_(sheet) {
  const headers = ["id", "createdAt", "title", "category", "description", "image", "ingredientsJson", "stepsJson", "notes", "favorite"];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (headers.join("|") !== current.join("|")) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

function normalizeRecipe_(recipe) {
  return {
    id: String(recipe.id || recipe.createdAt || Utilities.getUuid()),
    createdAt: String(recipe.createdAt || new Date().toISOString()),
    title: String(recipe.title || "Untitled Recipe"),
    category: String(recipe.category || "Dinner"),
    description: String(recipe.description || ""),
    image: String(recipe.image || ""),
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
    steps: Array.isArray(recipe.steps) ? recipe.steps : [],
    notes: String(recipe.notes || ""),
    favorite: Boolean(recipe.favorite)
  };
}

function getRecipes_() {
  const sheet = getSheet_();
  if (sheet.getLastRow() < 2) return [];
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 10).getValues();
  return rows.map(function(row) {
    return normalizeRecipe_({
      id: row[0],
      createdAt: row[1],
      title: row[2],
      category: row[3],
      description: row[4],
      image: row[5],
      ingredients: parseJson_(row[6]),
      steps: parseJson_(row[7]),
      notes: row[8],
      favorite: String(row[9]).toLowerCase() === "true"
    });
  });
}

function upsertRecipe_(recipe, imageDataUrl) {
  const sheet = getSheet_();
  const normalized = normalizeRecipe_(recipe);

  if (imageDataUrl && IMAGE_FOLDER_ID) {
    normalized.image = saveImageToDrive_(imageDataUrl, normalized.title || "recipe-image");
  }

  const values = [
    normalized.id,
    normalized.createdAt,
    normalized.title,
    normalized.category,
    normalized.description,
    normalized.image,
    JSON.stringify(normalized.ingredients || []),
    JSON.stringify(normalized.steps || []),
    normalized.notes,
    normalized.favorite ? "true" : "false"
  ];

  const idColumn = sheet.getLastRow() >= 2 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat() : [];
  const idx = idColumn.findIndex(function(id) { return String(id) === normalized.id; });

  if (idx >= 0) {
    sheet.getRange(idx + 2, 1, 1, values.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }

  return normalized;
}

function deleteRecipe_(recipeId) {
  if (!recipeId) throw new Error("Missing recipe id");
  const sheet = getSheet_();
  if (sheet.getLastRow() < 2) return;

  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().flat();
  const idx = ids.findIndex(function(id) { return String(id) === recipeId; });
  if (idx >= 0) sheet.deleteRow(idx + 2);
}

function saveImageToDrive_(dataUrl, name) {
  const match = String(dataUrl || "").match(/^data:(.+);base64,(.+)$/);
  if (!match) return "";
  const contentType = match[1];
  const bytes = Utilities.base64Decode(match[2]);
  const blob = Utilities.newBlob(bytes, contentType, name);
  const file = DriveApp.getFolderById(IMAGE_FOLDER_ID).createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/uc?export=view&id=" + file.getId();
}

function parseJson_(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function outputJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function seedRecipes_() {
  SEED_RECIPES.forEach(function(recipe) {
    upsertRecipe_(recipe, "");
  });
}
