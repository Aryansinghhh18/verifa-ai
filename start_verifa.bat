@echo off
title VeriFA AI - Launcher
echo ========================================================
echo               VeriFA AI Local Launcher
echo ========================================================
echo.
echo [1/2] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "VeriFA AI - Backend (Port 8000)" cmd /k "cd /d %~dp0backend && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000"

echo [2/2] Starting Vite Frontend on http://127.0.0.1:5173 ...
set "PATH=C:\Users\Anand\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.19.0-win-x64;%PATH%"
start "VeriFA AI - Frontend (Port 5173)" cmd /k "cd /d %~dp0frontend && npm run dev -- --host 127.0.0.1"

echo.
echo ========================================================
echo Both servers have been launched in separate windows!
echo - Backend API: http://127.0.0.1:8000
echo - Frontend UI: http://127.0.0.1:5173
echo.
echo Opening VeriFA AI in your default browser...
echo ========================================================
timeout /t 4 >nul
start http://127.0.0.1:5173/login
