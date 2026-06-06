/* ============================================================
   Page: templates — gallery of built-in + custom templates
   ============================================================ */
App.pages.register('templates', (function () {
  var filter = 'all';
  var query = '';

  function t(key, vars) { return App.i18n.t(key, vars); }

  function betaEnabled() {
    try {
      var s = App.store && typeof App.store.getSettings === 'function' ? App.store.getSettings() : null;
      return !!(s && s.betaMode);
    } catch (e) {
      return false;
    }
  }

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
          <h3>' + App.util.escapeHtml(t('common.noMatches')) + '</h3><p>' + App.util.escapeHtml(t('templates.noMatchesHint')) + '</p></div>';
      } else if (filter === 'custom') {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="bi bi-collection"></i>\
          <h3>' + App.util.escapeHtml(t('templates.noCustom')) + '</h3><p>' + App.util.escapeHtml(t('templates.noCustomHint')) + '</p></div>';
      } else {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><i class="bi bi-collection"></i>\
          <h3>' + App.util.escapeHtml(t('templates.noTemplates')) + '</h3><p>' + App.util.escapeHtml(t('templates.noTemplatesHint')) + '</p></div>';
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
    var beta = betaEnabled();

    // Non-beta: built-ins only (no create/edit).
    if (!beta) {
      filter = 'builtin';
      var sub = root.querySelector('.subtitle');
      if (sub) sub.textContent = t('templates.subtitleBetaOff');
      var filterEl = root.querySelector('#tpl-filter');
      if (filterEl) filterEl.style.display = 'none';
      var createBtn = root.querySelector('[data-act="create"]');
      if (createBtn) createBtn.style.display = 'none';
    }

    renderGrid(root);

    var search = root.querySelector('#tpl-search');
    search.addEventListener('input', App.util.debounce(function () {
      query = search.value.trim();
      renderGrid(root);
    }, 200));

    if (beta) {
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
    }

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
      if (!betaEnabled()) {
        App.toast(t('templates.betaEditHint'), 'info');
        return;
      }
      App.router.navigate({ page: 'template-editor', id: e.detail.id });
    });
  }

  return { mount: mount };
})());
