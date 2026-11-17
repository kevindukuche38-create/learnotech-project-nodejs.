# Learnotech Solutions website (JavaScript)

This complete website uses Node.js and its built-in SQLite database. The Admin dashboard can create, edit and remove adverts and accessories, including uploading photos. No Supabase account, Java, Maven or npm packages are required.

## Run on Windows

1. Install Node.js 22.5 or newer.
2. Double-click `start-website.bat` in this folder.
3. Open `http://localhost:8080` for the website or `http://localhost:8080/admin` for Admin.
4. Default Admin sign-in: username `Kevin`, password `12345678`.

## Data and photos

The SQLite database and uploaded photos are stored in the `data` folder (`data/learnotech.sqlite` and `data/uploads`). Keep and back up this folder. The Admin session expires after 12 hours or when the server restarts.

## Deploy with Docker

Build and run the provided Dockerfile, expose port 8080, and mount a persistent disk or named volume at `/app/data`. Set `LEARNOTECH_ADMIN_USERNAME` and `LEARNOTECH_ADMIN_PASSWORD` to private values before deployment. The container serves the website and Admin from the same address.

## Deploy on cPanel

The hosting plan must provide Node.js 22.5 or newer, allow a persistent writable data folder, and let the Node app listen on the port assigned by cPanel. Upload this entire folder, set the two Admin environment variables, configure the app entry point as `server.js`, and start it using `npm start`. cPanel Node.js availability depends on the hosting provider. A static-only hosting plan cannot run the Admin database and upload API.

## Local configuration

`PORT` sets the listening port (defaults to `8080`). `DATA_DIR` sets where SQLite and photos are saved. `DATABASE_FILE` can override the SQLite file location. Set Admin credentials with `LEARNOTECH_ADMIN_USERNAME` and `LEARNOTECH_ADMIN_PASSWORD`.
