// Servidor local para probar el intermediario sin desplegarlo:
//   GEMINI_API_KEY=tu_llave node proxy/dev-server.mjs
import http from 'node:http';
import worker from './worker.js';

http
  .createServer(async (req, res) => {
    // Reunir el cuerpo para reenviar los POST (/api/*) tal cual al worker.
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;

    const request = new Request(`http://localhost${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    });

    // El worker lee la llave desde env (secreto en producción, variable de entorno en local).
    const env = { GEMINI_API_KEY: process.env.GEMINI_API_KEY };
    const r = await worker.fetch(request, env);

    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(await r.text());
  })
  .listen(8787, () => console.log('proxy en http://localhost:8787'));
