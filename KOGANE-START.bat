@echo off
setlocal enabledelayedexpansion
title Kogane Restaurant Workstation POS - Turnkey Launcher
cd /d "%~dp0"

:: Set console code page to UTF-8 for crisp QR code block graphics
chcp 65001 >nul 2>&1

:: Ensure Bun in user profile is present in PATH for this session
if exist "%USERPROFILE%\.bun\bin\bun.exe" (
    set "PATH=%USERPROFILE%\.bun\bin;!PATH!"
)

echo ========================================================
echo   Kogane Restaurant Workstation POS - 1-Click Launch
echo ========================================================
echo.

:: 1. Check for compiled standalone binary (kogane.exe or kogane-launcher.exe)
if exist "kogane.exe" (
    echo [OK] Launching compiled Kogane binary (kogane.exe)...
    kogane.exe %*
    goto finish
)
if exist "kogane-launcher.exe" (
    echo [OK] Launching compiled Kogane binary (kogane-launcher.exe)...
    kogane-launcher.exe %*
    goto finish
)

:: 2. Check for Bun on PATH
where bun >nul 2>&1
if %errorLevel% equ 0 (
    echo [OK] Launching Kogane automation suite with Bun...
    bun run scripts/launcher.ts %*
    goto finish
)

:: 3. Check for Bun in user profile directory
if exist "%USERPROFILE%\.bun\bin\bun.exe" (
    echo [OK] Found Bun in user profile...
    "%USERPROFILE%\.bun\bin\bun.exe" run scripts/launcher.ts %*
    goto finish
)

:: 4. Bun is missing - Offer 1-click automated installer
echo [!] Bun runtime is not detected on your system.
echo     Bun is required to run the ultra-fast local SQLite and Nitro server.
echo.
set /p INSTALL_BUN="Would you like to install Bun now automatically? (Y/n): "
if /i "%INSTALL_BUN%"=="n" (
    echo.
    echo Please install Bun from https://bun.sh or compile kogane.exe to run.
    pause
    exit /b 1
)

echo.
echo Installing Bun via official Windows installer...
powershell -NoProfile -Command "irm bun.sh/install.ps1 | iex"
if exist "%USERPROFILE%\.bun\bin\bun.exe" (
    echo [SUCCESS] Bun installed successfully!
    "%USERPROFILE%\.bun\bin\bun.exe" run scripts/launcher.ts %*
) else (
    echo [ERROR] Installation failed. Please visit https://bun.sh and install manually.
    pause
    exit /b 1
)

:finish
if %errorLevel% neq 0 (
    echo.
    echo Launcher exited with code %errorLevel%.
    pause
)
