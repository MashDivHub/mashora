@echo off
title Mashora App
color 0A
echo.
echo  =============================================
echo   Mashora App - FastAPI + SQLAlchemy 2.0
echo  =============================================
echo.
echo  Backend:  http://localhost:8001
echo  API Docs: http://localhost:8001/docs
echo  Frontend: http://localhost:3000
echo.
echo  Starting backend and frontend...
echo.

:: Start backend in a new window
start "App Backend (port 8001)" cmd /k "cd /d %~dp0app\backend && pip install -r requirements.txt -q 2>nul && echo. && echo [App Backend] Starting on port 8001... && echo. && uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload"

:: Wait a moment for backend to initialize
timeout /t 3 /nobreak >nul

:: Start frontend in a new window
start "App Frontend (port 3000)" cmd /k "cd /d %~dp0app\frontend && npm install --silent 2>nul && echo. && echo [App Frontend] Starting on port 3000... && echo. && npm run dev"

echo.
echo  Both services starting in separate windows.
echo  Press any key to close this launcher...
pause >nul
