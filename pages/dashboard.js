/* ============================================================
   Page: dashboard
   ============================================================ */
App.pages.register('dashboard', (function () {
  function mount(root) {
    var invoices = App.store.getInvoices();
    var settings = App.store.getSettings();
    var cur = settings.defaults.currency;

    var totals = invoices.reduce(function (acc, inv) {
      var t = App.invoiceModel.computeTotals(inv).total;
      acc.count++;
      acc.all += t;
      if (inv.status === 'paid') acc.paid += t;
      else acc.outstanding += t;
      if (inv.status === 'draft') acc.drafts++;
      return acc;
    }, { count: 0, all: 0, paid: 0, outstanding: 0, drafts: 0 });

    var stats = [
      { label: 'Total invoiced', value: App.util.formatMoney(totals.all, cur), icon: 'bi-receipt', cls: 'i-total' },
      { label: 'Paid', value: App.util.formatMoney(totals.paid, cur), icon: 'bi-check2-circle', cls: 'i-paid' },
      { label: 'Outstanding', value: App.util.formatMoney(totals.outstanding, cur), icon: 'bi-hourglass-split', cls: 'i-out' },
      { label: 'Drafts', value: String(totals.drafts), icon: 'bi-pencil', cls: 'i-draft' }
    ];

    root.querySelector('#dash-stats').innerHTML = stats.map(function (s) {
      return '<div class="card stat-card">\
        <div class="stat-icon ' + s.cls + '"><i class="bi ' + s.icon + '"></i></div>\
        <div class="stat-label">' + s.label + '</div>\
        <div class="stat-value mono">' + s.value + '</div>\
      </div>';
    }).join('');

    // Make the stat cards clickable — navigate to the invoices page with
    // an appropriate filter for each stat.
    root.querySelectorAll('#dash-stats .stat-card').forEach(function (card, idx) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', function () {
        if (idx === 0) {
          App.router.navigate({ page: 'invoices' });
        } else if (idx === 1) {
          App.router.navigate({ page: 'invoices', status: 'paid' });
        } else if (idx === 2) {
          App.router.navigate({ page: 'invoices', status: 'outstanding' });
        } else if (idx === 3) {
          App.router.navigate({ page: 'invoices', status: 'draft' });
        }
      });
    });

    var recent = invoices.slice(0, 5);
    var recentEl = root.querySelector('#dash-recent');
    if (recentEl) {
      if (!recent.length) {
        recentEl.innerHTML = '<div class="empty-state"><i class="bi bi-inbox"></i><h3>No invoices yet</h3>\
        <p>Create your first invoice from a template.</p>\
        </div>';
      } else {
        recentEl.innerHTML = '<table class="data-table"><thead><tr>\
        <th>Number</th><th>Client</th><th>Issued</th><th class="text-right">Total</th><th>Status</th>\
        </tr></thead><tbody>' + recent.map(function (inv) {
          var t = App.invoiceModel.computeTotals(inv).total;
          return '<tr data-id="' + inv.id + '">\
            <td><strong>' + App.util.escapeHtml(inv.meta.number) + '</strong></td>\
            <td>' + App.util.escapeHtml(inv.buyer.name || '—') + '</td>\
            <td>' + App.util.formatDate(inv.meta.issueDate) + '</td>\
            <td class="text-right mono">' + App.util.formatMoney(t, inv.meta.currency) + '</td>\
            <td><span class="badge badge-' + inv.status + '">' + inv.status + '</span></td>\
          </tr>';
        }).join('') + '</tbody></table>';

        recentEl.querySelectorAll('tr[data-id]').forEach(function (tr) {
          tr.addEventListener('click', function () {
            App.router.navigate({ page: 'invoice-editor', id: tr.getAttribute('data-id') });
          });
        });
      }
    }

    root.querySelectorAll('[data-act="new"]').forEach(function (b) {
      b.addEventListener('click', function () { App.router.navigate({ page: 'templates' }); });
    });
    var link = root.querySelector('[data-link="invoices"]');
    if (link) link.addEventListener('click', function (e) { e.preventDefault(); App.router.navigate({ page: 'invoices' }); });
  }

  return { mount: mount };
})());
