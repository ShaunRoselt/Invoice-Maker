/* ============================================================
   <app-header> — top bar with brand + global actions.
   ============================================================ */
(function () {
  function whenReady(fn) {
    if (App.i18n && App.i18n.isReady && App.i18n.isReady()) {
      fn();
      return;
    }
    (App.i18n && App.i18n.ready ? App.i18n.ready() : Promise.resolve()).then(fn);
  }

  class AppHeader extends HTMLElement {
    connectedCallback() {
      var self = this;
      whenReady(function () {
        self.render();
        self._offI18n = App.bus.on('i18n:change', function () { self.render(); });
      });
    }

    disconnectedCallback() {
      if (this._offI18n) this._offI18n();
    }

    render() {
      if (!App.i18n || !App.i18n.isReady || !App.i18n.isReady()) return;
      var t = App.i18n.t.bind(App.i18n);
      this.innerHTML = '\
        <div class="app-header">\
          <div class="brand">\
            <button class="btn btn-ghost btn-icon menu-toggle" title="' + App.util.escapeHtml(t('app.menu')) + '"><i class="bi bi-list"></i></button>\
            <img class="logo-mark" src="assets/img/favicon.svg" alt="' + App.util.escapeHtml(t('app.title')) + ' logo">\
            <span>' + App.util.escapeHtml(t('app.title')) + '</span>\
          </div>\
          <div class="header-actions">\
            <button class="btn btn-primary" data-act="new" title="' + App.util.escapeHtml(t('app.newInvoice')) + '"><i class="bi bi-plus-lg"></i> ' + App.util.escapeHtml(t('app.newInvoice')) + '</button>\
          </div>\
        </div>';

      this.querySelector('.menu-toggle').addEventListener('click', function () {
        App.bus.emit('ui:toggle-sidebar');
      });

      var newBtn = this.querySelector('[data-act="new"]');
      if (newBtn) {
        newBtn.addEventListener('click', function () {
          App.bus.emit('action:new-invoice');
        });
      }
    }
  }
  customElements.define('app-header', AppHeader);
})();
