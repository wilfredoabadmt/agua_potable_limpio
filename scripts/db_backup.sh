#!/bin/bash
# Script de respaldo diario de PostgreSQL
# Configurar en crontab para ejecutar diariamente a las 2:00 AM:
# 0 2 * * * /ruta/al/script/db_backup.sh

set -e

# Configuración
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-agua}"
DB_PASSWORD="${DB_PASSWORD:-agua123}"
DB_NAME="${DB_NAME:-agua}"
BACKUP_DIR="${BACKUP_DIR:-./db_backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Crear directorio de respaldos si no existe
mkdir -p "$BACKUP_DIR"

# Nombre del archivo de respaldo con fecha
BACKUP_FILE="$BACKUP_DIR/agua_backup_$(date +%Y%m%d_%H%M%S).sql"
BACKUP_FILE_GZ="$BACKUP_FILE.gz"

echo "[$(date)] Iniciando respaldo de base de datos $DB_NAME..."

# Exportar contraseña para pg_dump
export PGPASSWORD="$DB_PASSWORD"

# Crear respaldo
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"

# Comprimir respaldo
gzip "$BACKUP_FILE"

echo "[$(date)] Respaldo creado: $BACKUP_FILE_GZ"

# Eliminar respaldos antiguos (más de RETENTION_DAYS días)
find "$BACKUP_DIR" -name "agua_backup_*.sql.gz" -type f -mtime +"$RETENTION_DAYS" -delete

echo "[$(date)] Respaldo completado y limpieza de archivos antiguos realizada."

# Despejar variable de contraseña
unset PGPASSWORD
