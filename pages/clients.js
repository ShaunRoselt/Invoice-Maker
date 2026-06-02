/* ============================================================
   Page: clients — searchable, sortable client table
   ============================================================ */
App.pages.register('clients', (function () {
  var rootEl = null;
  var query = '';
  var sort = { key: 'name', dir: 'asc' };

  function displayName(client) {
    return client.name || client.contactName || 'Unnamed client';
  }

  function confirmDelete(client) {
    var dialogEl = document.querySelector('app-dialog');
    if (!dialogEl || typeof dialogEl.confirm !== 'function') return Promise.resolve(false);
    return dialogEl.confirm('Delete client ' + displayName(client) + '?', {
      title: 'Confirm deletion',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true
    });
  }

  function valueFor(client, key) {
    if (key === 'name') return displayName(client);
    return client[key] || '';
  }

  function getRows() {
    var list = App.store.getClients();
    if (query) {
      var q = query.toLowerCase();
      list = list.filter(function (client) {
        return [
          client.name,
          client.contactName,
          client.email,
          client.phone,
          client.website,
          client.taxId,
          client.address
        ].join(' ').toLowerCase().indexOf(q) >= 0;
      });
    }
    return list.sort(function (a, b) {
      var av = String(valueFor(a, sort.key)).toLowerCase();
      var bv = String(valueFor(b, sort.key)).toLowerCase();
      var cmp = av.localeCompare(bv, undefined, { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }

  function sortHead(key, label) {
    var icon = sort.key === key ? (sort.dir === 'asc' ? 'bi-chevron-up' : 'bi-chevron-down') : 'bi-chevron-expand';
    return '<button class="sort-btn" data-sort="' + key + '">' + label + ' <i class="bi ' + icon + '"></i></button>';
  }

  function renderList() {
    var list = getRows();
    var el = rootEl.querySelector('#client-list');

    if (!list.length) {
      el.innerHTML = query
        ? '<div class="empty-state"><i class="bi bi-search"></i><h3>No matches</h3><p>Try a different search.</p></div>'
        : '<div class="empty-state"><i class="bi bi-person-plus"></i><h3>No clients yet</h3>\
            <p>Add your first client to autofill invoice details.</p>\
            </div>';
      return;
    }

    el.innerHTML = '<table class="data-table"><thead><tr>\
      <th style="width:72px"></th>\
      <th>' + sortHead('name', 'Client') + '</th>\
      <th>' + sortHead('contactName', 'Contact') + '</th>\
      <th>' + sortHead('email', 'Email') + '</th>\
      <th>' + sortHead('phone', 'Phone') + '</th>\
      <th>' + sortHead('taxId', 'Tax ID') + '</th>\
      <th>' + sortHead('address', 'Billing address') + '</th>\
      <th></th>\
      </tr></thead><tbody>' + list.map(function (client) {
      var logoHtml = client.logo ? '<img class="list-logo" src="' + App.util.escapeHtml(client.logo) + '" alt="logo">' : '<div class="logo-placeholder"><i class="bi bi-image"></i></div>';
      return '<tr data-id="' + client.id + '">\
          <td class="logo-col">' + logoHtml + '</td>\
          <td><strong>' + App.util.escapeHtml(displayName(client)) + '</strong></td>\
          <td>' + App.util.escapeHtml(client.contactName || '-') + '</td>\
          <td>' + App.util.escapeHtml(client.email || '-') + '</td>\
          <td>' + App.util.escapeHtml(client.phone || '-') + '</td>\
          <td>' + App.util.escapeHtml(client.taxId || '-') + '</td>\
          <td class="table-long">' + App.util.escapeHtml(client.address || '-') + '</td>\
          <td><div class="row-actions">\
            <button class="btn btn-ghost btn-sm" data-row-act="invoice" title="Create invoice"><i class="bi bi-receipt"></i></button>\
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

    el.querySelectorAll('tr[data-id]').forEach(function (tr) {
      var id = tr.getAttribute('data-id');
      tr.addEventListener('click', function (e) {
        var actBtn = e.target.closest('[data-row-act]');
        if (!actBtn) {
          App.router.navigate({ page: 'client-editor', id: id });
          return;
        }
        e.stopPropagation();
        var act = actBtn.getAttribute('data-row-act');
        if (act === 'invoice') {
          App.router.navigate({ page: 'templates', client: id });
        } else if (act === 'delete') {
          deleteClient(id);
        }
      });
    });
  }

  function deleteClient(id) {
    var client = App.store.getClient(id);
    if (!client) return;
    confirmDelete(client).then(function (confirmed) {
      if (!confirmed) return;
      App.store.deleteClient(id);
      renderList();
      App.toast('Client deleted', 'info');
    });
  }

  function mount(root) {
    rootEl = root;
    query = '';
    sort = { key: 'name', dir: 'asc' };
    renderList();

    root.querySelector('[data-act="new"]').addEventListener('click', function () {
      App.router.navigate({ page: 'client-editor' });
    });
    var search = root.querySelector('#client-search');
    search.addEventListener('input', App.util.debounce(function () {
      query = search.value.trim();
      renderList();
    }, 150));
  }

  function unmount() { rootEl = null; }

  return { mount: mount, unmount: unmount };
})());
