/* ============================================================
   Page: templates — gallery of built-in + custom templates
   ============================================================ */
App.pages.register('templates', (function () {
  var filter = 'all';
  var query = '';

  function matchesSearch(t) {
    if (!query) return true;
    var q = query.toLowerCase();
    return (t.name || '').toLowerCase().indexOf(q) >= 0 ||
      (t.description || '').toLowerCase().indexOf(q) >= 0 ||
      (t.id || '').toLowerCase().indexOf(q) >= 0;
  }

  function getFiltered() {
    return App.templates.getAll().filter(function (t) {
      if (filter === 'builtin' && !t.builtIn) return false;
      if (filter === 'custom' && t.builtIn) return false;
      return matchesSearch(t);
    });
  }

  function renderGrid(root) {
    var grid = root.querySelector('#tpl-grid');
    var all = getFiltered();

    grid.innerHTML = '';
    if (!all.length) {
      if (query) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="bi bi-search"></i>\
          <h3>No matches</h3><p>Try a different search term or clear the filter.</p></div>';
      } else if (filter === 'custom') {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="bi bi-collection"></i>\
          <h3>No custom templates</h3><p>Create a template to see it listed here.</p></div>';
      } else {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="bi bi-collection"></i>\
          <h3>No templates here</h3><p>Create a custom template to see it listed.</p></div>';
      }
      return;
    }
    all.forEach(function (def) {
      var card = document.createElement('template-card');
      card.template = def;
      grid.appendChild(card);
    });
  }

  function mount(root) {
    renderGrid(root);

    var search = root.querySelector('#tpl-search');
    search.addEventListener('input', App.util.debounce(function () {
      query = search.value.trim();
      renderGrid(root);
    }, 200));

    root.querySelector('#tpl-filter').addEventListener('click', function (e) {
      var btn = e.target.closest('.seg-btn');
      if (!btn) return;
      filter = btn.getAttribute('data-filter');
      root.querySelectorAll('.seg-btn').forEach(function (b) { b.classList.toggle('active', b === btn); });
      renderGrid(root);
    });

    root.querySelector('[data-act="create"]').addEventListener('click', function () {
      App.router.navigate({ page: 'template-editor', mode: 'create' });
    });

    // Card events (bubble up to the page root).
    root.addEventListener('tpl-use', function (e) {
      var newInv = App.invoiceModel.createInvoice(e.detail.id);
      var businessId = App.router.getParams().business;
      var clientId = App.router.getParams().client;
      if (businessId) App.invoiceModel.applyBusiness(newInv, App.store.getBusiness(businessId));
      if (clientId) App.invoiceModel.applyClient(newInv, App.store.getClient(clientId));
      newInv.meta.number = App.store.nextInvoiceNumber();
      App.store.saveInvoice(newInv);
      App.router.navigate({ page: 'invoice-editor', id: newInv.id });
    });
    root.addEventListener('tpl-edit', function (e) {
      App.router.navigate({ page: 'template-editor', id: e.detail.id });
    });
  }

  return { mount: mount };
})());
