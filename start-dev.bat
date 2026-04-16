@echo off
title Mashora Dev + Cloudflare Tunnel
color 0B
echo.
echo  =============================================
echo   Mashora Dev + Public Tunnel
echo  =============================================
echo.
echo  Local:
echo    Frontend:   http://localhost:3000
echo    Admin:      http://localhost:3000/admin
echo    Backend:    http://localhost:8001
echo    API Docs:   http://localhost:8001/docs
echo.
echo  Starting backend, frontend, and Cloudflare tunnel...
echo.

:: Start backend
start "Mashora Backend" cmd /k "cd /d %~dp0app\backend && pip install -r requirements.txt -q 2>nul && echo. && echo [Backend] Port 8001 && echo. && uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload"

timeout /t 4 /nobreak >nul

:: Start frontend
start "Mashora Frontend" cmd /k "cd /d %~dp0app\frontend && pnpm install --silent 2>nul && echo. && echo [Frontend] Port 3000 && echo. && pnpm dev"

timeout /t 5 /nobreak >nul

:: Start cloudflared tunnel — shows public URL in this window
echo.
echo  =============================================
echo   Cloudflare Tunnel starting...
echo   Share the https://*.trycloudflare.com link
echo   with your team to test remotely.
echo  =============================================
echo.
echo   Login: admin / admin
echo.
cloudflared tunnel --url http://localhost:3000

pause >nul
