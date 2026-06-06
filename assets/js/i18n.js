/* ============================================================
   i18n.js — translations loaded from assets/i18n/<locale>.json
   ============================================================ */
window.App = window.App || {};

App.i18n = (function () {
  var SUPPORTED = ['en', 'af'];
  var locale = 'en';
  var strings = {};
  var readyPromise = null;
  var loaded = false;

  function normalize(lang) {
    if (!lang) return 'en';
    var code = String(lang).split(/[-_]/)[0].toLowerCase();
    return SUPPORTED.indexOf(code) >= 0 ? code : 'en';
  }

  function lookup(key) {
    if (!key) return undefined;
    var val = strings;
    var parts = String(key).split('.');
    for (var i = 0; i < parts.length; i++) {
      if (!val || typeof val !== 'object') return undefined;
      val = val[parts[i]];
    }
    return typeof val === 'string' ? val : undefined;
  }

  function t(key, vars) {
    var text = lookup(key);
    if (text === undefined) return '';
    if (vars && typeof vars === 'object') {
      Object.keys(vars).forEach(function (k) {
        text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
      });
    }
    return text;
  }

  function markReady() {
    loaded = true;
    document.documentElement.setAttribute('data-i18n-ready', '');
  }

  function loadLocale(lang) {
    var code = normalize(lang);
    return fetch('assets/i18n/' + code + '.json', { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error('Failed to load locale ' + code);
      return res.json();
    }).then(function (data) {
      strings = data || {};
      locale = code;
      document.documentElement.lang = code;
      markReady();
      var title = lookup('app.title');
      if (title) document.title = title;
      App.bus && App.bus.emit('i18n:change', code);
      return code;
    }).catch(function (err) {
      console.error(err);
      if (code !== 'en') return loadLocale('en');
      strings = {};
      locale = 'en';
      document.documentElement.lang = 'en';
      markReady();
      return 'en';
    });
  }

  function resolveInitialLang(lang) {
    if (lang !== undefined) return Promise.resolve(lang);
    var storeReady = (App.store && typeof App.store.ready === 'function')
      ? App.store.ready()
      : Promise.resolve();
    return storeReady.then(function () {
      if (App.store && typeof App.store.getSettings === 'function') {
        try { return App.store.getSettings().language; } catch (e) { /* ignore */ }
      }
      return 'en';
    });
  }

  function ready(lang) {
    if (readyPromise) return readyPromise;
    readyPromise = resolveInitialLang(lang).then(function (initial) {
      return loadLocale(initial || 'en');
    });
    return readyPromise;
  }

  function persistLanguage(code) {
    if (!App.store || typeof App.store.getSettings !== 'function' || typeof App.store.saveSettings !== 'function') return;
    try {
      var settings = App.store.getSettings();
      if (settings.language === code) return;
      settings.language = code;
      App.store.saveSettings(settings);
    } catch (e) { /* ignore */ }
  }

  function setLocale(lang) {
    var code = normalize(lang);
    persistLanguage(code);
    readyPromise = loadLocale(code);
    return readyPromise;
  }

  function apply(root) {
    if (!root || !loaded) return;
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      var text = lookup(el.getAttribute('data-i18n'));
      if (text !== undefined) el.textContent = text;
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var text = lookup(el.getAttribute('data-i18n-placeholder'));
      if (text !== undefined) el.placeholder = text;
    });
    root.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      var text = lookup(el.getAttribute('data-i18n-title'));
      if (text !== undefined) el.title = text;
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach(function (el) {
      var text = lookup(el.getAttribute('data-i18n-aria-label'));
      if (text !== undefined) el.setAttribute('aria-label', text);
    });
    root.querySelectorAll('option[data-i18n]').forEach(function (el) {
      var text = lookup(el.getAttribute('data-i18n'));
      if (text !== undefined) el.textContent = text;
    });
    root.querySelectorAll('[data-i18n-search-placeholder]').forEach(function (el) {
      var text = lookup(el.getAttribute('data-i18n-search-placeholder'));
      if (text !== undefined) el.setAttribute('data-search-placeholder', text);
    });
    root.querySelectorAll('[data-i18n-label]').forEach(function (el) {
      var text = lookup(el.getAttribute('data-i18n-label'));
      if (text !== undefined) el.setAttribute('data-label', text);
    });
  }

  function statusLabel(status) {
    return t('status.' + status) || status;
  }

  return {
    SUPPORTED: SUPPORTED,
    t: t,
    ready: ready,
    setLocale: setLocale,
    isReady: function () { return loaded; },
    locale: function () { return locale; },
    apply: apply,
    statusLabel: statusLabel
  };
})();
