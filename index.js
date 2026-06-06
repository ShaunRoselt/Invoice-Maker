/* ============================================================
   index.js — application bootstrap
   ============================================================ */
App.theme = (function () {
  var mq = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)')) || null;

  function effective(pref) {
    if (!pref || pref === 'system') return (mq && mq.matches) ? 'dark' : 'light';
    return pref;
  }

  function get() {
    if (App.idb && App.idb.isReady()) {
      return App.idb.getKv('theme', 'system') || 'system';
    }
    return 'system';
  }

  function set(pref) {
    var eff = effective(pref);
    document.documentElement.setAttribute('data-theme', eff);
    if (App.idb && App.idb.isReady()) {
      App.idb.setKv('theme', pref).catch(function () { /* ignore */ });
    }
    App.bus.emit('theme:change', eff);
  }

  function _onSystemChange(e) {
    if (get() === 'system') {
      var now = e && e.matches ? 'dark' : ((mq && mq.matches) ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', now);
      App.bus.emit('theme:change', now);
    }
  }

  if (mq && mq.addEventListener) mq.addEventListener('change', _onSystemChange);
  else if (mq && mq.addListener) mq.addListener(_onSystemChange);

  function toggle() { var p = get(); set(p === 'dark' ? 'light' : 'dark'); }
  return { get: get, set: set, toggle: toggle };
})();

(function () {
  function start() {
    // Sidebar toggle — mobile uses `sidebar-open`, desktop toggles `sidebar-collapsed`.
    App.bus.on('ui:toggle-sidebar', function () {
      var root = document.getElementById('app-root');
      if (window.innerWidth <= 820) {
        root.classList.toggle('sidebar-open');
      } else {
        root.classList.toggle('sidebar-collapsed');
      }
    });
    App.bus.on('route:change', function (info) {
      var rootEl = document.getElementById('app-root');
      rootEl.classList.remove('sidebar-open');
      rootEl.setAttribute('data-route', (info && info.page) || '');
    });

    // Global "New invoice" action -> go pick a template.
    App.bus.on('action:new-invoice', function () {
      App.router.navigate({ page: 'templates' });
    });

    var tplReady = (App.templates && typeof App.templates.ready === 'function')
      ? App.templates.ready()
      : Promise.resolve();
    var storeReady = (App.store && typeof App.store.ready === 'function')
      ? App.store.ready()
      : Promise.resolve();

    Promise.all([tplReady, storeReady]).then(function () {
      // First visit: detect locale currency and persist default settings.
      if (App.store && typeof App.store.getSettings === 'function') App.store.getSettings();
      return (App.i18n && typeof App.i18n.ready === 'function')
        ? App.i18n.ready()
        : Promise.resolve();
    }).then(function () {
      App.theme.set(App.theme.get());
      App.router.init();
    }).catch(function (err) {
      console.error('App failed to initialize storage', err);
      var boot = (App.i18n && typeof App.i18n.ready === 'function')
        ? App.i18n.ready()
        : Promise.resolve();
      boot.then(function () { App.router.init(); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
