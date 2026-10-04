# Life Tracker — version 2

A phone-first, local-first Progressive Web App (PWA).

## Version 2 adds
- Tracker categories: Money, Health, Exercise, Wellbeing, Learning, Hobbies and Other
- Custom trackers now contribute correctly to category analysis
- Optional daily targets
- Choice of one-tap logging or asking for an amount each time
- Settings tab
- Configurable currency
- Monday or Sunday week start
- System / light / dark appearance
- Option to group the Today screen by category
- Four configurable headline cards
- Existing version-1 local data is migrated automatically because the storage key is unchanged

## Core features
- Tracks money spent and money saved through alternatives
- Tracks water, fruit, vegetables, exercise, mood, learning, reading, guitar and custom activities
- Add, edit, reorder, hide and delete trackers
- Stores live data locally in the browser on your device
- Full JSON backup and restore
- CSV export for Excel / Google Sheets
- Offline support after first successful load
- Installable on Android home screen

## Updating the existing GitHub Pages app
Replace the existing repository files with the files in this package and commit them to the same `main` branch. Do not change the GitHub Pages URL if you want the browser's existing local data to remain associated with the same site.

After GitHub Pages finishes deploying, reload the site. The service worker cache is versioned as `life-tracker-v2` so the new files replace the old offline cache.

## Important data note
Live tracking data is stored in browser localStorage on the device. The web host serves only the app files; entries are not uploaded by this app.

Because browser data can be lost if site data is cleared or the device is lost, use **Data → Export full backup** regularly.
