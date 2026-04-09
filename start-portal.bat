@echo off
title Mashora Portal
color 0B
echo.
echo  =============================================
echo   Mashora Portal - SaaS Platform
echo  =============================================
echo.
echo  Backend:  http://localhost:8000
echo  API Docs: http://localhost:8000/docs
echo  Frontend: http://localhost:8069
echo.
echo  Starting backend and frontend...
echo.

:: Start backend in a new window
start "Portal Backend (port 8000)" cmd /k "cd /d %~dp0portal\backend && pip install -r requirements.txt -q 2>nul && echo. && echo [Portal Backend] Starting on port 8000... && echo. && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Wait a moment for backend to initialize
timeout /t 3 /nobreak >nul

:: Start frontend in a new window
start "Portal Frontend (port 8069)" cmd /k "cd /d %~dp0portal\frontend && npm install --silent 2>nul && echo. && echo [Portal Frontend] Starting on port 8069... && echo. && npm run dev"

echo.
echo  Both services starting in separate windows.
echo  Press any key to close this launcher...
pause >nul
