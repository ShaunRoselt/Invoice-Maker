/* ============================================================
   <app-sidebar> — primary navigation, highlights active route.
   ============================================================ */
(function () {
  var NAV = [
    { section: 'nav.workspace' },
    { page: 'dashboard', icon: 'bi-grid-1x2', label: 'nav.dashboard' },
    { page: 'invoices', icon: 'bi-receipt', label: 'nav.invoices' },
    { page: 'clients', icon: 'bi-people', label: 'nav.clients' },
    { page: 'businesses', icon: 'bi-building', label: 'nav.businesses' },
    { section: 'nav.design' },
    { page: 'templates', icon: 'bi-collection', label: 'nav.templates' },
    { section: 'nav.configure' },
    { page: 'settings', icon: 'bi-gear', label: 'nav.settings' }
  ];

  var ACTIVE_ALIAS = { 'invoice-editor': 'invoices', 'template-editor': 'templates', 'client-editor': 'clients', 'business-editor': 'businesses' };

  function whenReady(fn) {
    if (App.i18n && App.i18n.isReady && App.i18n.isReady()) {
      fn();
      return;
    }
    (App.i18n && App.i18n.ready ? App.i18n.ready() : Promise.resolve()).then(fn);
  }

  class AppSidebar extends HTMLElement {
    connectedCallback() {
      var self = this;
      whenReady(function () {
        self.render();
        self._offRoute = App.bus.on('route:change', function () { self.updateActive(); });
        self._offI18n = App.bus.on('i18n:change', function () { self.render(); });
      });
    }
    disconnectedCallback() {
      if (this._offRoute) this._offRoute();
      if (this._offI18n) this._offI18n();
    }

    render() {
      if (!App.i18n || !App.i18n.isReady || !App.i18n.isReady()) return;
      var nav = document.createElement('nav');
      nav.className = 'app-sidebar';
      NAV.forEach(function (item) {
        if (item.section) {
          var sectionLabel = document.createElement('div');
          sectionLabel.className = 'nav-section-label';
          sectionLabel.textContent = App.i18n.t(item.section);
          nav.appendChild(sectionLabel);
          return;
        }
        var a = document.createElement('a');
        a.className = 'nav-item';
        a.href = App.router.buildUrl({ page: item.page });
        a.setAttribute('data-page', item.page);
        a.innerHTML = '<i class="bi ' + item.icon + '"></i><span>' + App.util.escapeHtml(App.i18n.t(item.label)) + '</span>';
        a.addEventListener('click', function (e) {
          e.preventDefault();
          App.router.navigate({ page: item.page });
        });
        nav.appendChild(a);
      });
      this.innerHTML = '';
      this.appendChild(nav);
      this.updateActive();
    }

    updateActive() {
      var cur = App.router.currentPage();
      var active = ACTIVE_ALIAS[cur] || cur;
      this.querySelectorAll('.nav-item').forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('data-page') === active);
      });
    }
  }
  customElements.define('app-sidebar', AppSidebar);
})();
