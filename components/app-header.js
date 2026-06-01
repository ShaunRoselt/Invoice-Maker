/* ============================================================
   <app-header> — top bar with brand + global actions.
   ============================================================ */
(function () {
  class AppHeader extends HTMLElement {
    connectedCallback() {
      this.innerHTML = '\
        <div class="app-header">\
          <div class="brand">\
            <button class="btn btn-ghost btn-icon menu-toggle" title="Menu"><i class="bi bi-list"></i></button>\
            <span class="logo-mark"><i class="bi bi-receipt"></i></span>\
            <span>Roselt Invoice Generator</span>\
          </div>\
          <div class="header-actions">\
            <button class="btn btn-primary" data-act="new" title="New Invoice"><i class="bi bi-plus-lg"></i> New Invoice</button>\
          </div>\
        </div>';

      this.querySelector('.menu-toggle').addEventListener('click', function () {
        App.bus.emit('ui:toggle-sidebar');
      });

      // Header-level new-invoice action (also used by other page buttons)
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
