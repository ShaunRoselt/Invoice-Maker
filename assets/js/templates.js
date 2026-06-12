/* ============================================================
  templates.js — registry + loader for invoice templates.

  A template is { id, name, description, model } where `model`
  is a block document (see doc.js).

  Built-in templates are loaded from JSON files in /templates
  using templates/manifest.json.
  Custom templates are stored in IndexedDB and store their own model.
  ============================================================ */
window.App = window.App || {};

App.templates = (function () {
  var builtIn = {};   // id -> { id, name, description, model, builtIn:true }
  var builtInsReady = null;

  function betaEnabled() {
    try {
      var s = (App.store && typeof App.store.getSettings === 'function') ? App.store.getSettings() : null;
      return !!(s && s.betaMode);
    } catch (e) {
      return false;
    }
  }

  function register(def) {
    if (!def || !def.id) { console.warn('Template missing id', def); return; }
    def.builtIn = true;
    builtIn[def.id] = def;
  }

  function applyKnownModelFixes(model, templateId) {
    if (!model || templateId !== 'orange-wave') return model;
    var blocks = Array.isArray(model.blocks) ? model.blocks : [];
    var footer = blocks.length ? blocks[blocks.length - 1] : null;
    if (!footer || footer.type !== 'text') return model;
    footer.style = footer.style || {};
    if (String(footer.style.bg || '').toLowerCase() !== '#ed5a2d') return model;
    if (String(footer.style.radius || '') !== '120px 0 0 0') return model;
    footer.style.marginTop = 'auto';
    footer.style.marginBottom = 0;
    return model;
  }

  function normalizeModel(model, templateId) {
    model = model || App.doc.defaultModel();
    model.page = model.page || {};
    model.blocks = Array.isArray(model.blocks) ? model.blocks : [];

    function walk(blocks) {
      (blocks || []).forEach(function (b) {
        if (!b) return;
        if (!b.id) b.id = (App.doc && typeof App.doc.newId === 'function') ? App.doc.newId() : App.util.uuid('blk');
        b.props = b.props || {};
        b.style = b.style || {};
        if (b.type === 'columns') {
          b.columns = Array.isArray(b.columns) ? b.columns : [];
          b.columns.forEach(function (c) {
            if (!c) return;
            c.style = c.style || {};
            c.blocks = Array.isArray(c.blocks) ? c.blocks : [];
            walk(c.blocks);
          });
        }
      });
    }

    walk(model.blocks);
    return applyKnownModelFixes(model, templateId);
  }

  function loadBuiltIns() {
    if (builtInsReady) return builtInsReady;
    builtInsReady = fetch('templates/manifest.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('Missing templates/manifest.json');
        return res.json();
      })
      .then(function (manifest) {
        var list = (manifest && manifest.builtins) ? manifest.builtins : [];
        if (!Array.isArray(list) || !list.length) return null;

        // Load each JSON template and register it.
        return Promise.all(list.map(function (name) {
          var url = (String(name).indexOf('/') >= 0) ? String(name) : ('templates/' + String(name));
          return fetch(url, { cache: 'no-cache' })
            .then(function (r) { if (!r.ok) throw new Error('Failed to fetch ' + url); return r.json(); })
            .then(function (def) {
              if (!def || !def.id) return;
              if (def.model) def.model = normalizeModel(def.model, def.id);
              register(def);
            })
            .catch(function (e) {
              console.error('Template load failed for ' + url, e);
            });
        }));
      })
      .catch(function (e) {
        console.error('Built-in templates failed to load', e);
        return null;
      });
    return builtInsReady;
  }

  function getAll() {
    var list = [];
    Object.keys(builtIn).forEach(function (id) { list.push(builtIn[id]); });
    if (betaEnabled()) {
      App.store.getUserTemplates().forEach(function (u) {
        list.push({ id: u.id, name: u.name, description: u.description || 'Custom template', model: u.model, builtIn: false });
      });
    }
    return list;
  }

  function get(id) {
    if (!id) return null;
    if (builtIn[id]) return builtIn[id];
    if (!betaEnabled()) return null;
    var u = App.store.getUserTemplates().filter(function (t) { return t.id === id; })[0];
    return u ? { id: u.id, name: u.name, description: u.description || 'Custom template', model: u.model, builtIn: false } : null;
  }

  // Resolve the document model used to render a given invoice:
  // prefer the snapshot stored on the invoice, then the template,
  // then any template, then a default.
  function modelFor(invoice) {
    if (invoice && invoice.templateModel) return normalizeModel(invoice.templateModel, invoice.templateId);
    var tpl = get(invoice && invoice.templateId);
    if (tpl && tpl.model) return normalizeModel(tpl.model, tpl.id);
    var all = getAll();
    if (all[0] && all[0].model) return normalizeModel(all[0].model, all[0].id);
    return App.doc.defaultModel();
  }

  // Render an invoice to a DOM element (clean output — PDF, read-only preview).
  function renderInvoice(invoice, opts) {
    return App.doc.render(modelFor(invoice), invoice, opts || {});
  }

  // Invoice editor only — A4 paper with inline editing enabled.
  function renderEditorView(invoice) {
    var paper = document.createElement('div');
    paper.className = 'invoice-paper';
    paper.appendChild(App.doc.render(modelFor(invoice), invoice, { dataEdit: true }));
    return paper;
  }

  // Templates gallery — read-only A4 preview (no contenteditable / add-item UI).
  function renderGalleryView(invoice) {
    var paper = document.createElement('div');
    paper.className = 'invoice-paper invoice-paper--readonly';
    paper.appendChild(App.doc.render(modelFor(invoice), invoice, {}));
    return paper;
  }

  // Fresh invoice for a template — identical to createInvoice() on the Use button.
  function previewInvoice(templateId) {
    return App.invoiceModel.createInvoice(templateId);
  }

  return {
    register: register,
    ready: loadBuiltIns,
    getAll: getAll,
    get: get,
    modelFor: modelFor,
    renderInvoice: renderInvoice,
    renderEditorView: renderEditorView,
    renderGalleryView: renderGalleryView,
    previewInvoice: previewInvoice
  };
})();

// Start loading built-ins ASAP.
if (App.templates && typeof App.templates.ready === 'function') App.templates.ready();
