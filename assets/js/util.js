/* ============================================================
   util.js — shared helpers (global App namespace, no modules)
   ============================================================ */
window.App = window.App || {};

App.util = (function () {
  function uuid(prefix) {
    var id = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'xxxxxxxx'.replace(/x/g, function () { return Math.floor(Math.random() * 16).toString(16); }) + Date.now().toString(16);
    return (prefix ? prefix + '_' : '') + id;
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function nl2br(value) {
    return escapeHtml(value).replace(/\n/g, '<br>');
  }

  var CURRENCY_SYMBOLS = { USD: '$', EUR: '\u20ac', GBP: '\u00a3', ZAR: 'R', AUD: 'A$', CAD: 'C$', INR: '\u20b9', JPY: '\u00a5' };

  function currencySymbol(code) {
    return CURRENCY_SYMBOLS[code] || (code ? code + ' ' : '$');
  }

  function formatMoney(amount, currency) {
    var n = Number(amount);
    if (!isFinite(n)) n = 0;
    return currencySymbol(currency) + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDate(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDays(isoDate, days) {
    var d = new Date(isoDate || todayISO());
    d.setDate(d.getDate() + (Number(days) || 0));
    return d.toISOString().slice(0, 10);
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait || 200);
    };
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  var A4_WIDTH_PX = 794;   // 210mm @ 96dpi — keep in sync with .invoice-paper
  var A4_HEIGHT_PX = 1123; // 297mm @ 96dpi

  // Scale to fit width (invoice editor — stage scrolls if needed).
  function fitA4Paper(stageEl, paperEl) {
    if (!stageEl || !paperEl) return 1;
    var avail = stageEl.clientWidth - 40;
    var zoom = Math.min(1, Math.max(0.2, avail / A4_WIDTH_PX));
    paperEl.style.zoom = String(zoom);
    return zoom;
  }

  // Scale to fit width and height (template gallery — no scrollbar).
  function fitA4PaperInBox(stageEl, paperEl) {
    if (!stageEl || !paperEl) return 1;
    var pad = 40;
    var zoomW = (stageEl.clientWidth - pad) / A4_WIDTH_PX;
    var zoomH = (stageEl.clientHeight - pad) / A4_HEIGHT_PX;
    var zoom = Math.min(1, zoomW, zoomH);
    zoom = Math.max(0.12, zoom);
    paperEl.style.zoom = String(zoom);
    return zoom;
  }

  // Tiny DOM helper. Usage: el('div', {class:'x'}, [child, 'text'])
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  return {
    uuid: uuid,
    escapeHtml: escapeHtml,
    nl2br: nl2br,
    currencySymbol: currencySymbol,
    formatMoney: formatMoney,
    formatDate: formatDate,
    todayISO: todayISO,
    addDays: addDays,
    debounce: debounce,
    deepClone: deepClone,
    el: el,
    A4_WIDTH_PX: A4_WIDTH_PX,
    A4_HEIGHT_PX: A4_HEIGHT_PX,
    fitA4Paper: fitA4Paper,
    fitA4PaperInBox: fitA4PaperInBox
  };
})();
