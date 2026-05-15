@echo off
REM Start Savant AI locally on Windows

IF NOT EXIST "node_modules" (
    echo node_modules not found. Installing dependencies...
    npm install
    if ERRORLEVEL 1 (
        echo Failed to install dependencies. Please fix the errors and try again.
        pause
        exit /b 1
    )
)

echo Starting Savant AI...
start "" "http://localhost:3000"
npm start
