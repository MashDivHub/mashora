@echo off
title Mashora - Full Stack
color 0E
echo.
echo  =============================================
echo   Mashora - Full Stack Launcher
echo  =============================================
echo.
echo  ERP Backend:     http://localhost:8001
echo  ERP Frontend:    http://localhost:3000
echo  Portal Backend:  http://localhost:8000
echo  Portal Frontend: http://localhost:8069
echo.
echo  Starting all services...
echo.

call "%~dp0start-erp.bat"
timeout /t 2 /nobreak >nul
call "%~dp0start-portal.bat"

echo.
echo  All services launched!
echo  Press any key to close this launcher...
pause >nul
