/* ============================================================
   templates.js — registry of invoice templates.

   A template is { id, name, description, model } where `model`
   is a block document (see doc.js). Built-in templates register
   here; custom templates live in localStorage and store their own
   model JSON.
   ============================================================ */
window.App = window.App || {};

App.templates = (function () {
  var builtIn = {};   // id -> { id, name, description, model, builtIn:true }

  function register(def) {
    if (!def || !def.id) { console.warn('Template missing id', def); return; }
    def.builtIn = true;
    builtIn[def.id] = def;
  }

  function getAll() {
    var list = [];
    Object.keys(builtIn).forEach(function (id) { list.push(builtIn[id]); });
    App.store.getUserTemplates().forEach(function (u) {
      list.push({ id: u.id, name: u.name, description: u.description || 'Custom template', model: u.model, builtIn: false });
    });
    return list;
  }

  function get(id) {
    if (!id) return null;
    if (builtIn[id]) return builtIn[id];
    var u = App.store.getUserTemplates().filter(function (t) { return t.id === id; })[0];
    return u ? { id: u.id, name: u.name, description: u.description || 'Custom template', model: u.model, builtIn: false } : null;
  }

  // Resolve the document model used to render a given invoice:
  // prefer the snapshot stored on the invoice, then the template,
  // then any template, then a default.
  function modelFor(invoice) {
    if (invoice && invoice.templateModel) return invoice.templateModel;
    var tpl = get(invoice && invoice.templateId);
    if (tpl && tpl.model) return tpl.model;
    var all = getAll();
    if (all[0] && all[0].model) return all[0].model;
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
    getAll: getAll,
    get: get,
    modelFor: modelFor,
    renderInvoice: renderInvoice,
    renderEditorView: renderEditorView,
    renderGalleryView: renderGalleryView,
    previewInvoice: previewInvoice
  };
})();
