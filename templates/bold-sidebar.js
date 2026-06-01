/* ============================================================
   Built-in template: Bold Sidebar (block document model)
   A colored left column holds branding; the body stays crisp.
   ============================================================ */
(function () {
  var m = App.doc.make;
  function col(flex, blocks, style) { return { style: Object.assign({ flex: flex }, style || {}), blocks: blocks }; }
  var ACCENT = '#0f766e';

  var model = {
    page: { accent: ACCENT, fontFamily: '"Segoe UI", Helvetica, Arial, sans-serif', color: '#1f2937', padding: 0, background: '#ffffff' },
    blocks: [
      m('columns', { gap: 0, valign: 'stretch' }, { marginBottom: 0 }, { columns: [
        /* --- Colored sidebar --- */
        col('0 0 250px', [
          m('image', { bind: 'seller.logo', src: '', width: 150, invert: true }, { align: 'left', marginBottom: 16 }),
          m('field', { binding: 'seller.name', label: '' }, { fontSize: 22, bold: true, marginBottom: 22 }),
          m('text', { text: 'FROM' }, { fontSize: 11, bold: true, letterSpacing: 0.12, uppercase: true, marginBottom: 6 }),
          m('field', { binding: 'seller.address', label: '' }, { fontSize: 13, marginBottom: 18 }),
          m('text', { text: 'CONTACT' }, { fontSize: 11, bold: true, letterSpacing: 0.12, uppercase: true, marginBottom: 6 }),
          m('field', { binding: 'seller.email', label: '' }, { fontSize: 13 }),
          m('field', { binding: 'seller.phone', label: '' }, { fontSize: 13, marginBottom: 18 }),
          m('field', { binding: 'seller.taxId', label: 'Tax ID', layout: 'stacked' }, { fontSize: 13 })
        ], { bg: ACCENT, color: '#ffffff', padding: 40, minHeight: 1123 }),
        /* --- Main body --- */
        col('1', [
          m('heading', { text: 'INVOICE' }, { fontSize: 36, bold: true, color: ACCENT, marginBottom: 4 }),
          m('field', { binding: 'invoice.number', label: '' }, { fontSize: 14, color: '#6b7280', marginBottom: 26 }),
          m('columns', { gap: 20 }, { marginBottom: 22 }, { columns: [
            col('1', [
              m('text', { text: 'BILL TO' }, { fontSize: 11, bold: true, color: '#9ca3af', letterSpacing: 0.1, uppercase: true, marginBottom: 6 }),
              m('field', { binding: 'client.name', label: '' }, { fontSize: 15, bold: true, marginBottom: 2 }),
              m('field', { binding: 'client.address', label: '' }, { fontSize: 13, color: '#6b7280' }),
              m('field', { binding: 'client.email', label: '' }, { fontSize: 13, color: '#6b7280' })
            ]),
            col('0 0 170px', [
              m('field', { binding: 'invoice.issueDate', label: 'Issued', layout: 'inline' }, { fontSize: 13, align: 'right', marginBottom: 5 }),
              m('field', { binding: 'invoice.dueDate', label: 'Due', layout: 'inline' }, { fontSize: 13, align: 'right' })
            ])
          ]}),
          m('items', { columns: App.doc.ITEM_DEFAULT_COLS.slice(), headerBg: '#f3f4f6', headerColor: '#4b5563' }, { marginBottom: 8 }),
          m('totals', { showTax: true, width: 280 }, { align: 'right', marginTop: 8, marginBottom: 20 }),
          m('field', { binding: 'invoice.notes', label: 'Notes' }, { fontSize: 13, color: '#6b7280' })
        ], { padding: 44 })
      ]})
    ]
  };

  App.templates.register({
    id: 'bold-sidebar',
    name: 'Bold Sidebar',
    description: 'A vivid brand sidebar holds your details while the body stays crisp and readable.',
    model: model
  });
})();
