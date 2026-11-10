@echo off
:: Script de respaldo diario de PostgreSQL para Windows
:: Configurar en Programador de Tareas para ejecutar diariamente

setlocal

:: Configuración
set "DB_HOST=localhost"
set "DB_PORT=5432"
set "DB_USER=agua"
set "DB_PASSWORD=agua123"
set "DB_NAME=agua"
set "BACKUP_DIR=.\db_backups"
set "RETENTION_DAYS=30"

:: Crear directorio de respaldos si no existe
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: Nombre del archivo de respaldo con fecha
for /f "tokens=2 delims==" %%a in ('wmic OS get LocalDateTime /value 2^>nul') do set "datetime=%%a"
set "timestamp=%datetime:~0,8%%datetime:~8,6%"
set "BACKUP_FILE=%BACKUP_DIR%\agua_backup_%timestamp%.sql"
set "BACKUP_FILE_GZ=%BACKUP_FILE%.gz"

echo [%date% %time%] Iniciando respaldo de base de datos %DB_NAME%...

:: Exportar contraseña para pg_dump
set "PGPASSWORD=%DB_PASSWORD%"

:: Crear respaldo
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% > "%BACKUP_FILE%"

:: Comprimir respaldo (requiere gzip instalado)
:: gzip "%BACKUP_FILE%"

echo [%date% %time%] Respaldo creado: %BACKUP_FILE%

:: Eliminar respaldos antiguos (más de RETENTION_DAYS días)
forfiles /p "%BACKUP_DIR%" /m "agua_backup_*.sql" /d -%RETENTION_DAYS% /c "cmd /c del @path"

echo [%date% %time%] Respaldo completado y limpieza de archivos antiguos realizada.

:: Despejar variable de contraseña
set "PGPASSWORD="

endlocal
