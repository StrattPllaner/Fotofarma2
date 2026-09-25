#!/usr/bin/env bash
# Deja vivo el Asistente de Medicamentos en tres pasos.
#
#   bash proxy/desplegar.sh
#
# Hace todo lo automatizable: despliega el intermediario, guarda la llave como secreto,
# escribe la dirección en el código, recompila y sube el cambio. Lo único manual es
# entrar a Cloudflare (se abre el navegador) y pegar la llave cuando la pida.
#
# La llave NUNCA se escribe en un archivo del proyecto ni se imprime en pantalla.

set -euo pipefail

cd "$(dirname "$0")/.."          # raíz del proyecto
RAIZ="$PWD"
WRANGLER="npx --yes wrangler@4"

echo
echo "───────────────────────────────────────────────"
echo " FotoFarma · dejar vivo el asistente"
echo "───────────────────────────────────────────────"
echo

# ── 1. Cuenta de Cloudflare ───────────────────────────────────────────────────
if ! $WRANGLER whoami >/dev/null 2>&1 || $WRANGLER whoami 2>&1 | grep -q "not authenticated"; then
  echo "▸ Paso 1 de 4 · Entrar a Cloudflare"
  echo "  Se va a abrir tu navegador. Crea la cuenta (es gratis, sin tarjeta) o entra"
  echo "  con la tuya y dale «Allow». Luego regresa a esta ventana."
  echo
  $WRANGLER login
else
  echo "▸ Paso 1 de 4 · Ya tienes sesión en Cloudflare. Seguimos."
fi

# ── 2. Desplegar el intermediario ─────────────────────────────────────────────
echo
echo "▸ Paso 2 de 4 · Publicando el intermediario…"
cd "$RAIZ/proxy"
SALIDA="$($WRANGLER deploy 2>&1 | tee /dev/tty)"
URL="$(printf '%s\n' "$SALIDA" | grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev' | head -1)"

if [ -z "$URL" ]; then
  echo
  echo "✗ No pude leer la dirección del intermediario en la salida de arriba."
  echo "  Búscala a mano (termina en .workers.dev) y pégala en la constante"
  echo "  URL_INTERMEDIARIO de src/chatConfig.ts. Lo demás ya quedó."
  exit 1
fi
echo
echo "  Dirección del intermediario: $URL"

# ── 3. Guardar la llave como secreto ──────────────────────────────────────────
echo
echo "▸ Paso 3 de 4 · Guardar la llave de Gemini"
echo "  Consíguela en https://aistudio.google.com/app/apikey (usa un proyecto SIN"
echo "  facturación, para quedarte en la capa gratuita)."
echo "  Pégala cuando aparezca el cursor. No se va a ver en pantalla ni se guarda"
echo "  en ningún archivo del proyecto: vive solo dentro del intermediario."
echo
$WRANGLER secret put GEMINI_API_KEY

# ── 4. Conectar la app ────────────────────────────────────────────────────────
echo
echo "▸ Paso 4 de 4 · Conectando la app y publicándola…"
cd "$RAIZ"
ARCHIVO="src/chatConfig.ts"
python3 - "$ARCHIVO" "$URL" <<'PY'
import re, sys
archivo, url = sys.argv[1], sys.argv[2]
texto = open(archivo).read()
nuevo = re.sub(r"export const URL_INTERMEDIARIO = '[^']*';",
               f"export const URL_INTERMEDIARIO = '{url}';", texto, count=1)
if nuevo == texto:
    print("  (no encontré la constante; revísala a mano)")
open(archivo, 'w').write(nuevo)
PY

npm run build >/dev/null 2>&1 && echo "  Compilado sin errores."

if git diff --quiet -- "$ARCHIVO"; then
  echo "  Nada que subir."
else
  git add "$ARCHIVO"
  git commit -q -m "chore: conectar la app con el intermediario de IA"
  git push -q origin main && echo "  Cambio subido: GitHub publica la app en un minuto."
fi

# ── Comprobación ──────────────────────────────────────────────────────────────
echo
echo "▸ Comprobando que responda…"
if curl -s "$URL" | grep -q '/chat'; then
  echo "  ✓ El intermediario está vivo."
else
  echo "  ✗ No contestó. Espera un minuto y abre $URL en el navegador."
fi

echo
echo "Listo. Abre la app y busca la tarjeta «Pregunta sobre tus medicinas»,"
echo "junto al saludo de la pantalla de inicio."
echo
echo "De paso: ya puedes borrar el secreto VITE_GEMINI_API_KEY en GitHub"
echo "(Settings › Secrets and variables › Actions). La lectura de recetas"
echo "ahora pasa por el intermediario y la llave deja de viajar al navegador."
echo
