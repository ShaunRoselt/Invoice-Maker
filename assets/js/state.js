/* ============================================================
   state.js — tiny event bus + invoice factory/calculations
   ============================================================ */
window.App = window.App || {};

App.bus = (function () {
  var listeners = {};
  return {
    on: function (event, fn) {
      (listeners[event] = listeners[event] || []).push(fn);
      return function off() {
        listeners[event] = (listeners[event] || []).filter(function (f) { return f !== fn; });
      };
    },
    emit: function (event, payload) {
      (listeners[event] || []).forEach(function (fn) {
        try { fn(payload); } catch (e) { console.error(e); }
      });
    }
  };
})();

App.invoiceModel = (function () {
  function blankLineItem() {
    return { id: App.util.uuid('li'), description: '', qty: 1, rate: 0 };
  }

  // Build a fresh invoice prefilled from settings + chosen template.
  // A snapshot of the template's document model is stored on the invoice
  // so it keeps rendering correctly even if the template later changes.
  function createInvoice(templateId) {
    var settings = App.store.getSettings();
    var d = settings.defaults;
    var tpl = App.templates.get(templateId) || App.templates.getAll()[0];

    return {
      id: App.util.uuid('inv'),
      templateId: tpl ? tpl.id : 'classic',
      templateModel: tpl && tpl.model ? App.util.deepClone(tpl.model) : App.doc.defaultModel(),
      status: 'draft',
      meta: {
        number: App.store.peekInvoiceNumber(),
        title: 'Invoice',
        issueDate: App.util.todayISO(),
        dueDate: App.util.addDays(App.util.todayISO(), 30),
        currency: d.currency,
        poNumber: ''
      },
      seller: {
        name: '',
        address: '',
        email: '',
        phone: '',
        taxId: '',
        logo: ''
      },
      buyer: { name: '', contactName: '', address: '', email: '', phone: '', taxId: '' },
      lineItems: [blankLineItem()],
      taxRate: Number(d.taxRate) || 0,
      discount: 0,
      notes: d.notes || '',
      paymentInstructions: d.paymentInstructions || '',
      createdAt: null,
      updatedAt: null
    };
  }

  // Amount for a line: an explicit `amount` override wins, otherwise qty x rate.
  function lineAmount(li) {
    if (li && li.amount !== undefined && li.amount !== null && li.amount !== '') return Number(li.amount) || 0;
    return (Number(li && li.qty) || 0) * (Number(li && li.rate) || 0);
  }

  // Compute totals from an invoice. Returns { subtotal, tax, discount, total }.
  function computeTotals(invoice) {
    var subtotal = (invoice.lineItems || []).reduce(function (sum, li) {
      return sum + lineAmount(li);
    }, 0);
    var discount = Number(invoice.discount) || 0;
    var taxable = Math.max(0, subtotal - discount);
    var tax = taxable * ((Number(invoice.taxRate) || 0) / 100);
    var total = taxable + tax;
    return { subtotal: subtotal, discount: discount, tax: tax, total: total };
  }

  function applyClient(invoice, client) {
    if (!invoice || !client) return invoice;
    invoice.clientId = client.id || '';
    invoice.buyer = Object.assign(invoice.buyer || {}, {
      name: client.name || '',
      contactName: client.contactName || '',
      address: client.address || '',
      email: client.email || '',
      phone: client.phone || '',
      taxId: client.taxId || '',
      logo: client.logo || ''
    });
    return invoice;
  }

  function applyBusiness(invoice, business) {
    if (!invoice || !business) return invoice;
    invoice.businessId = business.id || '';
    invoice.seller = Object.assign(invoice.seller || {}, {
      name: business.name || '',
      address: business.address || '',
      email: business.email || '',
      phone: business.phone || '',
      taxId: business.taxId || '',
      logo: business.logo || ''
    });
    return invoice;
  }

  // Sample invoice for previews (template gallery, editor canvas).
  function sampleInvoice(templateId) {
    var inv = createInvoice(templateId);
    inv.meta.number = inv.meta.number || 'INV-1024';
    inv.seller.name = inv.seller.name || 'Northwind Studio';
    inv.seller.address = inv.seller.address || '123 Market Street\nSan Francisco, CA 94103';
    inv.seller.email = inv.seller.email || 'hello@northwind.studio';
    inv.seller.phone = inv.seller.phone || '+1 (555) 010-2030';
    inv.seller.taxId = inv.seller.taxId || 'US-123456789';
    inv.buyer = { name: 'Acme Corporation', contactName: 'Jordan Lee', address: '500 Oak Avenue\nAustin, TX 78701', email: 'ap@acme.com', phone: '+1 (555) 010-4450', taxId: 'US-987654321' };
    inv.lineItems = [
      { id: 'a', description: 'Brand identity design', qty: 1, rate: 2400 },
      { id: 'b', description: 'Website development (hours)', qty: 18, rate: 95 },
      { id: 'c', description: 'Hosting & setup', qty: 1, rate: 300 }
    ];
    inv.taxRate = inv.taxRate || 8;
    inv.notes = inv.notes || 'Thank you for your business!';
    inv.paymentInstructions = inv.paymentInstructions || 'Bank transfer — due within 30 days.';
    return inv;
  }

  return {
    blankLineItem: blankLineItem,
    createInvoice: createInvoice,
    applyBusiness: applyBusiness,
    applyClient: applyClient,
    sampleInvoice: sampleInvoice,
    computeTotals: computeTotals,
    lineAmount: lineAmount
  };
})();
