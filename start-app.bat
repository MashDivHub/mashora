@echo off
title Mashora App
color 0A
echo.
echo  =============================================
echo   Mashora App - FastAPI + React
echo  =============================================
echo.
echo  Backend:    http://localhost:8001
echo  Frontend:   http://localhost:3000
echo  Admin:      http://localhost:3000/admin
echo  API Docs:   http://localhost:8001/docs
echo.

:: Start backend
start "Mashora Backend" cmd /k "cd /d %~dp0app\backend && pip install -r requirements.txt -q 2>nul && echo. && echo [Backend] Starting on port 8001... && echo. && uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload"

timeout /t 4 /nobreak >nul

:: Start frontend
start "Mashora Frontend" cmd /k "cd /d %~dp0app\frontend && pnpm install --silent 2>nul && echo. && echo [Frontend] Starting on port 3000... && echo. && pnpm dev"

echo.
echo  Backend + Frontend starting in separate windows.
echo  Press any key to close this launcher...
pause >nul
