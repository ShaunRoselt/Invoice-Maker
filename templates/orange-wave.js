/* ============================================================
   Built-in template: Orange Wave
   Bold orange branding with a curved header blob, a striped
   description list and a payment-info footer.
   ============================================================ */
(function () {
  var m = App.doc.make;
  function col(flex, blocks, style) { return { style: Object.assign({ flex: flex }, style || {}), blocks: blocks }; }
  var ACCENT = '#ED5A2D';
  var INK = '#2a3340';
  var GREY = '#5a6b7b';

  var model = {
    page: { accent: ACCENT, fontFamily: '"Segoe UI", Helvetica, Arial, sans-serif', color: GREY, padding: 0, background: '#ffffff' },
    blocks: [
      /* --- Header: orange blob + INVOICE --- */
      m('columns', { gap: 0, valign: 'stretch' }, { marginBottom: 0 }, { columns: [
        col('0 0 300px', [
          m('field', { binding: 'seller.name', label: '' }, { fontSize: 26, bold: true, uppercase: true, letterSpacing: 0.01 })
        ], { bg: ACCENT, color: '#ffffff', padding: '48px 40px 60px', radius: '0 0 120px 0', minHeight: 120 }),
        col('1', [
          m('heading', { text: 'INVOICE' }, { fontSize: 44, bold: true, color: ACCENT, align: 'right', letterSpacing: 0.02 })
        ], { padding: '52px 44px' })
      ]}),

      /* --- Body: invoice-to / meta + item list --- */
      m('columns', { gap: 0 }, { marginBottom: 0 }, { columns: [
        col('1', [
          m('columns', { gap: 20 }, { marginBottom: 30 }, { columns: [
            col('1', [
              m('text', { text: 'INVOICE TO:' }, { fontSize: 13, bold: true, color: ACCENT, letterSpacing: 0.04, marginBottom: 6 }),
              m('field', { binding: 'client.name', label: '' }, { fontSize: 15, bold: true, color: ACCENT, marginBottom: 2 }),
              m('field', { binding: 'client.address', label: '' }, { fontSize: 13, color: GREY })
            ]),
            col('0 0 240px', [
              m('field', { binding: 'invoice.number', label: 'INVOICE#', layout: 'inline' }, { fontSize: 13, marginBottom: 8 }),
              m('field', { binding: 'invoice.issueDate', label: 'DATE', layout: 'inline' }, { fontSize: 13 })
            ])
          ]}),
          m('items', { columns: [{ key: 'description', label: 'ITEM DESCRIPTION' }, { key: 'qty', label: 'QTY' }, { key: 'rate', label: 'PRICE' }, { key: 'amount', label: 'AMOUNT' }], zebra: true, headerBg: '#ffffff', headerColor: INK }, { marginBottom: 0 })
        ], { padding: '30px 44px 0' })
      ]}),

      m('spacer', { height: 36 }),

      /* --- Footer: payment info + totals --- */
      m('divider', { color: ACCENT, thickness: 2 }, { padding: '0 44px', marginBottom: 0 }),
      m('columns', { gap: 24 }, { marginBottom: 0, padding: '16px 44px' }, { columns: [
        col('1', [
          m('text', { text: 'PAYMENT INFO' }, { fontSize: 15, bold: true, color: INK, marginBottom: 8 }),
          m('field', { binding: 'invoice.paymentInstructions', label: '' }, { fontSize: 13, color: GREY })
        ]),
        col('0 0 250px', [
          m('totals', { showTax: true, width: 250 }, { align: 'right' })
        ])
      ]}),

      /* --- Decorative bottom wave --- */
      m('text', { text: '' }, { bg: ACCENT, padding: '28px', radius: '120px 0 0 0', marginTop: 26 })
    ]
  };

  App.templates.register({
    id: 'orange-wave',
    name: 'Orange Wave',
    description: 'Vibrant orange branding with a curved header, striped item list and a payment-info footer.',
    model: model
  });
})();
