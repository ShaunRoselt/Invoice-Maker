/* ============================================================
   storage.js — app persistence via IndexedDB (App.idb)
   ============================================================ */
window.App = window.App || {};

App.store = (function () {
  var KEYS = {
    settings: 'settings',
    invoices: 'invoices',
    templates: 'userTemplates',
    clients: 'clients',
    businesses: 'businesses',
    counter: 'counter'
  };

  function read(key, fallback) {
    if (!App.idb.isReady()) return fallback;
    var val = App.idb.getKv(key, undefined);
    return val !== undefined ? val : fallback;
  }

  function write(key, value) {
    App.idb.setKv(key, value).catch(function (e) {
      console.error('Storage write failed for', key, e);
      App.bus && App.bus.emit('storage:error', e);
    });
    return true;
  }

  function writeAsync(key, value) {
    return App.idb.setKv(key, value).catch(function (e) {
      console.error('Storage write failed for', key, e);
      App.bus && App.bus.emit('storage:error', e);
      throw e;
    });
  }

  function ready() {
    return App.idb.ready();
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
    if (!s) {
      d.defaults.currency = App.util.detectLocaleCurrency();
      write(KEYS.settings, d);
      return d;
    }
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

  function isInlineLogo(logo) {
    return !!(logo && String(logo).indexOf('data:') === 0);
  }

  function hydrateContactLogo(contact, type) {
    if (!contact) return contact;
    if (isInlineLogo(contact.logo)) {
      App.logoStore.prime(type, contact.id, contact.logo);
      contact.hasLogo = true;
      return contact;
    }
    if (contact.hasLogo) {
      var cached = App.logoStore.getCached(type, contact.id);
      if (cached !== undefined) contact.logo = cached;
    } else {
      contact.logo = contact.logo || '';
    }
    return contact;
  }

  function contactForDisk(contact) {
    var disk = Object.assign({}, contact);
    disk.hasLogo = !!(contact.logo || contact.hasLogo);
    disk.logo = '';
    return disk;
  }

  function loadContactLogo(type, id) {
    return App.logoStore.get(type, id).then(function (url) {
      return url || '';
    });
  }

  function ensureContactLogo(contact, type) {
    if (!contact) return Promise.resolve(contact);
    if (contact.logo) return Promise.resolve(contact);
    if (!contact.hasLogo) return Promise.resolve(contact);
    return loadContactLogo(type, contact.id).then(function (logo) {
      contact.logo = logo;
      return contact;
    });
  }

  function normalizeClient(client) {
    var c = Object.assign(emptyClient(), client || {});
    c.name = c.name || '';
    c.contactName = c.contactName || '';
    c.email = c.email || '';
    c.phone = c.phone || '';
    c.website = c.website || '';
    c.address = c.address || '';
    c.taxId = c.taxId || '';
    c.notes = c.notes || '';
    c.hasLogo = !!(client && (client.hasLogo || isInlineLogo(client.logo)));
    c.logo = c.logo || '';
    return hydrateContactLogo(c, 'client');
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
    var c = normalizeClient(client);
    var logoData = c.logo || '';
    return App.logoStore.put('client', c.id, logoData).then(function () {
      var list = read(KEYS.clients, []);
      var idx = -1;
      for (var i = 0; i < list.length; i++) { if (list[i].id === c.id) { idx = i; break; } }
      c.updatedAt = new Date().toISOString();
      c.hasLogo = !!logoData;
      var stored = contactForDisk(c);
      if (idx >= 0) {
        c.createdAt = c.createdAt || list[idx].createdAt || new Date().toISOString();
        stored.createdAt = c.createdAt;
        list[idx] = stored;
      } else {
        c.createdAt = c.createdAt || new Date().toISOString();
        stored.createdAt = c.createdAt;
        list.push(stored);
      }
      stored.updatedAt = c.updatedAt;
      return writeAsync(KEYS.clients, list).then(function () { return c; });
    });
  }

  function deleteClient(id) {
    return App.logoStore.put('client', id, '').then(function () {
      var list = read(KEYS.clients, []).filter(function (client) { return client.id !== id; });
      return writeAsync(KEYS.clients, list);
    });
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
    b.notes = b.notes || '';
    b.hasLogo = !!(business && (business.hasLogo || isInlineLogo(business.logo)));
    b.logo = b.logo || '';
    return hydrateContactLogo(b, 'business');
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
    var b = normalizeBusiness(business);
    var logoData = b.logo || '';
    return App.logoStore.put('business', b.id, logoData).then(function () {
      var list = read(KEYS.businesses, []);
      var idx = -1;
      for (var i = 0; i < list.length; i++) { if (list[i].id === b.id) { idx = i; break; } }
      b.updatedAt = new Date().toISOString();
      b.hasLogo = !!logoData;
      var stored = contactForDisk(b);
      if (idx >= 0) {
        b.createdAt = b.createdAt || list[idx].createdAt || new Date().toISOString();
        stored.createdAt = b.createdAt;
        list[idx] = stored;
      } else {
        b.createdAt = b.createdAt || new Date().toISOString();
        stored.createdAt = b.createdAt;
        list.push(stored);
      }
      stored.updatedAt = b.updatedAt;
      return writeAsync(KEYS.businesses, list).then(function () { return b; });
    });
  }

  function deleteBusiness(id) {
    return App.logoStore.put('business', id, '').then(function () {
      var list = read(KEYS.businesses, []).filter(function (business) { return business.id !== id; });
      return writeAsync(KEYS.businesses, list);
    });
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
    ready: ready,
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
    loadContactLogo: loadContactLogo,
    ensureContactLogo: ensureContactLogo,
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
