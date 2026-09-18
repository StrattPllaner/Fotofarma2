// Servidor local para probar el intermediario sin desplegarlo: node proxy/dev-server.mjs
import http from 'node:http';
import worker from './worker.js';
http.createServer(async (req, res) => {
  const r = await worker.fetch(new Request(`http://localhost${req.url}`));
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(await r.text());
}).listen(8787, () => console.log('proxy en http://localhost:8787'));
