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

  // Currencies offered in settings / invoice editor (used to validate locale detection).
  var SUPPORTED_CURRENCIES = {
    USD: 1, EUR: 1, GBP: 1, JPY: 1, CNY: 1, AUD: 1, CAD: 1, NZD: 1, SGD: 1, HKD: 1,
    SEK: 1, NOK: 1, DKK: 1, CHF: 1, INR: 1, ZAR: 1, BRL: 1, MXN: 1, ARS: 1, CLP: 1,
    COP: 1, PEN: 1, TRY: 1, RUB: 1, KRW: 1, PLN: 1, ILS: 1, AED: 1, MYR: 1, IDR: 1,
    PHP: 1, THB: 1, VND: 1
  };

  // ISO 3166-1 alpha-2 region -> ISO 4217 currency for supported options.
  var REGION_TO_CURRENCY = {
    US: 'USD', GB: 'GBP', JP: 'JPY', CN: 'CNY', AU: 'AUD', CA: 'CAD', NZ: 'NZD',
    SG: 'SGD', HK: 'HKD', SE: 'SEK', NO: 'NOK', DK: 'DKK', CH: 'CHF', IN: 'INR',
    ZA: 'ZAR', BR: 'BRL', MX: 'MXN', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN',
    TR: 'TRY', RU: 'RUB', KR: 'KRW', PL: 'PLN', IL: 'ILS', AE: 'AED', MY: 'MYR',
    ID: 'IDR', PH: 'PHP', TH: 'THB', VN: 'VND',
    AT: 'EUR', BE: 'EUR', CY: 'EUR', EE: 'EUR', FI: 'EUR', FR: 'EUR', DE: 'EUR',
    GR: 'EUR', IE: 'EUR', IT: 'EUR', LV: 'EUR', LT: 'EUR', LU: 'EUR', MT: 'EUR',
    NL: 'EUR', PT: 'EUR', SK: 'EUR', SI: 'EUR', ES: 'EUR', HR: 'EUR', AD: 'EUR',
    MC: 'EUR', SM: 'EUR', VA: 'EUR', ME: 'EUR', XK: 'EUR'
  };

  function regionFromLocale(locale) {
    if (!locale) return null;
    try {
      if (typeof Intl.Locale === 'function') {
        return new Intl.Locale(locale).maximize().region || null;
      }
    } catch (e) { /* fall through */ }
    var parts = String(locale).split(/[-_]/);
    return parts.length >= 2 ? parts[1].toUpperCase() : null;
  }

  function currencyForRegion(region) {
    if (!region) return null;
    var code = REGION_TO_CURRENCY[region.toUpperCase()];
    return code && SUPPORTED_CURRENCIES[code] ? code : null;
  }

  function detectLocaleCurrency() {
    var locales = [];
    if (navigator.languages && navigator.languages.length) {
      locales = Array.prototype.slice.call(navigator.languages);
    } else if (navigator.language) {
      locales = [navigator.language];
    }
    try {
      var resolved = Intl.DateTimeFormat().resolvedOptions().locale;
      if (resolved && locales.indexOf(resolved) === -1) locales.push(resolved);
    } catch (e) { /* ignore */ }

    for (var i = 0; i < locales.length; i++) {
      var currency = currencyForRegion(regionFromLocale(locales[i]));
      if (currency) return currency;
    }
    return 'USD';
  }

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
    detectLocaleCurrency: detectLocaleCurrency,
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
