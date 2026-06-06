/* ============================================================
   Page: dashboard
   ============================================================ */
App.pages.register('dashboard', (function () {
  function t(key, vars) { return App.i18n.t(key, vars); }

  function mount(root) {
    var invoices = App.store.getInvoices();
    var settings = App.store.getSettings();
    var cur = settings.defaults.currency;

    var totals = invoices.reduce(function (acc, inv) {
      var t = App.invoiceModel.computeTotals(inv).total;
      acc.count++;
      acc.all += t;
      if (inv.status === 'paid') acc.paid += t;
      if (inv.status === 'sent') acc.sent += t;
      if (inv.status === 'overdue') acc.overdue += t;
      if (inv.status === 'sent' || inv.status === 'overdue') acc.outstanding += t;
      if (inv.status === 'draft') acc.drafts++;
      return acc;
    }, { count: 0, all: 0, paid: 0, sent: 0, overdue: 0, outstanding: 0, drafts: 0 });

    var stats = [
      { label: t('dashboard.totalInvoiced'), value: App.util.formatMoney(totals.all, cur), icon: 'bi-receipt', cls: 'i-total' },
      { label: t('status.paid'), value: App.util.formatMoney(totals.paid, cur), icon: 'bi-check2-circle', cls: 'i-paid', status: 'paid' },
      { label: t('status.sent'), value: App.util.formatMoney(totals.sent, cur), icon: 'bi-send', cls: 'i-sent', status: 'sent' },
      { label: t('status.overdue'), value: App.util.formatMoney(totals.overdue, cur), icon: 'bi-exclamation-circle', cls: 'i-overdue', status: 'overdue' },
      { label: t('status.outstanding'), value: App.util.formatMoney(totals.outstanding, cur), icon: 'bi-hourglass-split', cls: 'i-out', status: 'outstanding' },
      { label: t('dashboard.drafts'), value: String(totals.drafts), icon: 'bi-pencil', cls: 'i-draft', status: 'draft' }
    ];

    root.querySelector('#dash-stats').innerHTML = stats.map(function (s) {
      return '<div class="card stat-card"' + (s.status ? ' data-status="' + s.status + '"' : '') + '>\
        <div class="stat-icon ' + s.cls + '"><i class="bi ' + s.icon + '"></i></div>\
        <div class="stat-label">' + s.label + '</div>\
        <div class="stat-value mono">' + s.value + '</div>\
      </div>';
    }).join('');

    // Make the stat cards clickable — navigate to the invoices page with
    // an appropriate filter for each stat.
    root.querySelectorAll('#dash-stats .stat-card').forEach(function (card) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', function () {
        var status = card.getAttribute('data-status');
        if (status) {
          App.router.navigate({ page: 'invoices', status: status });
        } else {
          App.router.navigate({ page: 'invoices' });
        }
      });
    });

    // Charts.css chart: invoice totals by status
    var chartEl = root.querySelector('#dash-chart');
    if (chartEl) {
      var chartData = [
        { label: t('status.paid'), value: totals.paid },
        { label: t('status.sent'), value: totals.sent },
        { label: t('status.overdue'), value: totals.overdue },
        { label: t('status.outstanding'), value: totals.outstanding }
      ];
      var maxVal = Math.max.apply(null, chartData.map(function (d) { return d.value; }));
      if (!maxVal) {
        chartEl.innerHTML = '<div class="empty-state"><i class="bi bi-bar-chart"></i><h3>' + App.util.escapeHtml(t('dashboard.noChartData')) + '</h3><p>' + App.util.escapeHtml(t('dashboard.noChartDataHint')) + '</p></div>';
      } else {
        var table = '<div id="dash-chart-wrapper">' +
          '<table class="charts-css column show-labels show-primary-axis show-data-axes data-spacing-10">' +
          '<caption>' + App.util.escapeHtml(t('dashboard.chartCaption')) + '</caption>' +
          '<thead><tr><th scope="col">' + App.util.escapeHtml(t('common.status')) + '</th><th scope="col">' + App.util.escapeHtml(t('common.amount')) + '</th></tr></thead>' +
          '<tbody>' + chartData.map(function (d) {
            var size = (d.value / maxVal);
            return '<tr><th scope="row">' + App.util.escapeHtml(d.label) + '</th>' +
              '<td style="--size:' + size + '"><span class="data">' + App.util.formatMoney(d.value, cur) + '</span></td></tr>';
          }).join('') + '</tbody></table></div>';
        chartEl.innerHTML = table;
      }
    }

    var recent = invoices.slice(0, 5);
    var recentEl = root.querySelector('#dash-recent');
    if (recentEl) {
      if (!recent.length) {
        recentEl.innerHTML = '<div class="empty-state"><i class="bi bi-inbox"></i><h3>' + App.util.escapeHtml(t('dashboard.noInvoicesYet')) + '</h3>\
        <p>' + App.util.escapeHtml(t('dashboard.noInvoicesHint')) + '</p>\
        </div>';
      } else {
        recentEl.innerHTML = '<table class="data-table"><thead><tr>\
        <th>' + App.util.escapeHtml(t('common.number')) + '</th><th>' + App.util.escapeHtml(t('common.client')) + '</th><th>' + App.util.escapeHtml(t('common.issued')) + '</th><th class="text-right">' + App.util.escapeHtml(t('common.total')) + '</th><th>' + App.util.escapeHtml(t('common.status')) + '</th>\
        </tr></thead><tbody>' + recent.map(function (inv) {
          var tTotal = App.invoiceModel.computeTotals(inv).total;
          return '<tr data-id="' + inv.id + '">\
            <td><strong>' + App.util.escapeHtml(inv.meta.number) + '</strong></td>\
            <td>' + App.util.escapeHtml(inv.buyer.name || '—') + '</td>\
            <td>' + App.util.formatDate(inv.meta.issueDate) + '</td>\
            <td class="text-right mono">' + App.util.formatMoney(tTotal, inv.meta.currency) + '</td>\
            <td><span class="badge badge-' + inv.status + '">' + App.util.escapeHtml(App.i18n.statusLabel(inv.status)) + '</span></td>\
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
