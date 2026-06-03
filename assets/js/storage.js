/* ============================================================
   storage.js — localStorage persistence layer
   ============================================================ */
window.App = window.App || {};

App.store = (function () {
  var PREFIX = 'roseltInvoiceGenerator_v1_';
  var KEYS = {
    settings: PREFIX + 'settings',
    invoices: PREFIX + 'invoices',
    templates: PREFIX + 'userTemplates',
    clients: PREFIX + 'clients',
    businesses: PREFIX + 'businesses',
    counter: PREFIX + 'counter'
  };

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('Storage read failed for', key, e);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Storage write failed for', key, e);
      App.bus && App.bus.emit('storage:error', e);
      return false;
    }
  }

  /* ---------------- Settings ---------------- */
  function defaultSettings() {
    return {
      language: 'en',
      betaMode: false,
      business: { name: '', address: '', email: '', phone: '', taxId: '', logo: '' },
      defaults: {
        currency: 'USD',
        taxRate: 0,
        paymentTerms: 'Net 30',
        numberPrefix: 'INV-',
        notes: 'Thank you for your business!',
        paymentInstructions: ''
      }
    };
  }

  function getSettings() {
    var s = read(KEYS.settings, null);
    var d = defaultSettings();
    if (!s) return d;
    return {
      language: s.language || d.language,
      betaMode: typeof s.betaMode === 'boolean' ? s.betaMode : d.betaMode,
      business: Object.assign({}, d.business, s.business || {}),
      defaults: Object.assign({}, d.defaults, s.defaults || {})
    };
  }

  function saveSettings(settings) {
    return write(KEYS.settings, settings);
  }

  /* ---------------- Invoices ---------------- */
  function getInvoices() {
    return read(KEYS.invoices, []);
  }

  function getInvoice(id) {
    return getInvoices().filter(function (inv) { return inv.id === id; })[0] || null;
  }

  function saveInvoice(invoice) {
    var list = getInvoices();
    var idx = -1;
    for (var i = 0; i < list.length; i++) { if (list[i].id === invoice.id) { idx = i; break; } }
    invoice.updatedAt = new Date().toISOString();
    if (idx >= 0) {
      list[idx] = invoice;
    } else {
      invoice.createdAt = invoice.createdAt || new Date().toISOString();
      list.unshift(invoice);
    }
    write(KEYS.invoices, list);
    return invoice;
  }

  function deleteInvoice(id) {
    var list = getInvoices().filter(function (inv) { return inv.id !== id; });
    return write(KEYS.invoices, list);
  }

  /* ---------------- Clients ---------------- */
  function emptyClient() {
    return {
      id: App.util.uuid('client'),
      name: '',
      contactName: '',
      email: '',
      phone: '',
      website: '',
      address: '',
      taxId: '',
      logo: '',
      notes: '',
      createdAt: null,
      updatedAt: null
    };
  }

  function normalizeClient(client) {
    var c = Object.assign(emptyClient(), client || {});
    c.name = c.name || '';
    c.contactName = c.contactName || '';
    c.email = c.email || '';
    c.phone = c.phone || '';
    c.website = c.website || '';
    c.address = c.address || '';
    c.logo = c.logo || '';
    c.taxId = c.taxId || '';
    c.notes = c.notes || '';
    return c;
  }

  function getClients() {
    return read(KEYS.clients, []).map(normalizeClient).sort(function (a, b) {
      return String(a.name || a.contactName || '').localeCompare(String(b.name || b.contactName || ''));
    });
  }

  function getClient(id) {
    return getClients().filter(function (client) { return client.id === id; })[0] || null;
  }

  function saveClient(client) {
    var list = getClients();
    var c = normalizeClient(client);
    var idx = -1;
    for (var i = 0; i < list.length; i++) { if (list[i].id === c.id) { idx = i; break; } }
    c.updatedAt = new Date().toISOString();
    if (idx >= 0) {
      c.createdAt = c.createdAt || list[idx].createdAt || new Date().toISOString();
      list[idx] = c;
    } else {
      c.createdAt = c.createdAt || new Date().toISOString();
      list.push(c);
    }
    write(KEYS.clients, list);
    return c;
  }

  function deleteClient(id) {
    var list = getClients().filter(function (client) { return client.id !== id; });
    return write(KEYS.clients, list);
  }

  /* ---------------- Businesses ---------------- */
  function emptyBusiness() {
    return {
      id: App.util.uuid('biz'),
      name: '',
      contactName: '',
      email: '',
      phone: '',
      website: '',
      address: '',
      taxId: '',
      logo: '',
      notes: '',
      createdAt: null,
      updatedAt: null
    };
  }

  function normalizeBusiness(business) {
    var b = Object.assign(emptyBusiness(), business || {});
    b.name = b.name || '';
    b.contactName = b.contactName || '';
    b.address = b.address || '';
    b.email = b.email || '';
    b.phone = b.phone || '';
    b.website = b.website || '';
    b.taxId = b.taxId || '';
    b.logo = b.logo || '';
    b.notes = b.notes || '';
    return b;
  }

  function getBusinesses() {
    var list = read(KEYS.businesses, []);
    if (!list.length) {
      var oldSettings = read(KEYS.settings, null);
      var oldBusiness = oldSettings && oldSettings.business;
      if (oldBusiness && (oldBusiness.name || oldBusiness.address || oldBusiness.email || oldBusiness.phone || oldBusiness.taxId || oldBusiness.logo)) {
        list = [Object.assign({ id: App.util.uuid('biz'), notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, oldBusiness)];
        write(KEYS.businesses, list);
      }
    }
    return list.map(normalizeBusiness).sort(function (a, b) {
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  function getBusiness(id) {
    return getBusinesses().filter(function (business) { return business.id === id; })[0] || null;
  }

  function saveBusiness(business) {
    var list = getBusinesses();
    var b = normalizeBusiness(business);
    var idx = -1;
    for (var i = 0; i < list.length; i++) { if (list[i].id === b.id) { idx = i; break; } }
    b.updatedAt = new Date().toISOString();
    if (idx >= 0) {
      b.createdAt = b.createdAt || list[idx].createdAt || new Date().toISOString();
      list[idx] = b;
    } else {
      b.createdAt = b.createdAt || new Date().toISOString();
      list.push(b);
    }
    write(KEYS.businesses, list);
    return b;
  }

  function deleteBusiness(id) {
    var list = getBusinesses().filter(function (business) { return business.id !== id; });
    return write(KEYS.businesses, list);
  }

  /* ---------------- User templates ---------------- */
  function getUserTemplates() {
    return read(KEYS.templates, []);
  }

  function saveUserTemplate(tpl) {
    var list = getUserTemplates();
    var idx = -1;
    for (var i = 0; i < list.length; i++) { if (list[i].id === tpl.id) { idx = i; break; } }
    tpl.updatedAt = new Date().toISOString();
    if (idx >= 0) list[idx] = tpl;
    else { tpl.createdAt = new Date().toISOString(); list.push(tpl); }
    write(KEYS.templates, list);
    return tpl;
  }

  function deleteUserTemplate(id) {
    var list = getUserTemplates().filter(function (t) { return t.id !== id; });
    return write(KEYS.templates, list);
  }

  /* ---------------- Invoice number counter ---------------- */
  function nextInvoiceNumber() {
    var prefix = getSettings().defaults.numberPrefix || 'INV-';
    var n = read(KEYS.counter, 1000) + 1;
    write(KEYS.counter, n);
    return prefix + String(n).padStart(4, '0');
  }

  function peekInvoiceNumber() {
    var prefix = getSettings().defaults.numberPrefix || 'INV-';
    var n = read(KEYS.counter, 1000) + 1;
    return prefix + String(n).padStart(4, '0');
  }

  return {
    KEYS: KEYS,
    defaultSettings: defaultSettings,
    getSettings: getSettings,
    saveSettings: saveSettings,
    getInvoices: getInvoices,
    getInvoice: getInvoice,
    saveInvoice: saveInvoice,
    deleteInvoice: deleteInvoice,
    emptyClient: emptyClient,
    getClients: getClients,
    getClient: getClient,
    saveClient: saveClient,
    deleteClient: deleteClient,
    emptyBusiness: emptyBusiness,
    getBusinesses: getBusinesses,
    getBusiness: getBusiness,
    saveBusiness: saveBusiness,
    deleteBusiness: deleteBusiness,
    getUserTemplates: getUserTemplates,
    saveUserTemplate: saveUserTemplate,
    deleteUserTemplate: deleteUserTemplate,
    nextInvoiceNumber: nextInvoiceNumber,
    peekInvoiceNumber: peekInvoiceNumber
  };
})();
