# Campus Lost and Found

A small Ionic Angular app and a PHP API for reporting items found on campus. Students and staff can list reports, post a new one with a photo and a map pin, and open a report to see where it was found.

## Requirements

- Laragon, or another PHP 8 and MySQL setup
- Node.js 22 and the Ionic CLI
- Android Studio, only if you are building the APK

## Database

1. Start MySQL.
2. Import `sql/found_items.sql` in HeidiSQL or phpMyAdmin. It creates the `campus_lost_found` database, the `found_items` table, and the sample rows.
3. Set `DB_USER` and `DB_PASS` in `api/config.php` to your MySQL account.

## API

Open:

`http://localhost/campus-lost-found/api/items.php`

That address lists the sample items. Use GET for the list and POST with JSON to add one.

## Public host

Anyone on the internet can open a public copy of this API, so a few limits are already in place:

- Reading the list does not need a key. Posting a report, and looking up a place name, send the `X-Api-Key` header.
- Set `API_KEY` in `api/config.php` to a long random value, and put that same value in `apiKey` in `mobile/src/environments/environment.ts` and `environment.prod.ts`. Then rebuild the app.
- Set `APP_BASE_URL` in `api/config.php` to the public site, such as `https://your-site.com`, and point `apiUrl` at `https://your-site.com/api/items.php`.
- Change `DB_USER` and `DB_PASS` to the host's database account.
- A person can post 8 reports every 10 minutes from one address. Photos must be a real JPG, PNG, or WEBP, and files in `uploads` cannot run as PHP.

The key is inside the app, so it stops casual bots. It does not stop someone who takes the key out of the installed app.

Laragon's document root may still be another project. An Apache alias at `C:\laragon\etc\apache2\alias\campus-lost-found.conf` keeps this folder available at that URL. Restart Laragon if the address returns a 404.

## App

```bash
cd mobile
npm install
ionic serve
```

The dev app calls `http://localhost/campus-lost-found/api/items.php` from `src/environments/environment.ts`.

## Android

The project is already under `mobile/android`. Cleartext HTTP is allowed so the app can call the local API. Camera and location permissions are in `AndroidManifest.xml`.

Before building an APK that runs on a phone:

1. Put the computer's address in `apiUrl` inside `mobile/src/environments/environment.prod.ts`.
   Use the address of this computer on the shared network, not `localhost`.
2. The phone and the PC must be on the same network, and Laragon must be running.
3. From `mobile`:

```bash
npm run build
npx cap sync android
```

4. Open `mobile/android` in Android Studio and run the app.

`localhost` on the phone is the phone itself, not this PC.

## Scope

The app lists items and posts a new report. Marking an item as claimed is not built yet.
