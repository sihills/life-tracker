# Life Tracker

A phone-first, local-first Progressive Web App (PWA).

## What it does
- Tracks money spent and money saved through alternatives
- Tracks water, fruit, vegetables, exercise, mood, reading, guitar and any custom activity
- Lets you add, edit, reorder and hide trackers
- Stores data locally in the browser on your device
- Exports a full JSON backup
- Restores from JSON backup
- Exports CSV for Excel / Google Sheets
- Works offline after the first successful load
- Can be installed to an Android home screen

## Important data note
The app stores its live data in browser localStorage on the device. The web host serves only the app files; your entries are not uploaded by this app.

Because local browser data can be lost if you clear site data, uninstall/reset the browser, or lose the device, use "Export full backup" regularly.

## Free deployment options

### Option A: GitHub Pages
Upload these files to a repository and enable Pages in repository Settings > Pages.

### Option B: Cloudflare Pages
Create a Pages project and upload/deploy this folder as a static site.

The PWA should be served over HTTPS for installation and service-worker/offline support.

## Android installation
1. Open the hosted site in Chrome.
2. Use the app's Install button if shown, or Chrome menu > Add to Home screen / Install app.
3. Launch Life Tracker from the home-screen icon.

## Files
- index.html — app structure
- styles.css — phone-first styling
- app.js — tracking, local storage, custom trackers, backup/export
- manifest.webmanifest — install metadata
- sw.js — offline cache
- icon-192.png / icon-512.png — app icons
