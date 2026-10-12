# =====================================================================
# Imagen de la API de Cuidarte+ — build multi-stage
#
# Controles de seguridad del contenedor:
#  * Imagen base alpine minima -> menos paquetes = menos CVE (verificable con
#    `trivy image`).
#  * `npm ci --omit=dev` -> las dependencias de desarrollo no llegan al runtime.
#  * Usuario NO root -> una ejecucion de codigo arbitrario no obtiene root en
#    el contenedor.
#  * HEALTHCHECK -> soporta el objetivo de disponibilidad (NFR-DIS-1/3).
#  * dumb-init como PID 1 -> propaga SIGTERM para el apagado ordenado
#    (NFR-DIS-2, ventana de mantenimiento).
# =====================================================================

FROM node:24-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache dumb-init \
    && addgroup -S cuidarte && adduser -S cuidarte -G cuidarte

COPY --from=dependencias /app/node_modules ./node_modules
COPY --chown=cuidarte:cuidarte package.json ./
COPY --chown=cuidarte:cuidarte src ./src

# El storage de documentos debe pertenecer al usuario de la aplicacion.
RUN mkdir -p /app/storage-documentos && chown -R cuidarte:cuidarte /app/storage-documentos

ENV NODE_ENV=production \
    PORT=3000 \
    STORAGE_DIR=/app/storage-documentos

USER cuidarte
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/v1/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
