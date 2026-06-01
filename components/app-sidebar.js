/* ============================================================
   <app-sidebar> — primary navigation, highlights active route.
   ============================================================ */
(function () {
  var NAV = [
    { section: 'Workspace' },
    { page: 'dashboard', icon: 'bi-grid-1x2', label: 'Dashboard' },
    { page: 'invoices', icon: 'bi-receipt', label: 'Invoices' },
    { page: 'clients', icon: 'bi-people', label: 'Clients' },
    { page: 'businesses', icon: 'bi-building', label: 'Businesses' },
    { section: 'Design' },
    { page: 'templates', icon: 'bi-collection', label: 'Templates' },
    { section: 'Configure' },
    { page: 'settings', icon: 'bi-gear', label: 'Settings' }
  ];

  // Map editor routes to the nav item that should stay highlighted.
  var ACTIVE_ALIAS = { 'invoice-editor': 'invoices', 'template-editor': 'templates', 'client-editor': 'clients', 'business-editor': 'businesses' };

  class AppSidebar extends HTMLElement {
    connectedCallback() {
      this.render();
      var self = this;
      this._off = App.bus.on('route:change', function () { self.updateActive(); });
    }
    disconnectedCallback() { if (this._off) this._off(); }

    render() {
      var nav = document.createElement('nav');
      nav.className = 'app-sidebar';
      NAV.forEach(function (item) {
        if (item.section) {
          var label = document.createElement('div');
          label.className = 'nav-section-label';
          label.textContent = item.section;
          nav.appendChild(label);
          return;
        }
        var a = document.createElement('a');
        a.className = 'nav-item';
        a.href = App.router.buildUrl({ page: item.page });
        a.setAttribute('data-page', item.page);
        a.innerHTML = '<i class="bi ' + item.icon + '"></i><span>' + item.label + '</span>';
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
