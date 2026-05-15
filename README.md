# Savant AI

This project includes a lightweight local Node.js proxy backend to avoid browser CORS issues and keep API keys off the frontend.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file:

```bash
# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

3. Fill in `SILICONFLOW_API_KEY` in the new `.env` file.

4. Start the server:

```bash
npm start
```

5. Open the app in your browser:

```text
http://localhost:3000
```

### Windows shortcut

Double-click `start-savant.bat` to install dependencies if needed, start the app, and open `http://localhost:3000` in your default browser.

Keep the terminal window open while using the app. Close the terminal or press `Ctrl+C` to stop the server.

## Notes

- The frontend now calls `/api/chat` instead of calling OpenAI directly.
- The `.env` file is ignored by `.gitignore`.
- The UI and styling were not changed.
