# Cloud sync setup

## What this gives you
- shared recipes on your phone and your wife's phone
- search + tags work from one shared source
- add-recipe form can save to the cloud
- camera photo upload is supported when `IMAGE_FOLDER_ID` is set

## 1) Create a Google Sheet
Create a new sheet and name the first tab `Recipes`.

## 2) Open Extensions > Apps Script
Replace the default code with `Code.gs` from this folder.

## 3) Optional: set a Drive folder for photo uploads
Create a Google Drive folder for recipe photos.
Paste that folder ID into:

```js
const IMAGE_FOLDER_ID = "";
```

## 4) Deploy the web app
- Deploy > New deployment
- Type: Web app
- Execute as: Me
- Who has access: Anyone

Copy the web app URL.

## 5) Paste the URL into `app.js`
Find:

```js
const CLOUD_ENDPOINT = "";
```

Paste your web app URL between the quotes.

## 6) Seed your current recipes into the sheet
After deployment, open this URL in your browser once:

`YOUR_WEB_APP_URL?action=seed`

That imports the recipes already in your book into the sheet.

## 7) Push your site files to GitHub Pages
After you upload the updated site, both phones will load the same shared recipes.

## Note about camera auto-fill
Camera upload is wired in for adding a card image to the cloud.
Automatic OCR-to-text fill is not implemented yet.