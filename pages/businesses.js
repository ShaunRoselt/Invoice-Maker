/* ============================================================
   Page: businesses — searchable, sortable sender profile table
   ============================================================ */
App.pages.register('businesses', (function () {
  var rootEl = null;
  var query = '';
  var sort = { key: 'name', dir: 'asc' };

  function displayName(business) {
    return business.name || 'Unnamed business';
  }

  function valueFor(business, key) {
    if (key === 'name') return displayName(business);
    if (key === 'logo') return business.logo ? 'yes' : 'no';
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

  function renderList() {
    var list = getRows();
    var el = rootEl.querySelector('#business-list');

    if (!list.length) {
      el.innerHTML = query
        ? '<div class="empty-state"><i class="bi bi-search"></i><h3>No matches</h3><p>Try a different search.</p></div>'
        : '<div class="empty-state"><i class="bi bi-building-add"></i><h3>No businesses yet</h3>\
            <p>Add a sender profile to autofill invoice business details.</p>\
            </div>';
      return;
    }

    el.innerHTML = '<table class="data-table"><thead><tr>\
      <th>' + sortHead('logo', 'Logo') + '</th>\
      <th>' + sortHead('name', 'Business') + '</th>\
      <th>' + sortHead('email', 'Email') + '</th>\
      <th>' + sortHead('phone', 'Phone') + '</th>\
      <th>' + sortHead('taxId', 'Tax ID') + '</th>\
      <th>' + sortHead('address', 'Address') + '</th>\
      <th></th>\
      </tr></thead><tbody>' + list.map(function (business) {
      return '<tr data-id="' + business.id + '">\
          <td>' + (business.logo ? '<span class="table-logo"><img src="' + App.util.escapeHtml(business.logo) + '" alt=""></span>' : '<span class="text-muted">-</span>') + '</td>\
          <td><strong>' + App.util.escapeHtml(displayName(business)) + '</strong></td>\
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

    el.querySelectorAll('tr[data-id]').forEach(function (tr) {
      var id = tr.getAttribute('data-id');
      tr.addEventListener('click', function (e) {
        var actBtn = e.target.closest('[data-row-act]');
        if (!actBtn) {
          App.router.navigate({ page: 'business-editor', id: id });
          return;
        }
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

  function deleteBusiness(id) {
    var business = App.store.getBusiness(id);
    if (!business) return;
    if (!confirm('Delete business ' + displayName(business) + '?')) return;
    App.store.deleteBusiness(id);
    renderList();
    App.toast('Business deleted', 'info');
  }

  function mount(root) {
    rootEl = root;
    query = '';
    sort = { key: 'name', dir: 'asc' };
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

  function unmount() { rootEl = null; }

  return { mount: mount, unmount: unmount };
})());
