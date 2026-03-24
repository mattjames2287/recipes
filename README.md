# Bari Family Cook Book

This version adds:

- shared cloud-sync support through Google Sheets + Apps Script
- search bar
- tag filters
- tag support on recipes
- camera upload field in the add form
- starter tags added to the current recipes

## Files added
- `apps-script/Code.gs`
- `apps-script/SETUP.md`

## Important
Cloud sync is off until you paste your deployed Apps Script web app URL into `app.js`.

Find:
`const CLOUD_ENDPOINT = "";`

Then follow the setup guide in `apps-script/SETUP.md`.