# Intermediario de disponibilidad (Cloudflare Worker)

Farmacias Similares y Benavides no permiten que el navegador consulte sus catálogos
directamente (CORS). Este worker lee sus catálogos y sucursales públicos y los
devuelve a la app. Farmacias del Ahorro no lo necesita: la app la consulta directo.

El mismo worker aloja el **análisis de recetas con IA (Gemini)**, porque GitHub Pages
es hosting estático y no puede correr el servidor Express (`server.ts`). Así la
`GEMINI_API_KEY` queda como secreto del worker y nunca se expone en el frontend público.

Rutas:
- `/api/analyze-prescription` (POST `{ image }`) — extrae medicamentos de la foto de la receta con Gemini
- `/api/security-audit` (POST `{ newMeds, historyMeds }`) — auditoría de interacciones medicamentosas
- `/similares/buscar?q=amoxicilina` — productos, precio y existencia en línea
- `/similares/sucursales?lat=18.92&lon=-99.23&sku=559` — sucursales cercanas y si pueden surtir el producto
- `/benavides/buscar?q=amoxicilina` — productos, precio y existencia en línea

Probar en la Mac: `node proxy/dev-server.mjs` (queda en http://localhost:8787)
y compilar la app con `VITE_PROXY_URL=http://localhost:8787 npm run build`.

## Desplegar (gratis, una vez)

1. `npx wrangler login` (abre el navegador para entrar o crear la cuenta de Cloudflare)
2. Guardar la llave de Gemini como **secreto** del worker (se pega cuando lo pida; no queda en el código):
   ```
   cd proxy && npx wrangler secret put GEMINI_API_KEY
   ```
   La llave se consigue en https://aistudio.google.com/app/apikey
3. Desplegar: `npx wrangler deploy`
4. Copiar la URL que imprime (`https://fotofarma-proxy.<cuenta>.workers.dev`) y ponerla como
   **variable del repositorio** en GitHub para que el frontend la use al compilar:
   `Settings > Secrets and variables > Actions > Variables > New repository variable`
   - Nombre: `VITE_PROXY_URL`  ·  Valor: la URL del worker
5. Volver a lanzar el deploy (haz un push a `main` o re-ejecuta el workflow). Listo:
   la cámara → análisis con IA ya funciona en producción.

> Para actualizar la llave más adelante, repite el paso 2 y vuelve a `wrangler deploy`.
