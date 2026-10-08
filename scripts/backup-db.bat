@echo off
cd /d "%~dp0\.."
echo ========================================================
echo   Kogane - Creating Daily Safe Database Backup
echo ========================================================
echo.
bun run scripts/backup-db.ts
if %errorLevel% equ 0 (
    echo.
    echo [SUCCESS] Database backup completed.
) else (
    echo.
    echo [ERROR] Backup failed.
)
echo.
pause
