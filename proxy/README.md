# Intermediario de FotoFarma (Cloudflare Worker)

Hace dos trabajos:

1. **`POST /chat`** — el Asistente de Medicamentos. Aquí vive la llave de Gemini, como
   secreto del worker: nunca viaja al navegador. Las conversaciones **no se guardan** ni
   se registran; solo se anota el código de error del proveedor si algo falla.
2. **`POST /ia`** — lectura de recetas. Si la app se compila con `VITE_IA_URL`, el
   análisis de recetas pasa por aquí y la llave deja de ir en el bundle público.
3. Consulta de catálogos de farmacias (lo de abajo).

## Cómo se protege

- Solo acepta peticiones desde los orígenes de la app (`strattpllaner.github.io` y localhost).
- Máximo 20 preguntas cada 10 minutos por dirección IP.
- Máximo 1,000 caracteres por mensaje y 12 mensajes de historial.
- Respuestas limitadas a 320 tokens, que es lo que pide el prompt: contestar corto.
- El prompt de sistema está en `chat-prompt.js`, para editarlo sin tocar el worker.

## Probar en tu computadora

```bash
cp proxy/.dev.vars.example proxy/.dev.vars   # y pega ahí tu llave
cd proxy && npx wrangler dev                 # queda en http://localhost:8787
# en otra terminal:
VITE_IA_URL=http://localhost:8787 npm run build && npm run preview
```

## Desplegar

Un solo comando desde la raíz del proyecto:

```bash
bash proxy/desplegar.sh
```

Hace todo: entra a Cloudflare (abre el navegador), publica el worker, guarda la llave como
secreto, escribe la dirección en `src/chatConfig.ts`, recompila, sube el cambio y comprueba
que responda. Lo único manual es autorizar en el navegador y pegar la llave cuando la pida;
la llave no se escribe en ningún archivo del proyecto.

A mano, si prefieres:

```bash
npx wrangler login                        # una sola vez, abre el navegador
cd proxy && npx wrangler deploy           # imprime la URL del worker
npx wrangler secret put GEMINI_API_KEY    # pega la llave cuando la pida
# y pon esa URL en URL_INTERMEDIARIO de src/chatConfig.ts
```

Con eso el chatbot queda vivo y la lectura de recetas deja de usar la llave del navegador:
entonces ya puedes borrar el secreto `VITE_GEMINI_API_KEY` en GitHub.

---

## Consulta de disponibilidad en cadenas

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
