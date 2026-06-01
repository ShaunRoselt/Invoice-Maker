/* ============================================================
   Built-in template: Modern Minimal (block document model)
   ============================================================ */
(function () {
  var m = App.doc.make;
  function col(flex, blocks, style) { return { style: Object.assign({ flex: flex }, style || {}), blocks: blocks }; }
  var ACCENT = '#4f46e5';

  var model = {
    page: { accent: ACCENT, fontFamily: '"Segoe UI", Helvetica, Arial, sans-serif', color: '#111827', padding: 60, background: '#ffffff' },
    blocks: [
      m('columns', { gap: 24, valign: 'flex-start' }, { marginBottom: 36 }, { columns: [
        col('1', [
          m('image', { bind: 'seller.logo', src: '', width: 150 }, { align: 'left', marginBottom: 8 }),
          m('field', { binding: 'seller.name', label: '' }, { fontSize: 20, bold: true, marginBottom: 6 }),
          m('field', { binding: 'seller.address', label: '' }, { fontSize: 13, color: '#6b7280' }),
          m('field', { binding: 'seller.email', label: '' }, { fontSize: 13, color: '#6b7280' }),
          m('field', { binding: 'seller.phone', label: '' }, { fontSize: 13, color: '#6b7280' })
        ]),
        col('0 0 220px', [
          m('heading', { text: 'Invoice' }, { fontSize: 30, bold: true, align: 'right', marginBottom: 6 }),
          m('field', { binding: 'invoice.number', label: '' }, { fontSize: 14, color: ACCENT, bold: true, align: 'right' })
        ])
      ]}),
      m('columns', { gap: 40 }, { marginBottom: 28 }, { columns: [
        col('1', [
          m('text', { text: 'BILLED TO' }, { fontSize: 11, bold: true, color: '#9ca3af', letterSpacing: 0.1, uppercase: true, marginBottom: 8 }),
          m('field', { binding: 'client.name', label: '' }, { fontSize: 15, bold: true, marginBottom: 2 }),
          m('field', { binding: 'client.address', label: '' }, { fontSize: 13, color: '#6b7280' }),
          m('field', { binding: 'client.email', label: '' }, { fontSize: 13, color: '#6b7280' })
        ]),
        col('1', [
          m('field', { binding: 'invoice.issueDate', label: 'Issue date', layout: 'inline' }, { fontSize: 13, marginBottom: 6 }),
          m('field', { binding: 'invoice.dueDate', label: 'Due date', layout: 'inline' }, { fontSize: 13, marginBottom: 6 }),
          m('field', { binding: 'invoice.poNumber', label: 'PO number', layout: 'inline' }, { fontSize: 13 })
        ])
      ]}),
      m('items', { columns: App.doc.ITEM_DEFAULT_COLS.slice(), headerBg: '#111827', headerColor: '#ffffff' }, { marginBottom: 8 }),
      m('totals', { showTax: true, width: 300 }, { align: 'right', marginTop: 8, marginBottom: 28 }),
      m('field', { binding: 'invoice.notes', label: 'Notes' }, { fontSize: 13, color: '#6b7280', marginBottom: 10 }),
      m('field', { binding: 'invoice.paymentInstructions', label: 'Payment instructions' }, { fontSize: 13, color: '#6b7280' })
    ]
  };

  App.templates.register({
    id: 'modern',
    name: 'Modern Minimal',
    description: 'Bold sans-serif type, airy spacing and a highlighted total — clean and current.',
    model: model
  });
})();
