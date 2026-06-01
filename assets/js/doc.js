/* ============================================================
   doc.js — Block document model + renderer for invoice templates.

   A template is a "document": { page, blocks[] }. Blocks are
   rendered to DOM by render(), filling live invoice data via
   "merge fields" (bindings). The same renderer powers the
   template editor, the invoice preview and PDF export.
   ============================================================ */
window.App = window.App || {};

App.doc = (function () {

  /* ----------------------------------------------------------
     Merge-field context: maps a binding key -> display value.
     ---------------------------------------------------------- */
  function buildContext(invoice, accent) {
    invoice = invoice || {};
    var seller = invoice.seller || {};
    var buyer = invoice.buyer || {};
    var meta = invoice.meta || {};
    var totals = App.invoiceModel.computeTotals(invoice);
    var cur = meta.currency || 'USD';

    var map = {
      'seller.name': seller.name,
      'seller.address': seller.address,
      'seller.email': seller.email,
      'seller.phone': seller.phone,
      'seller.taxId': seller.taxId,
      'client.name': buyer.name,
      'client.contactName': buyer.contactName,
      'client.address': buyer.address,
      'client.email': buyer.email,
      'client.phone': buyer.phone,
      'client.taxId': buyer.taxId,
      'invoice.number': meta.number,
      'invoice.title': meta.title,
      'invoice.poNumber': meta.poNumber,
      'invoice.issueDate': App.util.formatDate(meta.issueDate),
      'invoice.dueDate': App.util.formatDate(meta.dueDate),
      'invoice.currency': cur,
      'invoice.notes': invoice.notes,
      'invoice.paymentInstructions': invoice.paymentInstructions,
      'totals.subtotal': App.util.formatMoney(totals.subtotal, cur),
      'totals.discount': App.util.formatMoney(totals.discount, cur),
      'totals.tax': App.util.formatMoney(totals.tax, cur),
      'totals.taxRate': (Number(invoice.taxRate) || 0) + '%',
      'totals.total': App.util.formatMoney(totals.total, cur)
    };
    // Underlying (unformatted) value for an editable input.
    function editRaw(binding) {
      if (binding === 'invoice.issueDate') return meta.issueDate || '';
      if (binding === 'invoice.dueDate') return meta.dueDate || '';
      return map[binding];
    }

    return { map: map, invoice: invoice, totals: totals, currency: cur, accent: accent, logo: seller.logo, editRaw: editRaw };
  }

  // Which bindings can be edited directly on the invoice, and how.
  var DATE_BINDINGS = { 'invoice.issueDate': 1, 'invoice.dueDate': 1 };
  var MULTILINE_BINDINGS = { 'seller.address': 1, 'client.address': 1, 'invoice.notes': 1, 'invoice.paymentInstructions': 1 };
  function isEditableBinding(b) { return b && b.indexOf('totals.') !== 0 && b !== 'invoice.currency'; }
  function bindingKind(b) { return DATE_BINDINGS[b] ? 'date' : (MULTILINE_BINDINGS[b] ? 'multiline' : 'text'); }

  // Available merge fields, grouped — used by the editor's field palette.
  var FIELD_GROUPS = [
    { group: 'Your business', fields: [
      { binding: 'seller.name', label: 'Business name' },
      { binding: 'seller.address', label: 'Business address' },
      { binding: 'seller.email', label: 'Business email' },
      { binding: 'seller.phone', label: 'Business phone' },
      { binding: 'seller.taxId', label: 'Tax ID' }
    ]},
    { group: 'Client', fields: [
      { binding: 'client.name', label: 'Client name' },
      { binding: 'client.contactName', label: 'Client contact' },
      { binding: 'client.address', label: 'Client address' },
      { binding: 'client.email', label: 'Client email' },
      { binding: 'client.phone', label: 'Client phone' },
      { binding: 'client.taxId', label: 'Client tax ID' }
    ]},
    { group: 'Invoice', fields: [
      { binding: 'invoice.number', label: 'Invoice number' },
      { binding: 'invoice.title', label: 'Document title' },
      { binding: 'invoice.issueDate', label: 'Issue date' },
      { binding: 'invoice.dueDate', label: 'Due date' },
      { binding: 'invoice.poNumber', label: 'PO number' },
      { binding: 'invoice.notes', label: 'Notes' },
      { binding: 'invoice.paymentInstructions', label: 'Payment instructions' }
    ]},
    { group: 'Totals', fields: [
      { binding: 'totals.subtotal', label: 'Subtotal' },
      { binding: 'totals.tax', label: 'Tax amount' },
      { binding: 'totals.total', label: 'Grand total' }
    ]}
  ];

  function fieldLabelFor(binding) {
    for (var i = 0; i < FIELD_GROUPS.length; i++) {
      var f = FIELD_GROUPS[i].fields.filter(function (x) { return x.binding === binding; })[0];
      if (f) return f.label;
    }
    return binding;
  }

  /* ----------------------------------------------------------
     Style helpers
     ---------------------------------------------------------- */
  function textCss(style) {
    style = style || {};
    var css = '';
    if (style.fontSize) css += 'font-size:' + style.fontSize + 'px;';
    if (style.color) css += 'color:' + style.color + ';';
    if (style.bold) css += 'font-weight:700;';
    if (style.italic) css += 'font-style:italic;';
    if (style.underline) css += 'text-decoration:underline;';
    if (style.align) css += 'text-align:' + style.align + ';';
    if (style.letterSpacing) css += 'letter-spacing:' + style.letterSpacing + 'em;';
    if (style.lineHeight) css += 'line-height:' + style.lineHeight + ';';
    if (style.uppercase) css += 'text-transform:uppercase;';
    return css;
  }
  // A CSS length may be a number (px) or a raw string ("0 48px").
  function lenVal(v) { return typeof v === 'number' ? v + 'px' : v; }

  function wrapperCss(style) {
    style = style || {};
    var css = '';
    css += 'margin-top:' + (style.marginTop != null ? style.marginTop : 0) + 'px;';
    css += 'margin-bottom:' + (style.marginBottom != null ? style.marginBottom : 12) + 'px;';
    if (style.bg) css += 'background:' + style.bg + ';';
    if (style.padding != null) css += 'padding:' + lenVal(style.padding) + ';';
    if (style.radius != null) css += 'border-radius:' + lenVal(style.radius) + ';';
    return css;
  }

  function resolveTokens(text, ctx) {
    return String(text == null ? '' : text).replace(/\{\{\s*([\w.]+)\s*\}\}/g, function (_, k) {
      var v = ctx.map[k];
      return (v == null || v === '') ? '' : App.util.escapeHtml(v);
    });
  }

  /* ----------------------------------------------------------
     Block rendering — returns a DOM element per block.
     ---------------------------------------------------------- */
  function blockEl(block) {
    var w = document.createElement('div');
    w.className = 'doc-blk';
    w.setAttribute('data-id', block.id);
    w.setAttribute('data-type', block.type);
    w.style.cssText = wrapperCss(block.style);
    return w;
  }

  // Make a static (non-bound) text element editable directly on the invoice.
  // The edit writes back into the invoice's own template-model snapshot.
  function makeStaticEditable(el, which) {
    el.classList.add('doc-edit-static');
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('data-static', which);
    el.spellcheck = false;
  }
  function canEditStatic(ctx, text) {
    return ctx.dataEdit && String(text || '').trim() !== '' && String(text).indexOf('{{') === -1;
  }

  function renderHeading(block, ctx, editable) {
    var w = blockEl(block);
    var h = document.createElement('div');
    h.className = 'doc-h';
    h.style.cssText = textCss(block.style);
    h.innerHTML = resolveTokens(block.props.text || (editable ? '' : ''), ctx);
    if (editable) { h.setAttribute('data-edit', 'text'); h.setAttribute('data-placeholder', 'Heading'); }
    else if (canEditStatic(ctx, block.props.text)) makeStaticEditable(h, 'text');
    w.appendChild(h);
    return w;
  }

  function renderTextBlock(block, ctx, editable) {
    var w = blockEl(block);
    var t = document.createElement('div');
    t.className = 'doc-t';
    t.style.cssText = textCss(block.style);
    t.innerHTML = resolveTokens(block.props.text || '', ctx);
    if (editable) { t.setAttribute('data-edit', 'text'); t.setAttribute('data-placeholder', 'Type text\u2026'); }
    else if (canEditStatic(ctx, block.props.text)) makeStaticEditable(t, 'text');
    w.appendChild(t);
    return w;
  }

  function renderField(block, ctx, editable) {
    var w = blockEl(block);
    var inline = block.props.layout === 'inline';
    var box = document.createElement('div');
    box.className = 'doc-field' + (inline ? ' inline' : '');
    box.style.cssText = textCss(block.style);

    if (block.props.label || editable) {
      var lab = document.createElement('span');
      lab.className = 'doc-field-label';
      lab.textContent = block.props.label || '';
      if (editable) { lab.setAttribute('data-edit', 'label'); lab.setAttribute('data-placeholder', 'Label'); }
      else if (ctx.dataEdit && block.props.label) makeStaticEditable(lab, 'label');
      box.appendChild(lab);
    }

    var val = document.createElement('span');
    val.className = 'doc-field-value';
    var binding = block.props.binding;
    var display = ctx.map[binding];

    if (ctx.dataEdit && isEditableBinding(binding)) {
      var kind = bindingKind(binding);
      var placeholder = block.props.label || fieldLabelFor(binding);
      val.classList.add('doc-edit');
      val.setAttribute('data-bind', binding);
      val.setAttribute('data-kind', kind);
      val.setAttribute('data-placeholder', placeholder);
      if (kind === 'date') {
        val.setAttribute('data-raw', ctx.editRaw(binding) || '');
        val.classList.add('doc-edit-date');
        if (display) val.textContent = display;
        else { val.classList.add('doc-field-empty'); val.textContent = ''; }
      } else {
        val.setAttribute('contenteditable', 'true');
        val.spellcheck = false;
        var raw = ctx.editRaw(binding);
        if (raw == null || raw === '') val.classList.add('doc-field-empty');
        else val.textContent = raw;
      }
    } else if (display == null || display === '') {
      val.innerHTML = editable ? '<span class="doc-field-empty">' + App.util.escapeHtml(fieldLabelFor(binding)) + '</span>' : '';
    } else {
      val.textContent = display;
    }

    box.appendChild(val);
    w.appendChild(box);
    return w;
  }

  function renderImage(block, ctx, editable) {
    var w = blockEl(block);
    var box = document.createElement('div');
    box.className = 'doc-image';
    box.style.textAlign = block.style && block.style.align ? block.style.align : 'left';
    var isLogo = block.props.bind === 'seller.logo';
    var logoEditable = ctx.dataEdit && isLogo;
    var src = isLogo ? ctx.logo : block.props.src;
    if (logoEditable) { box.setAttribute('data-logo', '1'); box.style.cursor = 'pointer'; box.title = 'Click to change logo'; }

    if (src) {
      var img = document.createElement('img');
      img.src = src;
      img.style.width = (block.props.width || 160) + 'px';
      img.style.maxWidth = '100%';
      if (block.props.invert) img.style.filter = 'brightness(0) invert(1)';
      box.appendChild(img);
    } else if (editable || logoEditable) {
      var ph = document.createElement('div');
      ph.className = 'doc-image-ph';
      ph.style.width = (block.props.width || 160) + 'px';
      ph.innerHTML = '<i class="bi bi-image"></i><span>' + (logoEditable ? 'Add logo' : (isLogo ? 'Logo (auto)' : 'Image')) + '</span>';
      box.appendChild(ph);
    }
    w.appendChild(box);
    return w;
  }

  function renderDivider(block) {
    var w = blockEl(block);
    var hr = document.createElement('div');
    hr.className = 'doc-divider';
    hr.style.borderTop = (block.props.thickness || 1) + 'px ' + (block.props.lineStyle || 'solid') + ' ' + (block.props.color || '#d8dee6');
    w.appendChild(hr);
    return w;
  }

  function renderSpacer(block) {
    var w = blockEl(block);
    w.style.marginBottom = '0px';
    var s = document.createElement('div');
    s.className = 'doc-spacer';
    s.style.height = (block.props.height || 24) + 'px';
    w.appendChild(s);
    return w;
  }

  var ITEM_DEFAULT_COLS = [
    { key: 'description', label: 'Description' },
    { key: 'qty', label: 'Qty' },
    { key: 'rate', label: 'Rate' },
    { key: 'amount', label: 'Amount' }
  ];

  function renderItems(block, ctx, editable) {
    var w = blockEl(block);
    var cols = (block.props.columns && block.props.columns.length) ? block.props.columns : ITEM_DEFAULT_COLS;
    var headerBg = block.props.headerBg || ctx.accent || '#1e293b';
    var headerColor = block.props.headerColor || '#ffffff';
    var numeric = { qty: 1, rate: 1, amount: 1 };
    var zebra = !!block.props.zebra;
    var zebraColor = block.props.zebraColor || '#f4f5f7';
    var de = ctx.dataEdit;
    var editKeys = { description: 1, qty: 1, rate: 1, amount: 1 };

    var table = document.createElement('table');
    table.className = 'doc-items' + (zebra ? ' zebra' : '') + (de ? ' doc-edit-items' : '');
    var thead = '<thead><tr>' + cols.map(function (c) {
      return '<th class="' + (numeric[c.key] ? 'r' : '') + '" style="background:' + headerBg + ';color:' + headerColor + '">' +
        App.util.escapeHtml(c.label) + '</th>';
    }).join('') + (de ? '<th class="doc-x-col" style="background:' + headerBg + '"></th>' : '') + '</tr></thead>';

    // In output (non-edit) mode, drop blank rows so a fresh invoice
    // doesn't print an empty line. In edit mode keep them all.
    var items = ctx.invoice.lineItems || [];
    if (!de) items = items.filter(function (li) {
      return String(li.description || '').trim() !== '' || (Number(li.rate) || 0) !== 0 || App.invoiceModel.lineAmount(li) !== 0;
    });

    var rows = items.map(function (li, idx) {
      var amt = App.invoiceModel.lineAmount(li);
      var trStyle = (zebra && idx % 2 === 0) ? ' style="background:' + zebraColor + '"' : '';
      var cells = cols.map(function (c) {
        var cls = numeric[c.key] ? 'r' : '';
        if (de && editKeys[c.key]) {
          var rawv;
          if (c.key === 'description') rawv = li.description || '';
          else if (c.key === 'amount') rawv = amt;
          else rawv = (li[c.key] != null ? li[c.key] : '');
          return '<td class="' + cls + ' doc-edit-cell" contenteditable="true" data-li="' + li.id + '" data-col="' + c.key + '" data-placeholder="' + (c.key === 'description' ? 'Item description' : '0') + '">' + App.util.escapeHtml(rawv) + '</td>';
        }
        var v;
        if (c.key === 'description') v = App.util.escapeHtml(li.description || '');
        else if (c.key === 'qty') v = (Number(li.qty) || 0);
        else if (c.key === 'rate') v = App.util.formatMoney(li.rate, ctx.currency);
        else if (c.key === 'amount') v = App.util.formatMoney(amt, ctx.currency);
        else v = '';
        var attr = c.key === 'amount' ? ' data-amount-for="' + li.id + '"' : '';
        return '<td class="' + cls + '"' + attr + '>' + v + '</td>';
      }).join('');
      var del = de ? '<td class="doc-x-col"><button class="doc-li-del" data-del="' + li.id + '" title="Remove" contenteditable="false"><i class="bi bi-x-lg"></i></button></td>' : '';
      return '<tr' + trStyle + ' data-row="' + li.id + '">' + cells + del + '</tr>';
    }).join('');
    if (!rows && editable) rows = '<tr><td colspan="' + cols.length + '" class="doc-items-empty">Line items appear here</td></tr>';

    var addRow = de ? '<tr class="doc-additem"><td colspan="' + (cols.length + 1) + '"><span data-additem><i class="bi bi-plus-lg"></i> Add item</span></td></tr>' : '';
    table.innerHTML = thead + '<tbody>' + rows + addRow + '</tbody>';
    w.appendChild(table);
    return w;
  }

  // The inner rows of a totals block — shared so the invoice editor can
  // repaint live as line items / tax / discount change.
  function totalsRowsHtml(invoice, accent, props) {
    props = props || {};
    var t = App.invoiceModel.computeTotals(invoice);
    var cur = invoice.meta.currency;
    accent = accent || '#1e293b';
    var html = '<div class="row"><span>Subtotal</span><span class="v">' + App.util.formatMoney(t.subtotal, cur) + '</span></div>';
    if (t.discount) html += '<div class="row"><span>Discount</span><span class="v">-' + App.util.formatMoney(t.discount, cur) + '</span></div>';
    if (props.showTax !== false) html += '<div class="row"><span>Tax (' + (Number(invoice.taxRate) || 0) + '%)</span><span class="v">' + App.util.formatMoney(t.tax, cur) + '</span></div>';
    html += '<div class="row grand" style="border-color:' + accent + ';color:' + accent + '"><span>Total</span><span class="v">' + App.util.formatMoney(t.total, cur) + '</span></div>';
    return html;
  }

  function renderTotals(block, ctx) {
    var w = blockEl(block);
    var align = (block.style && block.style.align) || 'right';
    var box = document.createElement('div');
    box.className = 'doc-totals';
    box.style.marginLeft = (align === 'right') ? 'auto' : '0';
    box.style.width = (block.props.width || 300) + 'px';
    box.innerHTML = totalsRowsHtml(ctx.invoice, ctx.accent, block.props);
    w.appendChild(box);
    return w;
  }

  function renderColumns(block, ctx, editable) {
    var w = blockEl(block);
    var row = document.createElement('div');
    row.className = 'doc-columns';
    row.style.gap = (block.props.gap != null ? block.props.gap : 24) + 'px';
    if (block.props.valign) row.style.alignItems = block.props.valign;
    (block.columns || []).forEach(function (col, i) {
      var cEl = document.createElement('div');
      cEl.className = 'doc-col doc-container';
      cEl.setAttribute('data-container', block.id + ':' + i);
      var cs = col.style || {};
      cEl.style.flex = cs.flex || '1';
      if (cs.bg) cEl.style.background = cs.bg;
      if (cs.color) cEl.style.color = cs.color;
      cEl.style.padding = lenVal(cs.padding != null ? cs.padding : 0);
      if (cs.radius != null) cEl.style.borderRadius = lenVal(cs.radius);
      if (cs.minHeight) cEl.style.minHeight = cs.minHeight + 'px';
      (col.blocks || []).forEach(function (b) { cEl.appendChild(renderBlock(b, ctx, editable)); });
      row.appendChild(cEl);
    });
    w.appendChild(row);
    return w;
  }

  function renderBlock(block, ctx, editable) {
    switch (block.type) {
      case 'heading': return renderHeading(block, ctx, editable);
      case 'text': return renderTextBlock(block, ctx, editable);
      case 'field': return renderField(block, ctx, editable);
      case 'image': return renderImage(block, ctx, editable);
      case 'divider': return renderDivider(block);
      case 'spacer': return renderSpacer(block);
      case 'items': return renderItems(block, ctx, editable);
      case 'totals': return renderTotals(block, ctx);
      case 'columns': return renderColumns(block, ctx, editable);
      default:
        var w = blockEl(block);
        w.textContent = 'Unknown block: ' + block.type;
        return w;
    }
  }

  function render(model, invoice, opts) {
    opts = opts || {};
    model = model || defaultModel();
    var page = model.page || {};
    var ctx = buildContext(invoice || {}, page.accent);
    ctx.dataEdit = !!opts.dataEdit;
    var paper = document.createElement('div');
    paper.className = 'doc-paper';
    paper.setAttribute('data-container', 'root');
    paper.style.fontFamily = page.fontFamily || '"Segoe UI", Helvetica, Arial, sans-serif';
    paper.style.color = page.color || '#1f2937';
    paper.style.padding = (page.padding != null ? page.padding : 48) + 'px';
    paper.style.background = page.background || '#ffffff';
    (model.blocks || []).forEach(function (b) { paper.appendChild(renderBlock(b, ctx, opts.editable)); });
    return paper;
  }

  /* ----------------------------------------------------------
     Model utilities (used by the editor)
     ---------------------------------------------------------- */
  function newId() { return App.util.uuid('blk'); }

  // Visit every container array with its containerId.
  function eachContainer(model, cb) {
    cb('root', model.blocks);
    (function walk(blocks) {
      blocks.forEach(function (b) {
        if (b.type === 'columns') {
          (b.columns || []).forEach(function (col, i) {
            cb(b.id + ':' + i, col.blocks);
            walk(col.blocks);
          });
        }
      });
    })(model.blocks);
  }

  function getContainer(model, containerId) {
    var found = null;
    eachContainer(model, function (id, arr) { if (id === containerId) found = arr; });
    return found;
  }

  function findBlock(model, blockId) {
    var result = null;
    eachContainer(model, function (id, arr) {
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id === blockId) result = { block: arr[i], arr: arr, index: i, containerId: id };
      }
    });
    return result;
  }

  function removeBlock(model, blockId) {
    var f = findBlock(model, blockId);
    if (!f) return null;
    return f.arr.splice(f.index, 1)[0];
  }

  function insertBlock(model, containerId, index, block) {
    var arr = getContainer(model, containerId);
    if (!arr) return false;
    if (index == null || index > arr.length) index = arr.length;
    arr.splice(index, 0, block);
    return true;
  }

  // Is `maybeAncestorId` an ancestor of (or equal to) `blockId`?
  function isAncestor(model, maybeAncestorId, blockId) {
    if (maybeAncestorId === blockId) return true;
    var f = findBlock(model, maybeAncestorId);
    if (!f || f.block.type !== 'columns') return false;
    var hit = false;
    (function walk(b) {
      (b.columns || []).forEach(function (col) {
        col.blocks.forEach(function (cb) {
          if (cb.id === blockId) hit = true;
          if (cb.type === 'columns') walk(cb);
        });
      });
    })(f.block);
    return hit;
  }

  /* ----------------------------------------------------------
     Block factories (palette)
     ---------------------------------------------------------- */
  function make(type, props, style, extra) {
    var b = { id: newId(), type: type, props: props || {}, style: style || {} };
    if (extra) Object.keys(extra).forEach(function (k) { b[k] = extra[k]; });
    return b;
  }

  var FACTORIES = {
    heading: function () { return make('heading', { text: 'Heading' }, { fontSize: 28, bold: true, marginBottom: 8 }); },
    text: function () { return make('text', { text: 'New text block. Click to edit.' }, { fontSize: 14, color: '#475569' }); },
    field: function () { return make('field', { binding: 'client.name', label: '', layout: 'stacked' }, { fontSize: 14 }); },
    image: function () { return make('image', { bind: '', src: '', width: 160 }, { align: 'left' }); },
    divider: function () { return make('divider', { color: '#d8dee6', thickness: 1 }, { marginTop: 8, marginBottom: 8 }); },
    spacer: function () { return make('spacer', { height: 24 }); },
    items: function () { return make('items', { columns: ITEM_DEFAULT_COLS.slice() }, { marginTop: 8, marginBottom: 8 }); },
    totals: function () { return make('totals', { showTax: true, width: 300 }, { align: 'right' }); },
    columns: function () {
      return make('columns', { gap: 24 }, {}, { columns: [ { style: { flex: '1' }, blocks: [] }, { style: { flex: '1' }, blocks: [] } ] });
    }
  };

  var PALETTE = [
    { type: 'heading', label: 'Heading', icon: 'bi-type-h1' },
    { type: 'text', label: 'Text', icon: 'bi-fonts' },
    { type: 'field', label: 'Field', icon: 'bi-bezier2' },
    { type: 'image', label: 'Image / Logo', icon: 'bi-image' },
    { type: 'columns', label: 'Columns', icon: 'bi-layout-three-columns' },
    { type: 'items', label: 'Line items', icon: 'bi-table' },
    { type: 'totals', label: 'Totals', icon: 'bi-calculator' },
    { type: 'divider', label: 'Divider', icon: 'bi-dash-lg' },
    { type: 'spacer', label: 'Spacer', icon: 'bi-arrows-expand' }
  ];

  function createBlock(type) { return FACTORIES[type] ? FACTORIES[type]() : null; }

  // Inspect a model and report which invoice fields it actually uses, so
  // the invoice editor can show only the relevant inputs.
  function usedBindings(model) {
    var bindings = {}, hasItems = false, hasTotals = false, hasLogo = false;
    function tokens(text) {
      (String(text || '').match(/\{\{\s*[\w.]+\s*\}\}/g) || []).forEach(function (t) {
        bindings[t.replace(/[{}\s]/g, '')] = true;
      });
    }
    (function walk(blocks) {
      (blocks || []).forEach(function (blk) {
        if (blk.type === 'field' && blk.props.binding) bindings[blk.props.binding] = true;
        if (blk.type === 'heading' || blk.type === 'text') tokens(blk.props.text);
        if (blk.type === 'image' && blk.props.bind === 'seller.logo') hasLogo = true;
        if (blk.type === 'items') hasItems = true;
        if (blk.type === 'totals') hasTotals = true;
        if (blk.type === 'columns') (blk.columns || []).forEach(function (c) { walk(c.blocks); });
      });
    })(model && model.blocks);
    return { bindings: bindings, hasItems: hasItems, hasTotals: hasTotals, hasLogo: hasLogo };
  }

  function defaultModel() {
    return {
      page: { accent: '#4f46e5', fontFamily: '"Segoe UI", Helvetica, Arial, sans-serif', color: '#1f2937', padding: 48, background: '#ffffff' },
      blocks: [
        make('heading', { text: 'INVOICE' }, { fontSize: 30, bold: true, color: '#4f46e5', letterSpacing: 0.04, uppercase: true, marginBottom: 16 }),
        make('items', { columns: ITEM_DEFAULT_COLS.slice() }, { marginTop: 16 }),
        make('totals', { showTax: true, width: 300 }, { align: 'right', marginTop: 12 })
      ]
    };
  }

  return {
    buildContext: buildContext,
    render: render,
    FIELD_GROUPS: FIELD_GROUPS,
    fieldLabelFor: fieldLabelFor,
    PALETTE: PALETTE,
    ITEM_DEFAULT_COLS: ITEM_DEFAULT_COLS,
    createBlock: createBlock,
    defaultModel: defaultModel,
    usedBindings: usedBindings,
    totalsRowsHtml: totalsRowsHtml,
    bindingKind: bindingKind,
    isEditableBinding: isEditableBinding,
    make: make,
    newId: newId,
    eachContainer: eachContainer,
    getContainer: getContainer,
    findBlock: findBlock,
    removeBlock: removeBlock,
    insertBlock: insertBlock,
    isAncestor: isAncestor
  };
})();
