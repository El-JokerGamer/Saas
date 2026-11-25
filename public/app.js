// [اسم المنصة] — منطق مشترك
// الطلبات والقائمة المعدّلة تُحفظ في localStorage (مفاتيح تبدأ بـ qr-saas-)
// التحديث اللحظي: storage events + polling كل 3 ثوانٍ.
(function () {
  'use strict';
  const PREFIX = 'qr-saas-';
  const ORDERS_KEY = PREFIX + 'orders';
  const MENU_KEY = PREFIX + 'menu-';
  const REST_KEY = PREFIX + 'restaurants';

  function getRestaurants() {
    try {
      const saved = JSON.parse(localStorage.getItem(REST_KEY) || 'null');
      if (saved && saved.length) return saved;
    } catch (e) {}
    return (window.DEMO_DATA ? window.DEMO_DATA.restaurants : []).map((r) => ({
      id: r.id, name: r.name, description: r.description, isActive: r.isActive, tables: r.tables.slice(),
    }));
  }
  function saveRestaurants(list) { localStorage.setItem(REST_KEY, JSON.stringify(list)); }

  function getMenu(restaurantId) {
    try {
      const saved = JSON.parse(localStorage.getItem(MENU_KEY + restaurantId) || 'null');
      if (saved) return saved;
    } catch (e) {}
    const r = (window.DEMO_DATA ? window.DEMO_DATA.restaurants : []).find((x) => x.id === restaurantId);
    if (!r) return { categories: [], items: [] };
    return { categories: r.categories, items: r.items };
  }
  function saveMenu(restaurantId, menu) { localStorage.setItem(MENU_KEY + restaurantId, JSON.stringify(menu)); }

  function getOrders() {
    try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveOrders(list) { localStorage.setItem(ORDERS_KEY, JSON.stringify(list)); }

  function createOrder(restaurantId, table, items, note) {
    const orders = getOrders();
    const total = items.reduce((s, it) => s + it.price * it.qty, 0);
    const order = {
      id: 'o' + Date.now().toString(36),
      restaurantId, table: Number(table) || 1,
      items: items.map((it) => ({ name: it.name, price: it.price, qty: it.qty })),
      total, note: note || '', status: 'new', // new -> ready -> served
      createdAt: new Date().toISOString(),
    };
    orders.push(order);
    saveOrders(orders);
    return order;
  }

  function setOrderStatus(id, status) {
    const orders = getOrders();
    const o = orders.find((x) => x.id === id);
    if (o) { o.status = status; saveOrders(orders); }
    return o;
  }

  function statusLabel(s) {
    return s === 'new' ? 'جديد' : s === 'ready' ? 'جاهز' : s === 'served' ? 'تم التقديم' : s;
  }
  function fmt(n) { return Number(n).toLocaleString('ar-EG') + ' جنيه'; }
  function timeOf(iso) {
    try { return new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }
  function param(name) { return new URLSearchParams(location.search).get(name); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // إعادة الرسم عند تغيّر البيانات في تبويب آخر، مع polling احتياطي
  function onOrdersChange(fn) {
    window.addEventListener('storage', (e) => { if (e.key === ORDERS_KEY || e.key && e.key.startsWith(MENU_KEY)) fn(); });
    setInterval(fn, 3000);
  }

  window.QR = {
    getRestaurants, saveRestaurants, getMenu, saveMenu,
    getOrders, saveOrders, createOrder, setOrderStatus,
    statusLabel, fmt, timeOf, param, esc, onOrdersChange,
  };
})();
