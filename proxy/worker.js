// Intermediario de FotoFarma para consultar disponibilidad en cadenas de farmacias.
// Solo lee catálogos y sucursales públicos de sus tiendas en línea; no vende nada.
// Existe porque Similares y Benavides no permiten llamadas directas desde el navegador (CORS).
// Despliegue: Cloudflare Workers (gratis) — ver proxy/README.md

const UA = 'Mozilla/5.0 (FotoFarma; +https://strattpllaner.github.io/Fotofarma2/)';
const SIMILARES = 'https://www.farmaciasdesimilares.com';
const BENAVIDES = 'https://www.benavides.com.mx';

// Cabeceras CORS: el navegador (GitHub Pages) hace una petición previa (preflight)
// OPTIONS antes de cada POST con JSON. Sin esto, el análisis con IA falla en producción.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      ...CORS,
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

// --- Gemini (análisis de recetas con IA) ---
// La API key vive como secreto del Worker (wrangler secret put GEMINI_API_KEY),
// nunca se expone en el frontend público de GitHub Pages.
const GEMINI_MODEL = 'gemini-3-flash-preview';

async function geminiGenerar(env, body) {
  const key = env && env.GEMINI_API_KEY;
  if (!key) throw new Error('El Worker no tiene configurada GEMINI_API_KEY (usa: wrangler secret put GEMINI_API_KEY).');

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Gemini respondió ${r.status}`);

  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!text) throw new Error('La IA no devolvió una respuesta legible.');
  return JSON.parse(text);
}

async function analizarReceta(env, imageDataUrl) {
  if (!imageDataUrl) throw new Error('No se recibió ninguna imagen.');
  const base64 = imageDataUrl.includes(',') ? imageDataUrl.split(',')[1] : imageDataUrl;

  const prompt =
    'Analiza esta receta médica y extrae una lista de medicamentos. Para cada medicamento, identifica el nombre comercial o genérico, la dosis (ej. 500mg), la frecuencia (ej. cada 8 horas), la duración del tratamiento (ej. 7 días, o \'indefinido\') y cualquier comentario o nota adicional del médico (ej. \'tomar después de comer\'). Devuelve los resultados estrictamente en formato JSON según el esquema proporcionado.';

  return geminiGenerar(env, {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: base64 } }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' },
            dosage: { type: 'STRING' },
            frequency: { type: 'STRING' },
            duration: { type: 'STRING' },
            comments: { type: 'STRING' },
          },
          required: ['name', 'dosage', 'frequency'],
        },
      },
    },
  });
}

async function auditarSeguridad(env, newMeds, historyMeds) {
  const prompt = `Actúa como un experto en farmacología clínica y seguridad del paciente.
Analiza la interacción entre los NUEVOS medicamentos de una receta y el HISTORIAL médico del paciente.

NUEVOS MEDICAMENTOS: ${JSON.stringify(newMeds)}
HISTORIAL (lo que ya toma): ${JSON.stringify(historyMeds)}

TAREAS:
1. Busca interacciones medicamentosas peligrosas entre los nuevos y los existentes.
2. Advierte sobre dosis potencialmente altas o frecuencias inusuales.
3. Proporciona consejos de seguridad (ej. "no tomar con alcohol", "tomar con alimentos").
4. Asigna un "Puntaje de Seguridad" de 0 a 100.

Devuelve un JSON estrictamente con este esquema:
{
  "safetyScore": number,
  "warnings": string[],
  "interactions": { "medA": string, "medB": string, "risk": "low"|"medium"|"high", "description": string }[],
  "recommendations": string[]
}`;

  return geminiGenerar(env, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  });
}

async function manejar(request, env) {
  const url = new URL(request.url);

  // Respuesta al preflight CORS del navegador.
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const q = (url.searchParams.get('q') || '').trim().slice(0, 60);
  try {
    switch (url.pathname) {
      case '/api/analyze-prescription': {
        if (request.method !== 'POST') return json({ error: 'Usa POST' }, 405);
        const { image } = await request.json();
        return json(await analizarReceta(env, image));
      }
      case '/api/security-audit': {
        if (request.method !== 'POST') return json({ error: 'Usa POST' }, 405);
        const { newMeds, historyMeds } = await request.json();
        return json(await auditarSeguridad(env, newMeds, historyMeds));
      }
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
        return json({
          ok: true,
          rutas: [
            '/api/analyze-prescription (POST)',
            '/api/security-audit (POST)',
            '/similares/buscar?q=',
            '/similares/sucursales?lat=&lon=&sku=',
            '/benavides/buscar?q=',
          ],
        });
    }
  } catch (err) {
    return json({ error: 'PROXY_ERROR', message: String(err?.message || err) }, 502);
  }
}

export default { fetch: (request, env) => manejar(request, env) };
