/* ============================================================
   Page: settings — invoice defaults
   ============================================================ */
App.pages.register('settings', (function () {
  var settings = null;
  var rootEl = null;

  function getByPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o ? o[k] : undefined; }, obj);
  }
  function setByPath(obj, path, value) {
    var keys = path.split('.');
    var last = keys.pop();
    var target = keys.reduce(function (o, k) { return (o[k] = o[k] || {}); }, obj);
    target[last] = value;
  }

  function refreshNextNumber() {
    rootEl.querySelector('#s-next-number').textContent = App.store.peekInvoiceNumber();
  }

  function mount(root) {
    rootEl = root;
    settings = App.store.getSettings();

    root.querySelectorAll('[data-path]').forEach(function (input) {
      var path = input.getAttribute('data-path');
      var val = getByPath(settings, path);
      if (path === 'language' && App.i18n && typeof App.i18n.locale === 'function') {
        val = App.i18n.locale();
        setByPath(settings, path, val);
      }
      if (input.type === 'checkbox') input.checked = !!val;
      else input.value = (val === undefined || val === null) ? '' : val;
      var handler = function () {
        var v = (input.type === 'checkbox') ? input.checked : input.value;
        if (input.type === 'number') v = v === '' ? '' : Number(v);
        setByPath(settings, path, v);
        if (path === 'defaults.numberPrefix') refreshNextNumber();
        if (path === 'language' && App.i18n && typeof App.i18n.setLocale === 'function') {
          App.i18n.setLocale(v).then(function () {
            document.title = App.i18n.t('app.title');
          });
          return;
        }
      };
      input.addEventListener('input', handler);
      input.addEventListener('change', function () {
        handler();
        if (path !== 'language') App.store.saveSettings(settings);
      });
    });

    refreshNextNumber();

    var themeSel = root.querySelector('#s-theme');
    if (themeSel) {
      themeSel.value = App.theme.get();
      themeSel.addEventListener('change', function () { App.theme.set(themeSel.value); });
    }

    root.querySelector('[data-act="save"]').addEventListener('click', function () {
      App.store.saveSettings(settings);
      App.toast(App.i18n.t('settings.saved'), 'success');
    });
  }

  function unmount() { settings = null; rootEl = null; }

  return { mount: mount, unmount: unmount };
})());
