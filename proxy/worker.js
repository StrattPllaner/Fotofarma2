// Intermediario de FotoMed+ para consultar disponibilidad en cadenas de farmacias.
// Solo lee catálogos y sucursales públicos de sus tiendas en línea; no vende nada.
// Existe porque Similares y Benavides no permiten llamadas directas desde el navegador (CORS).
// Despliegue: Cloudflare Workers (gratis) — ver proxy/README.md

import { PROMPT_SISTEMA, contextoMedicamentos } from './chat-prompt.js';

const UA = 'Mozilla/5.0 (FotoMed+; +https://strattpllaner.github.io/Fotofarma2/)';

// --- Asistente de Medicamentos -------------------------------------------------
// La llave de Gemini vive aquí, como secreto del Worker: nunca viaja al navegador.
// Las conversaciones NO se guardan ni se registran en ningún lado.

const MODELO_CHAT = 'gemini-3.5-flash-lite';

const ORIGENES = [
  'https://strattpllaner.github.io',
  'http://localhost:4173',
  'http://localhost:5173',
  'http://localhost:3000',
];

const LIMITES = {
  caracteresPorMensaje: 1000,
  mensajesDeHistorial: 12,
  cuerpo: 24000,          // bytes del cuerpo de la petición
  porIP: 20,              // preguntas permitidas…
  ventanaMs: 10 * 60_000, // …en esta ventana de tiempo
  tokensDeSalida: 320,    // respuestas cortas: así lo pide el prompt y así se controla el costo
};

// Conteo por IP en memoria del isolate. Es aproximado a propósito: no guardamos nada
// en disco ni en una base de datos, solo frenamos ráfagas.
const visitas = new Map();

const dentroDelLimite = (ip) => {
  const ahora = Date.now();
  const previas = (visitas.get(ip) || []).filter(t => ahora - t < LIMITES.ventanaMs);
  if (previas.length >= LIMITES.porIP) { visitas.set(ip, previas); return false; }
  previas.push(ahora);
  visitas.set(ip, previas);
  if (visitas.size > 5000) visitas.clear();
  return true;
};

const cors = (origen) => ({
  'Access-Control-Allow-Origin': ORIGENES.includes(origen) ? origen : ORIGENES[0],
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
});

const errorChat = (clave, status, origen) =>
  new Response(JSON.stringify({ error: clave }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(origen) },
  });

