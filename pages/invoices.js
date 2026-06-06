/* ============================================================
   Page: invoices — list, search, open, duplicate, export, delete
   ============================================================ */
App.pages.register('invoices', (function () {
  var rootEl = null;
  var query = '';
  var statusFilter = null;
  var sort = { key: 'updatedAt', dir: 'desc' };
  var selection = null;

  function getFiltered() {
    var list = App.store.getInvoices();
    // Apply status filter first (when provided via route params)
    if (statusFilter) {
      if (statusFilter === 'outstanding') {
        list = list.filter(function (inv) { return inv.status === 'sent' || inv.status === 'overdue'; });
      } else {
        list = list.filter(function (inv) { return (inv.status || '') === statusFilter; });
      }
    }
    if (query) {
      var q = query.toLowerCase();
      list = list.filter(function (inv) {
        return (inv.meta.number || '').toLowerCase().indexOf(q) >= 0 ||
          (inv.buyer.name || '').toLowerCase().indexOf(q) >= 0 ||
          (inv.status || '').toLowerCase().indexOf(q) >= 0;
      });
    }
    return list.sort(function (a, b) {
      var av = valueFor(a, sort.key);
      var bv = valueFor(b, sort.key);
      var cmp;
      if (typeof av === 'number' || typeof bv === 'number') cmp = (Number(av) || 0) - (Number(bv) || 0);
      else cmp = String(av || '').toLowerCase().localeCompare(String(bv || '').toLowerCase(), undefined, { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }

  function valueFor(inv, key) {
    if (key === 'number') return inv.meta.number;
    if (key === 'client') return inv.buyer.name;
    if (key === 'issueDate') return inv.meta.issueDate;
    if (key === 'dueDate') return inv.meta.dueDate;
    if (key === 'total') return App.invoiceModel.computeTotals(inv).total;
    if (key === 'status') return inv.status;
    return inv.updatedAt || inv.createdAt || '';
  }

  function sortHead(key, label, cls) {
    var icon = sort.key === key ? (sort.dir === 'asc' ? 'bi-chevron-up' : 'bi-chevron-down') : 'bi-chevron-expand';
    return '<button class="sort-btn' + (cls ? ' ' + cls : '') + '" data-sort="' + key + '">' + label + ' <i class="bi ' + icon + '"></i></button>';
  }

  function confirmBulkDelete(count) {
    var dialogEl = document.querySelector('app-dialog');
    var msg = count === 1 ? 'Delete 1 invoice?' : 'Delete ' + count + ' invoices?';
    if (dialogEl && typeof dialogEl.confirm === 'function') {
      return dialogEl.confirm(msg, { title: 'Delete invoices', confirmText: 'Delete', cancelText: 'Cancel', danger: true });
    }
    return Promise.resolve(window.confirm(msg));
  }

  function bindRowActions(el) {
    el.querySelectorAll('tr[data-id]').forEach(function (tr) {
      var id = tr.getAttribute('data-id');
      tr.addEventListener('click', function (e) {
        var actBtn = e.target.closest('[data-row-act]');
        if (!actBtn) return;
        e.stopPropagation();
        var act = actBtn.getAttribute('data-row-act');
        if (act === 'duplicate') {
          var src = App.store.getInvoice(id);
          var copy = App.util.deepClone(src);
          copy.id = App.util.uuid('inv');
          copy.meta.number = App.store.nextInvoiceNumber();
          copy.status = 'draft';
          copy.createdAt = null; copy.updatedAt = null;
          App.store.saveInvoice(copy);
          App.toast('Invoice duplicated', 'success');
          renderList();
        } else if (act === 'delete') {
          var inv = App.store.getInvoice(id);
          var dialogEl = document.querySelector('app-dialog');
          var askFn = null;
          if (dialogEl && typeof dialogEl.confirm === 'function') askFn = function (msg, opts) { return dialogEl.confirm(msg, opts); };
          else if (typeof App !== 'undefined' && typeof App.dialog === 'function') askFn = App.dialog;

          var askResult;
          try {
            if (askFn) {
              askResult = askFn('Delete invoice ' + inv.meta.number + '?', { title: 'Delete invoice', confirmText: 'Delete', cancelText: 'Cancel', danger: true });
            } else {
              askResult = window.confirm('Delete invoice ' + inv.meta.number + '?');
            }
          } catch (err) {
            askResult = window.confirm('Delete invoice ' + inv.meta.number + '?');
          }

          Promise.resolve(askResult).then(function (confirmed) {
            if (!confirmed) return;
            App.store.deleteInvoice(id);
            App.toast('Invoice deleted', 'info');
            renderList();
          });
        }
      });
    });
  }

  function renderList() {
    var list = getFiltered();
    var el = rootEl.querySelector('#inv-list');
    var card = rootEl.querySelector('#inv-list-card');
    var visibleIds = list.map(function (inv) { return inv.id; });
    if (selection) selection.prune(visibleIds);

    if (!list.length) {
      el.innerHTML = query
        ? '<div class="empty-state"><i class="bi bi-search"></i><h3>No matches</h3><p>Try a different search.</p></div>'
        : '<div class="empty-state"><i class="bi bi-inbox"></i><h3>No invoices yet</h3>\
            <p>Pick a template to create your first invoice.</p>\
            </div>';
      if (selection) selection.syncBulkBar(card);
      return;
    }

    var allSelected = visibleIds.length > 0 && visibleIds.every(function (id) { return selection && selection.has(id); });
    el.innerHTML = '<table class="data-table"><thead><tr>' +
      (selection ? selection.headerCell(allSelected) : '') +
      '<th>' + sortHead('number', 'Number') + '</th>\
      <th>' + sortHead('client', 'Client') + '</th>\
      <th>' + sortHead('issueDate', 'Issued') + '</th>\
      <th>' + sortHead('dueDate', 'Due') + '</th>\
      <th class="text-right">' + sortHead('total', 'Total') + '</th>\
      <th>' + sortHead('status', 'Status') + '</th><th></th>\
      </tr></thead><tbody>' + list.map(function (inv) {
      var t = App.invoiceModel.computeTotals(inv).total;
      return '<tr data-id="' + inv.id + '">' +
        (selection ? selection.rowCell(inv.id) : '') +
        '<td><strong>' + App.util.escapeHtml(inv.meta.number) + '</strong></td>\
          <td>' + App.util.escapeHtml(inv.buyer.name || '—') + '</td>\
          <td>' + App.util.formatDate(inv.meta.issueDate) + '</td>\
          <td>' + App.util.formatDate(inv.meta.dueDate) + '</td>\
          <td class="text-right mono">' + App.util.formatMoney(t, inv.meta.currency) + '</td>\
          <td><span class="badge badge-' + inv.status + '">' + inv.status + '</span></td>\
          <td><div class="row-actions">\
            <button class="btn btn-ghost btn-sm" data-row-act="duplicate" title="Duplicate"><i class="bi bi-files"></i></button>\
            <button class="btn btn-ghost btn-sm" data-row-act="delete" title="Delete"><i class="bi bi-trash"></i></button>\
          </div></td>\
        </tr>';
    }).join('') + '</tbody></table>';

    el.querySelectorAll('[data-sort]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-sort');
        sort.dir = sort.key === key && sort.dir === 'asc' ? 'desc' : 'asc';
        sort.key = key;
        renderList();
      });
    });

    bindRowActions(el);
    if (selection) {
      selection.bindTable(el.querySelector('table'), visibleIds, card, function (id) {
        App.router.navigate({ page: 'invoice-editor', id: id });
      });
    }
  }

  function mount(root) {
    // `params` may be supplied by the router: mount(root, params)
    rootEl = root;
    query = '';
    statusFilter = null;
    var params = arguments[1] || {};
    if (params.q) query = params.q;
    if (params.status) statusFilter = params.status;
    sort = { key: 'updatedAt', dir: 'desc' };
    selection = App.listSelection({
      singular: 'invoice',
      plural: 'invoices',
      onChange: function () { renderList(); },
      onBulkDelete: function (ids) {
        confirmBulkDelete(ids.length).then(function (confirmed) {
          if (!confirmed) return;
          ids.forEach(function (id) { App.store.deleteInvoice(id); });
          selection.clear();
          App.toast(ids.length === 1 ? 'Invoice deleted' : (ids.length + ' invoices deleted'), 'info');
          renderList();
        });
      }
    });
    renderList();

    // If a status filter or initial query was provided, reflect it in the
    // search input and status select so the UI matches the filtered list.
    var search = root.querySelector('#inv-search');
    var statusSel = root.querySelector('#inv-status');
    var appSelectEl = root.querySelector('#inv-status-select');
    // Reflect initial params into the native select so any attached app-select
    // component will pick up the correct selected value when it syncs.
    if (statusSel) statusSel.value = statusFilter || '';
    // If an inline app-select placeholder exists, attach the native select to it
    if (statusSel && appSelectEl && typeof appSelectEl.attachSelect === 'function') {
      try { appSelectEl.attachSelect(statusSel); } catch (e) { console.error('app-select attach failed', e); }
    }
    if (search && query) search.value = query;

    var newBtn = root.querySelector('[data-act="new"]');
    if (newBtn) {
      newBtn.addEventListener('click', function () {
        App.router.navigate({ page: 'templates' });
      });
    }
    if (search) {
      search.addEventListener('input', App.util.debounce(function () {
        query = search.value.trim();
        renderList();
      }, 150));
    }

    if (statusSel) {
      statusSel.addEventListener('change', function () {
        var v = statusSel.value;
        statusFilter = v ? v : null;
        renderList();
      });
    }
  }

  function unmount() { rootEl = null; selection = null; }

  return { mount: mount, unmount: unmount };
})());
