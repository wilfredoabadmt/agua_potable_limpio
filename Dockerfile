# Dockerfile multi-stage para producción - Sistema de Cobro de Agua Potable
# Etapa 1: Build de la aplicación Next.js
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package.json package-lock.json ./

# Instalar dependencias (incluyendo devDependencies para el build)
RUN npm ci --legacy-peer-deps

# Copiar código fuente
COPY . .

# Construir la aplicación para producción
ENV NODE_ENV=production
RUN npm run build

# Etapa 2: Imagen de producción ligera
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Crear usuario no-root para seguridad
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar solo lo necesario del builder
RUN mkdir -p ./public
COPY --from=builder /app/public* ./public/
COPY --from=builder /app/.next/standalone ./.next/standalone
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/db ./db
COPY --from=builder /app/scripts ./scripts

# Cambiar ownership al usuario no-root
RUN chown -R nextjs:nodejs /app
USER nextjs

# Exponer puerto
EXPOSE 3000

# Comando de inicio con auto-migración
CMD ["node", "-e", "require('./scripts/auto-init.js'); require('./.next/standalone/server.js');"]
