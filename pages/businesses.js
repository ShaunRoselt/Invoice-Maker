/* ============================================================
   Page: businesses — searchable, sortable sender profile table
   ============================================================ */
App.pages.register('businesses', (function () {
  var rootEl = null;
  var query = '';
  var sort = { key: 'name', dir: 'asc' };
  var selection = null;

  function displayName(business) {
    return business.name || business.contactName || 'Unnamed business';
  }

  function confirmDelete(business) {
    var dialogEl = document.querySelector('app-dialog');
    if (!dialogEl || typeof dialogEl.confirm !== 'function') return Promise.resolve(false);
    return dialogEl.confirm('Delete business ' + displayName(business) + '?', {
      title: 'Confirm deletion',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true
    });
  }

  function valueFor(business, key) {
    if (key === 'name') return displayName(business);
    if (key === 'logo') return (business.logo || business.hasLogo) ? 'yes' : 'no';
    return business[key] || '';
  }

  function getRows() {
    var list = App.store.getBusinesses();
    if (query) {
      var q = query.toLowerCase();
      list = list.filter(function (business) {
        return [
          business.name,
          business.contactName,
          business.email,
          business.phone,
          business.website,
          business.taxId,
          business.address
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

  function hydrateRowLogos(list) {
    list.forEach(function (business) {
      if (business.logo || !business.hasLogo) return;
      App.store.loadContactLogo('business', business.id).then(function (url) {
        if (!url) return;
        var row = rootEl.querySelector('#business-list tr[data-id="' + business.id + '"]');
        if (!row) return;
        var cell = row.querySelector('.logo-col');
        if (!cell) return;
        cell.innerHTML = '<img class="list-logo" src="' + App.util.escapeHtml(url) + '" alt="logo">';
      });
    });
  }

  function confirmBulkDelete(count) {
    var dialogEl = document.querySelector('app-dialog');
    var msg = count === 1 ? 'Delete 1 business?' : 'Delete ' + count + ' businesses?';
    if (dialogEl && typeof dialogEl.confirm === 'function') {
      return dialogEl.confirm(msg, { title: 'Delete businesses', confirmText: 'Delete', cancelText: 'Cancel', danger: true });
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
        if (act === 'invoice') {
          App.router.navigate({ page: 'templates', business: id });
        } else if (act === 'delete') {
          deleteBusiness(id);
        }
      });
    });
  }

  function renderList() {
    var list = getRows();
    var el = rootEl.querySelector('#business-list');
    var card = rootEl.querySelector('#business-list-card');
    var visibleIds = list.map(function (business) { return business.id; });
    if (selection) selection.prune(visibleIds);

    if (!list.length) {
      el.innerHTML = query
        ? '<div class="empty-state"><i class="bi bi-search"></i><h3>No matches</h3><p>Try a different search.</p></div>'
        : '<div class="empty-state"><i class="bi bi-building-add"></i><h3>No businesses yet</h3>\
            <p>Add a sender profile to autofill invoice business details.</p>\
            </div>';
      if (selection) selection.syncBulkBar(card);
      return;
    }

    var allSelected = visibleIds.length > 0 && visibleIds.every(function (id) { return selection && selection.has(id); });
    el.innerHTML = '<table class="data-table"><thead><tr>' +
      (selection ? selection.headerCell(allSelected) : '') +
      '<th style="width:72px"></th>\
      <th>' + sortHead('name', 'Business') + '</th>\
      <th>' + sortHead('contactName', 'Contact') + '</th>\
      <th>' + sortHead('email', 'Email') + '</th>\
      <th>' + sortHead('phone', 'Phone') + '</th>\
      <th>' + sortHead('taxId', 'Tax ID') + '</th>\
      <th>' + sortHead('address', 'Billing address') + '</th>\
      <th></th>\
      </tr></thead><tbody>' + list.map(function (business) {
      var logoHtml = business.logo
        ? '<img class="list-logo" src="' + App.util.escapeHtml(business.logo) + '" alt="logo">'
        : '<div class="logo-placeholder"><i class="bi bi-image"></i></div>';
      return '<tr data-id="' + business.id + '">' +
        (selection ? selection.rowCell(business.id) : '') +
        '<td class="logo-col">' + logoHtml + '</td>\
          <td><strong>' + App.util.escapeHtml(displayName(business)) + '</strong></td>\
          <td>' + App.util.escapeHtml(business.contactName || '-') + '</td>\
          <td>' + App.util.escapeHtml(business.email || '-') + '</td>\
          <td>' + App.util.escapeHtml(business.phone || '-') + '</td>\
          <td>' + App.util.escapeHtml(business.taxId || '-') + '</td>\
          <td class="table-long">' + App.util.escapeHtml(business.address || '-') + '</td>\
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

    hydrateRowLogos(list);
    bindRowActions(el);
    if (selection) {
      selection.bindTable(el.querySelector('table'), visibleIds, card, function (id) {
        App.router.navigate({ page: 'business-editor', id: id });
      });
    }
  }

  function deleteBusiness(id) {
    var business = App.store.getBusiness(id);
    if (!business) return;
    confirmDelete(business).then(function (confirmed) {
      if (!confirmed) return;
      App.store.deleteBusiness(id).then(function () {
        renderList();
        App.toast('Business deleted', 'info');
      }).catch(function (err) {
        App.toast((err && err.message) || 'Could not delete business', 'error');
      });
    });
  }

  function mount(root) {
    rootEl = root;
    query = '';
    sort = { key: 'name', dir: 'asc' };
    selection = App.listSelection({
      singular: 'business',
      plural: 'businesses',
      onChange: function () { renderList(); },
      onBulkDelete: function (ids) {
        confirmBulkDelete(ids.length).then(function (confirmed) {
          if (!confirmed) return;
          Promise.all(ids.map(function (id) { return App.store.deleteBusiness(id); })).then(function () {
            selection.clear();
            App.toast(ids.length === 1 ? 'Business deleted' : (ids.length + ' businesses deleted'), 'info');
            renderList();
          }).catch(function (err) {
            App.toast((err && err.message) || 'Could not delete businesses', 'error');
            renderList();
          });
        });
      }
    });
    renderList();

    root.querySelector('[data-act="new"]').addEventListener('click', function () {
      App.router.navigate({ page: 'business-editor' });
    });
    var search = root.querySelector('#business-search');
    search.addEventListener('input', App.util.debounce(function () {
      query = search.value.trim();
      renderList();
    }, 150));
  }

  function unmount() { rootEl = null; selection = null; }

  return { mount: mount, unmount: unmount };
})());
