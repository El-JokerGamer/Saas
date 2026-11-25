'use strict';
/**
 * [اسم المنصة] — منصة إدارة المطاعم عبر QR
 * خادم Node.js باستخدام الوحدات المدمجة فقط (لا اعتماديات خارجية).
 * يخدم الملفات الثابتة من public/ ويوفّر API بسيطًا في الذاكرة للطلبات.
 * التشغيل: node server.js   — المنفذ من PORT أو 3000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// قراءة .env إن وجد (بدون مكتبات خارجية)
(function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
})();

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

// API في الذاكرة (تجريبي — البيانات الحقيقية في Supabase عند الإنتاج)
const orders = [];
let nextOrderId = 1;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  rel = decodeURIComponent(rel);
  const filePath = path.join(PUBLIC_DIR, rel);
  // منع الخروج من مجلد public
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('الصفحة غير موجودة — 404');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // --- API ---
  if (pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, service: 'saas-restaurant-platform', time: new Date().toISOString() });
  }
  if (pathname === '/api/orders') {
    if (req.method === 'GET') {
      const restaurant = url.searchParams.get('restaurant');
      const status = url.searchParams.get('status');
      let list = orders.slice().reverse();
      if (restaurant) list = list.filter((o) => o.restaurantId === restaurant);
      if (status) list = list.filter((o) => o.status === status);
      return sendJson(res, 200, list);
    }
    if (req.method === 'POST') {
      try {
        const body = await readBody(req);
        const order = {
          id: nextOrderId++,
          restaurantId: body.restaurantId || 'r1',
          table: Number(body.table) || 1,
          items: Array.isArray(body.items) ? body.items : [],
          total: Number(body.total) || 0,
          note: body.note || '',
          status: 'new', // new -> ready -> served
          createdAt: new Date().toISOString(),
        };
        orders.push(order);
        return sendJson(res, 201, order);
      } catch (e) {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }
    }
    return sendJson(res, 405, { error: 'Method not allowed' });
  }
  const orderMatch = pathname.match(/^\/api\/orders\/(\d+)$/);
  if (orderMatch && req.method === 'PATCH') {
    const id = Number(orderMatch[1]);
    const order = orders.find((o) => o.id === id);
    if (!order) return sendJson(res, 404, { error: 'Order not found' });
    try {
      const body = await readBody(req);
      const allowed = ['new', 'ready', 'served'];
      if (body.status && allowed.includes(body.status)) order.status = body.status;
      order.updatedAt = new Date().toISOString();
      return sendJson(res, 200, order);
    } catch (e) {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
  }

  // --- Static ---
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, pathname);
  res.writeHead(405); res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log('[اسم المنصة] يعمل على http://localhost:' + PORT);
  console.log('Supabase: ' + (process.env.SUPABASE_URL ? 'مُهيأ' : 'غير مُهيأ — راجع .env.example'));
});
