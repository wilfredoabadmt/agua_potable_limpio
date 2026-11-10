# Guía de Despliegue en VPS con HTTPS

Este documento describe los pasos para desplegar el Sistema de Cobro de Agua Potable en un VPS con HTTPS.

## Requisitos Previos

- VPS con Ubuntu 22.04+ o similar
- Docker y Docker Compose instalados
- Dominio propio apuntando a la IP del VPS
- Acceso root o con sudo

## Paso 1: Preparar el servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Instalar Docker Compose
sudo apt install -y docker-compose-plugin

# Agregar usuario al grupo docker
sudo usermod -aG docker $USER
newgrp docker
```

## Paso 2: Clonar el repositorio

```bash
git clone <tu-repositorio>
cd agua-potable
```

## Paso 3: Configurar variables de entorno

```bash
cp .env.production.example .env
nano .env
```

Configure al menos:
- `AUTH_SECRET`: Texto largo y aleatorio (mínimo 32 caracteres)
- `DB_PASSWORD`: Contraseña segura para PostgreSQL
- `COOKIE_SECURE=true` (requerido para HTTPS)

## Paso 4: Configurar SSL con Certbot

```bash
# Crear directorios para Certbot
mkdir -p certbot/conf certbot/www

# Obtener certificados (reemplazar tu-dominio.com)
docker run --rm -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --standalone \
  --email tu-email@dominio.com \
  --agree-tos \
  -d tu-dominio.com

# Actualizar nginx.conf con tu dominio
nano nginx.conf
# Reemplazar "tu-dominio.com" por tu dominio real
```

## Paso 5: Iniciar los servicios

```bash
# Usar el archivo de producción
docker-compose -f docker-compose.prod.yml up -d
```

## Paso 6: Inicializar la base de datos

```bash
# Ejecutar schema y seed dentro del contenedor de la app
docker exec -it agua-app npx tsx --env-file=.env scripts/init.ts
docker exec -it agua-app npx tsx --env-file=.env scripts/seed.ts
```

## Paso 7: Verificar el despliegue

- Acceder a: `https://tu-dominio.com`
- Probar login con usuarios de demostración
- Verificar que el estado de cuenta público funcione

## Usuarios de Demostración

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Administrador | admin@agua.bo | admin123 |
| Gerente | gerente@agua.bo | admin123 |
| Cajero | cajero@agua.bo | admin123 |
| Lector | lector@agua.bo | admin123 |
| Socio | socio@agua.bo | admin123 |

## Respaldos Diarios

Configurar en crontab:

```bash
# Editar crontab
crontab -e

# Agregar línea para respaldo diario a las 2:00 AM
0 2 * * * /ruta/al/agua-potable/scripts/db_backup.sh
```

## Mantenimiento

```bash
# Ver logs de la aplicación
docker logs -f agua-app

# Ver logs de la base de datos
docker logs -f agua-db

# Reiniciar servicios
docker-compose -f docker-compose.prod.yml restart

# Actualizar aplicación
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## Seguridad

1. Cambiar todas las contraseñas por defecto
2. Configurar firewall (ufw) para permitir solo puertos 80, 443, 22
3. `COOKIE_SECURE=true` solo con HTTPS activo
4. `AUTH_SECRET` debe ser único y largo
