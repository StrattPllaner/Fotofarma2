# Intermediario de disponibilidad (Cloudflare Worker)

Farmacias Similares y Benavides no permiten que el navegador consulte sus catálogos
directamente (CORS). Este worker lee sus catálogos y sucursales públicos y los
devuelve a la app. Farmacias del Ahorro no lo necesita: la app la consulta directo.

Rutas:
- `/similares/buscar?q=amoxicilina` — productos, precio y existencia en línea
- `/similares/sucursales?lat=18.92&lon=-99.23&sku=559` — sucursales cercanas y si pueden surtir el producto
- `/benavides/buscar?q=amoxicilina` — productos, precio y existencia en línea

Probar en la Mac: `node proxy/dev-server.mjs` (queda en http://localhost:8787)
y compilar la app con `VITE_PROXY_URL=http://localhost:8787 npm run build`.

Desplegar (gratis, una vez):
1. `npx wrangler login` (abre el navegador para entrar o crear la cuenta de Cloudflare)
2. `cd proxy && npx wrangler deploy`
3. Poner la URL que imprime (`https://fotofarma-proxy.<cuenta>.workers.dev`) en `PROXY_URL` de `src/App.tsx`.