async function chat(request, env, origen) {
  if (request.method !== 'POST') return errorChat('metodo', 405, origen);
  if (!env.GEMINI_API_KEY) return errorChat('sin_llave', 503, origen);

  const ip = request.headers.get('CF-Connecting-IP') || 'desconocida';
  if (!dentroDelLimite(ip)) return errorChat('demasiadas', 429, origen);

  const crudo = await request.text();
  if (crudo.length > LIMITES.cuerpo) return errorChat('muy_largo', 413, origen);

  let datos;
  try { datos = JSON.parse(crudo); } catch { return errorChat('formato', 400, origen); }

  const mensajes = Array.isArray(datos?.mensajes) ? datos.mensajes : [];
  if (mensajes.length === 0) return errorChat('vacio', 400, origen);
  if (mensajes.some(m => typeof m?.texto !== 'string' || m.texto.length > LIMITES.caracteresPorMensaje)) {
    return errorChat('muy_largo', 413, origen);
  }

  const contents = mensajes
    .slice(-LIMITES.mensajesDeHistorial)
    .map(m => ({
      role: m.rol === 'bot' ? 'model' : 'user',
      parts: [{ text: m.texto.slice(0, LIMITES.caracteresPorMensaje) }],
    }));

  const instruccion = PROMPT_SISTEMA + contextoMedicamentos(datos?.medicamentos);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.MODELO_CHAT || MODELO_CHAT}:streamGenerateContent?alt=sse`;
  const respuesta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: instruccion }] },
      generationConfig: { maxOutputTokens: LIMITES.tokensDeSalida, temperature: 0.3, topP: 0.9 },
    }),
  });

  if (!respuesta.ok || !respuesta.body) {
    // No registramos el cuerpo de la conversación; solo el código del proveedor.
    console.log('chat: proveedor respondió', respuesta.status);
    return errorChat(respuesta.status === 429 ? 'cuota' : 'proveedor', 502, origen);
  }

  // Gemini manda eventos SSE con JSON; aquí se convierten en texto plano en streaming.
  const salida = new TransformStream({
    start() { this.resto = ''; },
    transform(trozo, control) {
      this.resto += new TextDecoder().decode(trozo, { stream: true });
      const lineas = this.resto.split('\n');
      this.resto = lineas.pop() || '';
      for (const linea of lineas) {
        if (!linea.startsWith('data:')) continue;
        const cuerpo = linea.slice(5).trim();
        if (!cuerpo || cuerpo === '[DONE]') continue;
        try {
          const j = JSON.parse(cuerpo);
          const texto = j?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
          if (texto) control.enqueue(new TextEncoder().encode(texto));
        } catch { /* trozo incompleto: se ignora */ }
      }
    },
  });

  return new Response(respuesta.body.pipeThrough(salida), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
      ...cors(origen),
    },
  });
}

const SIMILARES = 'https://www.farmaciasdesimilares.com';
const BENAVIDES = 'https://www.benavides.com.mx';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  });

const get = async (url) => {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok && r.status !== 206) throw new Error(`${url} -> ${r.status}`);
  return r.json();
};

const norm = (s) => String(s || '').toUpperCase().replace(/[_\s]+/g, ' ').trim();

// --- Farmacias Similares (VTEX) ---
async function similaresBuscar(q) {
  const data = await get(`${SIMILARES}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(q)}&_from=0&_to=2`);
  return data.map((p) => {
    const it = p.items?.[0] || {};
    const oferta = it.sellers?.[0]?.commertialOffer || {};
    return {
      id: it.itemId,
      nombre: p.productName,
      precio: oferta.Price ?? null,
      disponible: (oferta.AvailableQuantity || 0) > 0,
      imagen: it.images?.[0]?.imageUrl || null,
      url: `${SIMILARES}/${p.linkText}/p`,
    };
  });
}

async function similaresSucursales(lat, lon, sku) {
  const puntos = await get(`${SIMILARES}/api/checkout/pub/pickup-points?geoCoordinates=${lon};${lat}`);
  const sucursales = (puntos.items || []).slice(0, 12).map((i) => {
    const p = i.pickupPoint;
    const a = p.address || {};
    return {
      id: p.id,
      nombre: p.friendlyName,
      direccion: [[a.street, a.number].filter(Boolean).join(' '), a.neighborhood, a.city].filter(Boolean).join(', '),
      estado: a.state,
      lat: a.geoCoordinates?.[1],
      lon: a.geoCoordinates?.[0],
      distanciaKm: i.distance,
      horario: p.businessHours || [],
      surte: null,
    };
  });
  if (sku) {
    // Simulación de pedido: la tienda responde qué sucursales cercanas pueden surtir el producto
    const r = await fetch(`${SIMILARES}/api/checkout/pub/orderForms/simulation?sc=1`, {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ items: [{ id: String(sku), quantity: 1, seller: '1' }], country: 'MEX', geoCoordinates: [Number(lon), Number(lat)] }),
    });
    if (r.ok) {
      const sim = await r.json();
      const pueden = new Set();
      for (const li of sim.logisticsInfo || []) {
        for (const sla of li.slas || []) {
          // Ej. "EXPRESS 2_CUERNAVACA_1" -> "CUERNAVACA 1"
          pueden.add(norm(String(sla.id).replace(/^.*?\d+_/, '')));
          if (sla.pickupStoreInfo?.friendlyName) pueden.add(norm(sla.pickupStoreInfo.friendlyName));
        }
      }
      for (const s of sucursales) s.surte = pueden.has(norm(s.nombre));
    }
  }
  return sucursales;
}

// --- Benavides (Magento GraphQL) ---
async function benavidesBuscar(q) {
  const query = `{ products(search: ${JSON.stringify(q)}, pageSize: 3) { items { name sku stock_status url_key url_suffix small_image { url } price_range { minimum_price { final_price { value } } } } } }`;
  const r = await fetch(`${BENAVIDES}/graphql`, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query }),
  });
  const d = await r.json();
  return (d.data?.products?.items || []).map((p) => ({
    id: p.sku,
    nombre: p.name,
    precio: p.price_range?.minimum_price?.final_price?.value ?? null,
    disponible: p.stock_status === 'IN_STOCK',
    imagen: p.small_image?.url || null,
    url: `${BENAVIDES}/${p.url_key}${p.url_suffix || '.html'}`,
  }));
}

// La lectura de recetas puede pasar por el mismo intermediario: así la llave sale del
// navegador. Recibe el cuerpo tal cual lo arma la app (contents + config) y devuelve texto.
async function ia(request, env, origen) {
  if (request.method !== 'POST') return errorChat('metodo', 405, origen);
  if (!env.GEMINI_API_KEY) return errorChat('sin_llave', 503, origen);

  const ip = request.headers.get('CF-Connecting-IP') || 'desconocida';
  if (!dentroDelLimite(ip)) return errorChat('demasiadas', 429, origen);

  const crudo = await request.text();
  if (crudo.length > 6_000_000) return errorChat('muy_largo', 413, origen);

  let datos;
  try { datos = JSON.parse(crudo); } catch { return errorChat('formato', 400, origen); }
  if (!Array.isArray(datos?.contents)) return errorChat('formato', 400, origen);

  const modelo = String(datos.model || env.MODELO_RECETAS || 'gemini-3-flash-preview').replace(/[^a-z0-9.\-]/gi, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:streamGenerateContent?alt=sse`;
  const respuesta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: datos.contents,
      ...(datos.config ? { generationConfig: datos.config } : {}),
    }),
  });

  if (!respuesta.ok || !respuesta.body) {
    console.log('ia: proveedor respondió', respuesta.status);
    return errorChat(respuesta.status === 429 ? 'cuota' : 'proveedor', 502, origen);
  }

  let texto = '';
  const lector = respuesta.body.getReader();
  const dec = new TextDecoder();
  let resto = '';
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    resto += dec.decode(value, { stream: true });
    const lineas = resto.split('\n');
    resto = lineas.pop() || '';
    for (const linea of lineas) {
      if (!linea.startsWith('data:')) continue;
      const cuerpo = linea.slice(5).trim();
      if (!cuerpo || cuerpo === '[DONE]') continue;
      try {
        const j = JSON.parse(cuerpo);
        texto += j?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      } catch { /* trozo incompleto */ }
    }
  }

  return new Response(JSON.stringify({ texto }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(origen) },
  });
}

async function manejar(request, env) {
  const url = new URL(request.url);
  const origen = request.headers.get('Origin') || '';

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origen) });
  if (url.pathname === '/chat') return chat(request, env, origen);
  if (url.pathname === '/ia') return ia(request, env, origen);

  const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
  try {
    switch (url.pathname) {
      case '/similares/buscar':
        return json(q ? await similaresBuscar(q) : []);
      case '/similares/sucursales': {
        const lat = parseFloat(url.searchParams.get('lat'));
        const lon = parseFloat(url.searchParams.get('lon'));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return json({ error: 'lat/lon requeridos' }, 400);
        return json(await similaresSucursales(lat, lon, url.searchParams.get('sku')));
      }
      case '/benavides/buscar':
        return json(q ? await benavidesBuscar(q) : []);
      default:
        return json({ ok: true, rutas: ['/chat (POST)', '/ia (POST)', '/similares/buscar?q=', '/similares/sucursales?lat=&lon=&sku=', '/benavides/buscar?q='] });
    }
  } catch (err) {
    return json({ error: String(err?.message || err) }, 502);
  }
}

export default { fetch: manejar };
