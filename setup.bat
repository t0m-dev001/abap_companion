@echo off
setlocal enabledelayedexpansion
title BAPI v3 Setup
color 0A
echo.
echo  ============================================
echo   BAPI v3 ^— ABAP Companion
echo  ============================================
echo.
where node >nul 2>&1
if %errorlevel% neq 0 (echo  [ERROR] Node.js not found. Get it at nodejs.org & pause & exit /b 1)
for /f "tokens=*" %%i in ('node --version') do set NV=%%i
echo  [OK] Node.js !NV!
echo.
echo  [1/2] Installing dependencies...
call npm install
if %errorlevel% neq 0 (echo  [ERROR] npm install failed & pause & exit /b 1)
echo  [OK] Done
echo.
echo  ============================================
echo   A  ^>  Run now (dev mode)
echo   B  ^>  Build installer + portable .exe
echo   Q  ^>  Quit
echo  ============================================
echo.
set /p choice="  Choice (A/B/Q): "
if /i "!choice!"=="A" (
    echo. & npm start
) else if /i "!choice!"=="B" (
    echo.
    echo  Building... (a few minutes)
    set CSC_IDENTITY_AUTO_DISCOVERY=false
    set CSC_LINK=
    call npm run build
    if !errorlevel! equ 0 (
        echo.
        echo  ============================================
        echo   dist\BAPI-Setup-3.0.0.exe    ^<-- installer
        echo   dist\BAPI-Portable-3.0.0.exe ^<-- no install
        echo  ============================================
        set /p open="  Open dist folder? (y/n): "
        if /i "!open!"=="y" explorer dist
    ) else (
        echo  [ERROR] Build failed.
    )
    pause
)
