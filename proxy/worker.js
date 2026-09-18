// Intermediario de FotoFarma para consultar disponibilidad en cadenas de farmacias.
// Solo lee catálogos y sucursales públicos de sus tiendas en línea; no vende nada.
// Existe porque Similares y Benavides no permiten llamadas directas desde el navegador (CORS).
// Despliegue: Cloudflare Workers (gratis) — ver proxy/README.md

const UA = 'Mozilla/5.0 (FotoFarma; +https://strattpllaner.github.io/Fotofarma2/)';
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

async function manejar(request) {
  const url = new URL(request.url);
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
        return json({ ok: true, rutas: ['/similares/buscar?q=', '/similares/sucursales?lat=&lon=&sku=', '/benavides/buscar?q='] });
    }
  } catch (err) {
    return json({ error: String(err?.message || err) }, 502);
  }
}

export default { fetch: manejar };
