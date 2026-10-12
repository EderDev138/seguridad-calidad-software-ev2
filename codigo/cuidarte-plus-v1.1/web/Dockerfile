# =====================================================================
# Imagen de la SPA de Cuidarte+ — build multi-stage
#
# El resultado es un nginx que sirve archivos estaticos ya compilados: la
# imagen final no contiene Node, npm ni el codigo fuente, de modo que la
# superficie de ataque y el numero de CVE del contenedor son minimos
# (verificable con `trivy image`).
# =====================================================================

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.29-alpine AS runtime

# Configuracion propia: enrutado de SPA, proxy al backend y cabeceras de
# seguridad tambien en los archivos estaticos (NFR-SEG-10).
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:5173/ || exit 1
