/* ============================================================
   Built-in template: Classic Corporate (block document model)
   ============================================================ */
(function () {
  var m = App.doc.make;
  function col(flex, blocks, style) { return { style: Object.assign({ flex: flex }, style || {}), blocks: blocks }; }
  var ACCENT = '#1e3a5f';

  var model = {
    page: { accent: ACCENT, fontFamily: 'Georgia, "Times New Roman", serif', color: '#1f2933', padding: 56, background: '#ffffff' },
    blocks: [
      m('columns', { gap: 24, valign: 'flex-start' }, { marginBottom: 18 }, { columns: [
        col('1', [
          m('image', { bind: 'seller.logo', src: '', width: 200 }, { align: 'left', marginBottom: 8 }),
          m('field', { binding: 'seller.name', label: '' }, { fontSize: 22, bold: true, color: ACCENT, marginBottom: 6 }),
          m('field', { binding: 'seller.address', label: '' }, { fontSize: 13, color: '#52606d' }),
          m('field', { binding: 'seller.email', label: '' }, { fontSize: 13, color: '#52606d' }),
          m('field', { binding: 'seller.phone', label: '' }, { fontSize: 13, color: '#52606d' })
        ]),
        col('0 0 230px', [
          m('heading', { text: 'INVOICE' }, { fontSize: 38, bold: true, color: ACCENT, align: 'right', letterSpacing: 0.06, marginBottom: 4 }),
          m('field', { binding: 'invoice.number', label: '', layout: 'stacked' }, { fontSize: 14, color: '#52606d', align: 'right' })
        ])
      ]}),
      m('divider', { color: ACCENT, thickness: 3 }, { marginTop: 4, marginBottom: 22 }),
      m('columns', { gap: 24 }, { marginBottom: 18 }, { columns: [
        col('1', [
          m('text', { text: 'BILL TO' }, { fontSize: 12, bold: true, color: ACCENT, letterSpacing: 0.08, marginBottom: 6 }),
          m('field', { binding: 'client.name', label: '' }, { fontSize: 16, bold: true, marginBottom: 2 }),
          m('field', { binding: 'client.address', label: '' }, { fontSize: 13, color: '#52606d' }),
          m('field', { binding: 'client.email', label: '' }, { fontSize: 13, color: '#52606d' })
        ]),
        col('0 0 230px', [
          m('field', { binding: 'invoice.issueDate', label: 'Issue Date', layout: 'inline' }, { fontSize: 13, align: 'right', marginBottom: 4 }),
          m('field', { binding: 'invoice.dueDate', label: 'Due Date', layout: 'inline' }, { fontSize: 13, align: 'right' })
        ])
      ]}),
      m('items', { columns: App.doc.ITEM_DEFAULT_COLS.slice(), headerBg: ACCENT, headerColor: '#ffffff' }, { marginBottom: 8 }),
      m('totals', { showTax: true, width: 290 }, { align: 'right', marginTop: 6, marginBottom: 20 }),
      m('field', { binding: 'invoice.notes', label: 'Notes' }, { fontSize: 13, color: '#52606d', marginBottom: 10 }),
      m('field', { binding: 'invoice.paymentInstructions', label: 'Payment' }, { fontSize: 13, color: '#52606d' })
    ]
  };

  App.templates.register({
    id: 'classic',
    name: 'Classic Corporate',
    description: 'Traditional serif layout with a navy header rule — timeless and formal.',
    model: model
  });
})();
