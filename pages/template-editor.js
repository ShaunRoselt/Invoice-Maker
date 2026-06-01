/* ============================================================
   Page: template-editor — block-based WYSIWYG invoice designer.

   Left rail : component palette + draggable merge fields
   Center    : contextual formatting toolbar + A4 canvas
   Right rail: inspector (selected block / column / page settings)

   Interactions: click to select, click text to edit inline,
   drag the handle to reorder, drag palette/fields onto the page.
   ============================================================ */
App.pages.register('template-editor', (function () {
  var model, meta, sample, selectedId;
  var rootEl, canvas, inspector, toolbar, paperFrame, dropLine;
  var dnd = null;            // active drag descriptor
  var pending = null;        // pending drop target
  var resizeHandler, keyHandler;

  var FONT_FAMILIES = [
    { value: '"Segoe UI", Helvetica, Arial, sans-serif', label: 'Sans (Segoe UI)' },
    { value: 'Georgia, "Times New Roman", serif', label: 'Serif (Georgia)' },
    { value: '"Trebuchet MS", Helvetica, sans-serif', label: 'Trebuchet' },
    { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
    { value: '"Courier New", monospace', label: 'Monospace' }
  ];
  var FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48];

  /* ---------------- init / model resolution ---------------- */
  function buildMeta(params) {
    var src;
    if (params.mode === 'create') {
      return { meta: { id: null, name: '', isNew: true }, model: App.doc.defaultModel() };
    }
    src = App.templates.get(params.id);
    if (!src) return { meta: { id: null, name: '', isNew: true }, model: App.doc.defaultModel() };
    if (params.mode === 'duplicate' || src.builtIn) {
      return { meta: { id: null, name: src.name + ' (copy)', isNew: true }, model: App.util.deepClone(src.model) };
    }
    return { meta: { id: src.id, name: src.name, isNew: false }, model: App.util.deepClone(src.model) };
  }

  /* ---------------- canvas rendering ---------------- */
  function renderCanvas() {
    canvas.innerHTML = '';
    paperFrame = document.createElement('div');
    paperFrame.className = 'te2-paper-frame';
    paperFrame.appendChild(App.doc.render(model, sample, { editable: true }));
    canvas.appendChild(paperFrame);
    decorate();
    fitCanvas();
    applySelectionClasses();
  }

  function decorate() {
    // Editable text nodes.
    paperFrame.querySelectorAll('[data-edit]').forEach(function (el) {
      el.setAttribute('contenteditable', 'true');
      el.spellcheck = false;
      togglePlaceholder(el);
      el.addEventListener('input', function () {
        var blk = el.closest('.doc-blk'); if (!blk) return;
        var f = App.doc.findBlock(model, blk.getAttribute('data-id')); if (!f) return;
        var prop = el.getAttribute('data-edit');
        f.block.props[prop] = (prop === 'label') ? el.textContent : el.innerHTML;
        togglePlaceholder(el);
      });
      el.addEventListener('focus', function () {
        var blk = el.closest('.doc-blk'); if (blk) select(blk.getAttribute('data-id'));
      });
    });

    // Per-block tools.
    paperFrame.querySelectorAll('.doc-blk').forEach(function (blk) {
      var tools = document.createElement('div');
      tools.className = 'blk-tools';
      tools.setAttribute('contenteditable', 'false');
      tools.innerHTML =
        '<button class="bh" title="Drag to move" draggable="true"><i class="bi bi-arrows-move"></i></button>' +
        '<button data-t="dup" title="Duplicate"><i class="bi bi-files"></i></button>' +
        '<button data-t="del" title="Delete"><i class="bi bi-trash"></i></button>';
      blk.appendChild(tools);

      var handle = tools.querySelector('.bh');
      handle.addEventListener('dragstart', function (e) {
        dnd = { moveId: blk.getAttribute('data-id') };
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dnd.moveId);
      });
      handle.addEventListener('dragend', clearDnd);
      tools.querySelector('[data-t="dup"]').addEventListener('click', function (e) { e.stopPropagation(); duplicateBlock(blk.getAttribute('data-id')); });
      tools.querySelector('[data-t="del"]').addEventListener('click', function (e) { e.stopPropagation(); deleteBlock(blk.getAttribute('data-id')); });
    });
  }

  function togglePlaceholder(el) {
    var empty = !el.textContent.trim() && !el.querySelector('img');
    el.classList.toggle('empty-ph', empty);
  }

  function fitCanvas() {
    if (!paperFrame) return;
    var avail = canvas.clientWidth - 56;
    var scale = Math.min(1, avail / 794);
    if (scale <= 0) scale = 1;
    paperFrame.style.zoom = scale;
  }

  /* ---------------- selection ---------------- */
  function select(id) {
    selectedId = id;
    applySelectionClasses();
    renderInspector();
    renderToolbar();
  }
  function selectPage() { select('__page__'); }

  function applySelectionClasses() {
    if (!paperFrame) return;
    paperFrame.querySelectorAll('.selected').forEach(function (n) { n.classList.remove('selected'); });
    paperFrame.querySelectorAll('.col-selected').forEach(function (n) { n.classList.remove('col-selected'); });
    if (!selectedId || selectedId === '__page__') return;
    if (selectedId.indexOf(':') >= 0) {
      var col = paperFrame.querySelector('.doc-col[data-container="' + selectedId + '"]');
      if (col) col.classList.add('col-selected');
    } else {
      var blk = paperFrame.querySelector('.doc-blk[data-id="' + selectedId + '"]');
      if (blk) blk.classList.add('selected');
    }
  }

  function selectedBlock() {
    if (!selectedId || selectedId === '__page__' || selectedId.indexOf(':') >= 0) return null;
    var f = App.doc.findBlock(model, selectedId);
    return f ? f.block : null;
  }

  /* ---------------- structural ops ---------------- */
  function regenIds(block) {
    block.id = App.doc.newId();
    if (block.type === 'columns') (block.columns || []).forEach(function (c) { (c.blocks || []).forEach(regenIds); });
    return block;
  }
  function duplicateBlock(id) {
    var f = App.doc.findBlock(model, id); if (!f) return;
    var copy = regenIds(App.util.deepClone(f.block));
    f.arr.splice(f.index + 1, 0, copy);
    selectedId = copy.id;
    renderCanvas(); renderInspector(); renderToolbar();
  }
  function deleteBlock(id) {
    App.doc.removeBlock(model, id);
    if (selectedId === id) selectedId = '__page__';
    renderCanvas(); renderInspector(); renderToolbar();
  }
  function addBlock(type) {
    var block = App.doc.createBlock(type); if (!block) return;
    var sel = selectedBlock();
    if (sel) {
      var f = App.doc.findBlock(model, sel.id);
      f.arr.splice(f.index + 1, 0, block);
    } else {
      model.blocks.push(block);
    }
    selectedId = block.id;
    renderCanvas(); renderInspector(); renderToolbar();
  }

  /* ---------------- drag & drop ---------------- */
  function clearDnd() { dnd = null; pending = null; if (dropLine) dropLine.style.display = 'none'; }

  function containerOwner(containerId) { return (!containerId || containerId === 'root') ? null : containerId.split(':')[0]; }

  function onDragOver(e) {
    if (!dnd) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = dnd.moveId ? 'move' : 'copy';

    // The deepest container under the pointer (root paper or a column).
    var cont = e.target.closest && e.target.closest('.doc-container');
    if (!cont) { pending = null; if (dropLine) dropLine.style.display = 'none'; return; }

    var kids = [].slice.call(cont.querySelectorAll(':scope > .doc-blk'));
    var refBlk = null, after = false;
    for (var i = 0; i < kids.length; i++) {
      var r = kids[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { refBlk = kids[i]; after = false; break; }
      refBlk = kids[i]; after = true;
    }

    if (refBlk) {
      var rr = refBlk.getBoundingClientRect();
      pending = { kind: 'ref', containerId: cont.getAttribute('data-container'), refId: refBlk.getAttribute('data-id'), after: after };
      showLine(rr.left, rr.right, after ? rr.bottom : rr.top);
    } else {
      var cr = cont.getBoundingClientRect();
      pending = { kind: 'append', containerId: cont.getAttribute('data-container') };
      showLine(cr.left + 6, cr.right - 6, cr.top + 6);
    }
  }

  function showLine(left, right, y) {
    if (!dropLine) { dropLine = document.createElement('div'); dropLine.className = 'te2-drop-line'; document.body.appendChild(dropLine); }
    dropLine.style.display = 'block';
    dropLine.style.left = left + 'px';
    dropLine.style.width = (right - left) + 'px';
    dropLine.style.top = (y - 1) + 'px';
  }

  function onDrop(e) {
    if (!dnd || !pending) { clearDnd(); return; }
    e.preventDefault();
    var owner = containerOwner(pending.containerId);

    var block;
    if (dnd.moveId) {
      if (pending.kind === 'ref' && pending.refId === dnd.moveId) { clearDnd(); return; } // no-op
      if (owner && App.doc.isAncestor(model, dnd.moveId, owner)) { clearDnd(); return; }
      if (pending.kind === 'ref' && App.doc.isAncestor(model, dnd.moveId, pending.refId)) { clearDnd(); return; }
      block = App.doc.removeBlock(model, dnd.moveId);
    } else if (dnd.newType) {
      block = App.doc.createBlock(dnd.newType);
    } else if (dnd.newField) {
      block = App.doc.make('field', { binding: dnd.newField, label: '', layout: 'stacked' }, { fontSize: 14 });
    }
    if (!block) { clearDnd(); return; }

    if (pending.kind === 'append') {
      App.doc.insertBlock(model, pending.containerId, 9999, block);
    } else {
      var f = App.doc.findBlock(model, pending.refId);
      if (f) f.arr.splice(f.index + (pending.after ? 1 : 0), 0, block);
      else App.doc.insertBlock(model, pending.containerId, 9999, block);
    }
    var newId = block.id;
    clearDnd();
    selectedId = newId;
    renderCanvas(); renderInspector(); renderToolbar();
  }

  /* ---------------- left rail ---------------- */
  function buildPalette() {
    var pal = rootEl.querySelector('#te-palette');
    pal.innerHTML = '';
    App.doc.PALETTE.forEach(function (item) {
      var b = document.createElement('div');
      b.className = 'te2-paitem';
      b.setAttribute('draggable', 'true');
      b.innerHTML = '<i class="bi ' + item.icon + '"></i><span>' + item.label + '</span>';
      b.addEventListener('click', function () { addBlock(item.type); });
      b.addEventListener('dragstart', function (e) { dnd = { newType: item.type }; e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', item.type); });
      b.addEventListener('dragend', clearDnd);
      pal.appendChild(b);
    });

    var fieldsWrap = rootEl.querySelector('#te-fields');
    fieldsWrap.innerHTML = '';
    App.doc.FIELD_GROUPS.forEach(function (g) {
      var grp = document.createElement('div');
      grp.className = 'te2-fieldgroup';
      grp.innerHTML = '<div class="gl">' + g.group + '</div>';
      g.fields.forEach(function (f) {
        var chip = document.createElement('button');
        chip.className = 'te2-fieldchip';
        chip.setAttribute('draggable', 'true');
        chip.innerHTML = '<i class="bi bi-bezier2"></i><span>' + f.label + '</span>';
        chip.addEventListener('click', function () {
          var block = App.doc.make('field', { binding: f.binding, label: '', layout: 'stacked' }, { fontSize: 14 });
          var sel = selectedBlock();
          if (sel) { var ff = App.doc.findBlock(model, sel.id); ff.arr.splice(ff.index + 1, 0, block); }
          else model.blocks.push(block);
          selectedId = block.id; renderCanvas(); renderInspector(); renderToolbar();
        });
        chip.addEventListener('dragstart', function (e) { dnd = { newField: f.binding }; e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', f.binding); });
        chip.addEventListener('dragend', clearDnd);
        grp.appendChild(chip);
      });
      fieldsWrap.appendChild(grp);
    });
  }

  /* ---------------- toolbar ---------------- */
  function renderToolbar() {
    var block = selectedBlock();
    var textual = block && (block.type === 'heading' || block.type === 'text' || block.type === 'field');
    toolbar.innerHTML = '';

    var label = document.createElement('span');
    label.className = 'tb-label';
    label.textContent = block ? blockTypeName(block.type) : 'Page';
    toolbar.appendChild(label);
    toolbar.appendChild(sep());

    // Inline B / I / U (execCommand on focused editable).
    [['bold', 'bi-type-bold'], ['italic', 'bi-type-italic'], ['underline', 'bi-type-underline']].forEach(function (c) {
      var btn = tbBtn(c[1], function () { document.execCommand(c[0]); saveFocusedEditable(); });
      if (!textual) btn.disabled = true, btn.style.opacity = .35;
      toolbar.appendChild(btn);
    });
    toolbar.appendChild(sep());

    // Font size.
    var size = document.createElement('select');
    FONT_SIZES.forEach(function (s) { var o = document.createElement('option'); o.value = s; o.textContent = s; size.appendChild(o); });
    size.value = (block && block.style.fontSize) || 14;
    size.disabled = !textual;
    size.addEventListener('change', function () { setStyle('fontSize', Number(size.value)); });
    toolbar.appendChild(size);

    // Text color.
    var color = document.createElement('input');
    color.type = 'color';
    color.value = toHex((block && block.style.color) || '#1f2937');
    color.disabled = !textual;
    color.title = 'Text color';
    color.addEventListener('input', function () { setStyle('color', color.value); });
    toolbar.appendChild(color);
    toolbar.appendChild(sep());

    // Align.
    [['left', 'bi-text-left'], ['center', 'bi-text-center'], ['right', 'bi-text-right']].forEach(function (a) {
      var btn = tbBtn(a[1], function () { setStyle('align', a[0]); });
      if (block && block.style.align === a[0]) btn.classList.add('active');
      if (!block) btn.disabled = true, btn.style.opacity = .35;
      toolbar.appendChild(btn);
    });

    if (block) {
      toolbar.appendChild(sep());
      toolbar.appendChild(tbBtn('bi-files', function () { duplicateBlock(block.id); }));
      var del = tbBtn('bi-trash', function () { deleteBlock(block.id); });
      del.style.color = 'var(--danger)';
      toolbar.appendChild(del);
    }

    // Keep selection when pressing toolbar buttons.
    toolbar.querySelectorAll('.tb-btn').forEach(function (b) {
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    });
  }

  function saveFocusedEditable() {
    var el = document.activeElement;
    if (!el || !el.getAttribute || !el.getAttribute('data-edit')) return;
    var blk = el.closest('.doc-blk'); if (!blk) return;
    var f = App.doc.findBlock(model, blk.getAttribute('data-id')); if (!f) return;
    var prop = el.getAttribute('data-edit');
    f.block.props[prop] = (prop === 'label') ? el.textContent : el.innerHTML;
  }

  function tbBtn(icon, onClick) {
    var b = document.createElement('button');
    b.className = 'tb-btn';
    b.innerHTML = '<i class="bi ' + icon + '"></i>';
    b.addEventListener('click', onClick);
    return b;
  }
  function sep() { var s = document.createElement('span'); s.className = 'tb-sep'; return s; }

  function setStyle(key, value) {
    var block = selectedBlock(); if (!block) return;
    block.style = block.style || {};
    block.style[key] = value;
    renderCanvas(); renderToolbar();
  }

  /* ---------------- inspector ---------------- */
  function renderInspector() {
    inspector.innerHTML = '';
    if (!selectedId || selectedId === '__page__') return renderPageInspector();
    if (selectedId.indexOf(':') >= 0) return renderColumnInspector(selectedId);
    var block = selectedBlock();
    if (!block) return renderPageInspector();
    renderBlockInspector(block);
  }

  function renderPageInspector() {
    var p = model.page;
    inspector.appendChild(inspHead('Page settings', 'bi-aspect-ratio', null));
    var g = group('Design', [
      ctrlColor('Accent color', p.accent || '#4f46e5', function (v) { p.accent = v; recanvas(); }),
      ctrlSelect('Font family', p.fontFamily, FONT_FAMILIES, function (v) { p.fontFamily = v; recanvas(); }),
      ctrlColor('Default text color', p.color || '#1f2937', function (v) { p.color = v; recanvas(); })
    ]);
    var g2 = group('Paper', [
      ctrlNumber('Padding (px)', p.padding != null ? p.padding : 48, function (v) { p.padding = v; recanvas(); }, { min: 0, max: 120 }),
      ctrlColor('Background', p.background || '#ffffff', function (v) { p.background = v; recanvas(); })
    ]);
    inspector.appendChild(g); inspector.appendChild(g2);
    inspector.appendChild(hint('Tip: click any element on the page to edit it. Drag components or fields from the left onto the page.'));
  }

  function renderBlockInspector(block) {
    inspector.appendChild(inspHead(blockTypeName(block.type), iconFor(block.type), block));

    // Type-specific controls.
    if (block.type === 'heading' || block.type === 'text') {
      inspector.appendChild(group('Text', [
        ctrlNumber('Font size', block.style.fontSize || 14, function (v) { sStyle(block, 'fontSize', v); }, { min: 8, max: 80 }),
        ctrlColor('Color', block.style.color || '#1f2937', function (v) { sStyle(block, 'color', v); }),
        ctrlToggleRow([
          ['Bold', !!block.style.bold, function (v) { sStyle(block, 'bold', v); }],
          ['Italic', !!block.style.italic, function (v) { sStyle(block, 'italic', v); }],
          ['Underline', !!block.style.underline, function (v) { sStyle(block, 'underline', v); }],
          ['Uppercase', !!block.style.uppercase, function (v) { sStyle(block, 'uppercase', v); }]
        ]),
        ctrlAlign(block.style.align || 'left', function (v) { sStyle(block, 'align', v); }),
        ctrlNumber('Letter spacing (em)', block.style.letterSpacing || 0, function (v) { sStyle(block, 'letterSpacing', v); }, { min: -0.1, max: 0.5, step: 0.01 })
      ]));
    } else if (block.type === 'field') {
      inspector.appendChild(group('Data', [
        ctrlFieldBinding(block.props.binding, function (v) { block.props.binding = v; recanvas(); renderInspector(); }),
        ctrlText('Label (optional)', block.props.label || '', function (v) { block.props.label = v; recanvas(); }),
        ctrlSelect('Layout', block.props.layout || 'stacked', [{ value: 'stacked', label: 'Label above' }, { value: 'inline', label: 'Label inline' }], function (v) { block.props.layout = v; recanvas(); })
      ]));
      inspector.appendChild(group('Text', [
        ctrlNumber('Font size', block.style.fontSize || 14, function (v) { sStyle(block, 'fontSize', v); }, { min: 8, max: 80 }),
        ctrlColor('Color', block.style.color || '#1f2937', function (v) { sStyle(block, 'color', v); }),
        ctrlToggleRow([['Bold', !!block.style.bold, function (v) { sStyle(block, 'bold', v); }], ['Italic', !!block.style.italic, function (v) { sStyle(block, 'italic', v); }]]),
        ctrlAlign(block.style.align || 'left', function (v) { sStyle(block, 'align', v); })
      ]));
    } else if (block.type === 'image') {
      var children = [
        ctrlToggle('Use business logo (auto)', block.props.bind === 'seller.logo', function (v) { block.props.bind = v ? 'seller.logo' : ''; recanvas(); renderInspector(); })
      ];
      if (block.props.bind !== 'seller.logo') children.push(ctrlImageUpload(block));
      children.push(ctrlNumber('Width (px)', block.props.width || 160, function (v) { block.props.width = v; recanvas(); }, { min: 24, max: 600 }));
      children.push(ctrlAlign(block.style.align || 'left', function (v) { sStyle(block, 'align', v); }));
      children.push(ctrlToggle('Invert (for dark backgrounds)', !!block.props.invert, function (v) { block.props.invert = v; recanvas(); }));
      inspector.appendChild(group('Image', children));
    } else if (block.type === 'divider') {
      inspector.appendChild(group('Divider', [
        ctrlColor('Color', block.props.color || '#d8dee6', function (v) { block.props.color = v; recanvas(); }),
        ctrlNumber('Thickness (px)', block.props.thickness || 1, function (v) { block.props.thickness = v; recanvas(); }, { min: 1, max: 12 }),
        ctrlSelect('Style', block.props.lineStyle || 'solid', [{ value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }, { value: 'dotted', label: 'Dotted' }], function (v) { block.props.lineStyle = v; recanvas(); })
      ]));
    } else if (block.type === 'spacer') {
      inspector.appendChild(group('Spacer', [
        ctrlNumber('Height (px)', block.props.height || 24, function (v) { block.props.height = v; recanvas(); }, { min: 2, max: 200 })
      ]));
    } else if (block.type === 'items') {
      inspector.appendChild(group('Table header', [
        ctrlColor('Header background', block.props.headerBg || model.page.accent || '#1e293b', function (v) { block.props.headerBg = v; recanvas(); }),
        ctrlColor('Header text', block.props.headerColor || '#ffffff', function (v) { block.props.headerColor = v; recanvas(); })
      ]));
      inspector.appendChild(group('Columns', [ctrlItemColumns(block)]));
    } else if (block.type === 'totals') {
      inspector.appendChild(group('Totals', [
        ctrlNumber('Width (px)', block.props.width || 300, function (v) { block.props.width = v; recanvas(); }, { min: 160, max: 500 }),
        ctrlToggle('Show tax row', block.props.showTax !== false, function (v) { block.props.showTax = v; recanvas(); }),
        ctrlAlign(block.style.align || 'right', function (v) { sStyle(block, 'align', v); })
      ]));
    } else if (block.type === 'columns') {
      inspector.appendChild(group('Layout', [
        ctrlNumber('Gap (px)', block.props.gap != null ? block.props.gap : 24, function (v) { block.props.gap = v; recanvas(); }, { min: 0, max: 80 }),
        ctrlSelect('Vertical align', block.props.valign || 'flex-start', [{ value: 'flex-start', label: 'Top' }, { value: 'center', label: 'Center' }, { value: 'stretch', label: 'Stretch' }], function (v) { block.props.valign = v; recanvas(); }),
        ctrlColumnManager(block)
      ]));
    }

    // Spacing — common to all blocks.
    inspector.appendChild(group('Spacing', [
      ctrlNumber('Margin top (px)', block.style.marginTop || 0, function (v) { sStyle(block, 'marginTop', v); }, { min: 0, max: 120 }),
      ctrlNumber('Margin bottom (px)', block.style.marginBottom != null ? block.style.marginBottom : 12, function (v) { sStyle(block, 'marginBottom', v); }, { min: 0, max: 120 })
    ]));
  }

  function renderColumnInspector(colId) {
    var parts = colId.split(':');
    var f = App.doc.findBlock(model, parts[0]);
    if (!f) { selectPage(); return; }
    var col = f.block.columns[Number(parts[1])];
    col.style = col.style || {};
    var head = inspHead('Column ' + (Number(parts[1]) + 1), 'bi-layout-sidebar', null);
    inspector.appendChild(head);
    var back = document.createElement('button');
    back.className = 'btn btn-ghost btn-sm'; back.innerHTML = '<i class="bi bi-arrow-left"></i> Back to columns';
    back.style.marginBottom = '12px';
    back.addEventListener('click', function () { select(f.block.id); });
    inspector.appendChild(back);

    inspector.appendChild(group('Column style', [
      ctrlText('Width (flex or px)', col.style.flex || '1', function (v) { col.style.flex = v; recanvas(); }),
      ctrlColor('Background', col.style.bg || '#ffffff', function (v) { col.style.bg = v; recanvas(); }, true),
      ctrlColor('Text color', col.style.color || '#1f2937', function (v) { col.style.color = v; recanvas(); }, true),
      ctrlNumber('Padding (px)', col.style.padding || 0, function (v) { col.style.padding = v; recanvas(); }, { min: 0, max: 80 }),
      ctrlNumber('Corner radius (px)', col.style.radius || 0, function (v) { col.style.radius = v; recanvas(); }, { min: 0, max: 40 }),
      ctrlNumber('Min height (px)', col.style.minHeight || 0, function (v) { col.style.minHeight = v || null; recanvas(); }, { min: 0, max: 1200 })
    ]));
    inspector.appendChild(hint('Width accepts a flex value like "1" (share space) or a fixed size like "0 0 240px".'));
  }

  /* ---------------- inspector control builders ---------------- */
  function inspHead(title, icon, block) {
    var h = document.createElement('div');
    h.className = 'insp-head';
    h.innerHTML = '<div class="t"><i class="bi ' + icon + '"></i>' + App.util.escapeHtml(title) + '</div>';
    if (block) {
      var acts = document.createElement('div'); acts.className = 'insp-actions';
      var dup = iconBtn('bi-files', 'Duplicate', function () { duplicateBlock(block.id); });
      var del = iconBtn('bi-trash', 'Delete', function () { deleteBlock(block.id); });
      del.style.color = 'var(--danger)';
      acts.appendChild(dup); acts.appendChild(del);
      h.appendChild(acts);
    }
    return h;
  }
  function iconBtn(icon, title, fn) {
    var b = document.createElement('button'); b.className = 'btn btn-ghost btn-sm btn-icon'; b.title = title;
    b.innerHTML = '<i class="bi ' + icon + '"></i>'; b.addEventListener('click', fn); return b;
  }
  function group(title, children) {
    var g = document.createElement('div'); g.className = 'insp-group';
    g.innerHTML = '<div class="gt">' + title + '</div>';
    children.forEach(function (c) { if (c) g.appendChild(c); });
    return g;
  }
  function field(labelText, controlEl) {
    var f = document.createElement('div'); f.className = 'insp-field';
    if (labelText) { var l = document.createElement('label'); l.textContent = labelText; f.appendChild(l); }
    f.appendChild(controlEl); return f;
  }
  function ctrlText(label, value, onInput) {
    var i = document.createElement('input'); i.className = 'insp-control'; i.value = value || '';
    i.addEventListener('input', function () { onInput(i.value); });
    return field(label, i);
  }
  function ctrlNumber(label, value, onInput, opt) {
    opt = opt || {};
    var i = document.createElement('input'); i.type = 'number'; i.className = 'insp-control';
    i.value = value; if (opt.min != null) i.min = opt.min; if (opt.max != null) i.max = opt.max; i.step = opt.step || 1;
    i.addEventListener('input', function () { onInput(i.value === '' ? 0 : Number(i.value)); });
    return field(label, i);
  }
  function ctrlColor(label, value, onInput) {
    var i = document.createElement('input'); i.type = 'color'; i.className = 'insp-control insp-color'; i.value = toHex(value);
    i.addEventListener('input', function () { onInput(i.value); });
    return field(label, i);
  }
  function ctrlSelect(label, value, options, onChange) {
    var s = document.createElement('select'); s.className = 'insp-control';
    options.forEach(function (o) { var op = document.createElement('option'); op.value = o.value; op.textContent = o.label; s.appendChild(op); });
    s.value = value;
    s.addEventListener('change', function () { onChange(s.value); });
    return field(label, s);
  }
  function ctrlToggle(label, checked, onChange) {
    var wrap = document.createElement('label'); wrap.className = 'insp-toggle';
    var c = document.createElement('input'); c.type = 'checkbox'; c.checked = checked;
    c.addEventListener('change', function () { onChange(c.checked); });
    wrap.appendChild(c); wrap.appendChild(document.createTextNode(label));
    return wrap;
  }
  function ctrlToggleRow(items) {
    var wrap = document.createElement('div');
    items.forEach(function (it) { wrap.appendChild(ctrlToggle(it[0], it[1], it[2])); });
    return wrap;
  }
  function ctrlAlign(value, onChange) {
    var seg = document.createElement('div'); seg.className = 'insp-seg';
    [['left', 'bi-text-left'], ['center', 'bi-text-center'], ['right', 'bi-text-right']].forEach(function (a) {
      var b = document.createElement('button'); b.innerHTML = '<i class="bi ' + a[1] + '"></i>';
      if (value === a[0]) b.classList.add('active');
      b.addEventListener('click', function () { onChange(a[0]); });
      seg.appendChild(b);
    });
    return field('Alignment', seg);
  }
  function ctrlFieldBinding(value, onChange) {
    var s = document.createElement('select'); s.className = 'insp-control';
    App.doc.FIELD_GROUPS.forEach(function (g) {
      var og = document.createElement('optgroup'); og.label = g.group;
      g.fields.forEach(function (f) { var o = document.createElement('option'); o.value = f.binding; o.textContent = f.label; og.appendChild(o); });
      s.appendChild(og);
    });
    s.value = value;
    s.addEventListener('change', function () { onChange(s.value); });
    return field('Bound field', s);
  }
  function ctrlImageUpload(block) {
    var wrap = document.createElement('div');
    var input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
    var btn = document.createElement('button'); btn.className = 'btn btn-secondary btn-sm'; btn.innerHTML = '<i class="bi bi-upload"></i> Upload image';
    var clear = document.createElement('button'); clear.className = 'btn btn-ghost btn-sm'; clear.textContent = 'Clear'; clear.style.marginLeft = '6px';
    btn.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      var file = input.files[0]; if (!file) return;
      var r = new FileReader(); r.onload = function () { block.props.src = r.result; recanvas(); renderInspector(); }; r.readAsDataURL(file);
    });
    clear.addEventListener('click', function () { block.props.src = ''; recanvas(); renderInspector(); });
    wrap.appendChild(input); wrap.appendChild(btn); wrap.appendChild(clear);
    return field('Source', wrap);
  }
  function ctrlItemColumns(block) {
    var wrap = document.createElement('div');
    var current = block.props.columns || App.doc.ITEM_DEFAULT_COLS;
    App.doc.ITEM_DEFAULT_COLS.forEach(function (def) {
      var on = current.filter(function (c) { return c.key === def.key; })[0];
      var row = document.createElement('div'); row.className = 'insp-row'; row.style.marginBottom = '6px';
      var tg = document.createElement('input'); tg.type = 'checkbox'; tg.checked = !!on;
      var lbl = document.createElement('input'); lbl.className = 'insp-control'; lbl.value = on ? on.label : def.label; lbl.disabled = !on;
      tg.addEventListener('change', function () { rebuildItemCols(block); });
      lbl.addEventListener('input', function () { rebuildItemCols(block); });
      tg.setAttribute('data-key', def.key); lbl.setAttribute('data-key', def.key);
      row.appendChild(tg); row.appendChild(lbl);
      wrap.appendChild(row);
    });
    function rebuildItemCols() {
      var cols = [];
      wrap.querySelectorAll('.insp-row').forEach(function (r) {
        var tg = r.querySelector('input[type=checkbox]'); var lbl = r.querySelector('.insp-control');
        lbl.disabled = !tg.checked;
        if (tg.checked) cols.push({ key: tg.getAttribute('data-key'), label: lbl.value });
      });
      block.props.columns = cols.length ? cols : App.doc.ITEM_DEFAULT_COLS.slice();
      recanvas();
    }
    return wrap;
  }
  function ctrlColumnManager(block) {
    var wrap = document.createElement('div');
    var btns = document.createElement('div'); btns.className = 'insp-colbtns'; btns.style.marginBottom = '8px';
    (block.columns || []).forEach(function (c, i) {
      var b = document.createElement('button'); b.textContent = 'Edit col ' + (i + 1);
      b.addEventListener('click', function () { select(block.id + ':' + i); });
      btns.appendChild(b);
    });
    wrap.appendChild(btns);
    var row = document.createElement('div'); row.className = 'insp-row';
    var add = document.createElement('button'); add.className = 'btn btn-secondary btn-sm'; add.innerHTML = '<i class="bi bi-plus-lg"></i> Add';
    add.addEventListener('click', function () { block.columns.push({ style: { flex: '1' }, blocks: [] }); recanvas(); renderInspector(); });
    var rem = document.createElement('button'); rem.className = 'btn btn-ghost btn-sm'; rem.innerHTML = '<i class="bi bi-dash-lg"></i> Remove';
    rem.addEventListener('click', function () { if (block.columns.length > 1) { block.columns.pop(); recanvas(); renderInspector(); } });
    row.appendChild(add); row.appendChild(rem);
    wrap.appendChild(row);
    return wrap;
  }
  function hint(text) { var p = document.createElement('p'); p.className = 'insp-hint'; p.textContent = text; return p; }

  /* ---------------- helpers ---------------- */
  function sStyle(block, key, value) { block.style = block.style || {}; block.style[key] = value; recanvas(); }
  function recanvas() { renderCanvas(); }
  function blockTypeName(t) {
    return { heading: 'Heading', text: 'Text', field: 'Field', image: 'Image', divider: 'Divider', spacer: 'Spacer', items: 'Line items', totals: 'Totals', columns: 'Columns' }[t] || t;
  }
  function iconFor(t) {
    return { heading: 'bi-type-h1', text: 'bi-fonts', field: 'bi-bezier2', image: 'bi-image', divider: 'bi-dash-lg', spacer: 'bi-arrows-expand', items: 'bi-table', totals: 'bi-calculator', columns: 'bi-layout-three-columns' }[t] || 'bi-square';
  }
  function toHex(c) {
    if (!c) return '#000000';
    if (c[0] === '#' && c.length === 7) return c;
    if (c[0] === '#' && c.length === 4) return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    return '#000000';
  }

  /* ---------------- mount ---------------- */
  function mount(root, params) {
    rootEl = root;
    var built = buildMeta(params);
    model = built.model; meta = built.meta;
    sample = App.invoiceModel.sampleInvoice();
    sample.templateModel = model;
    selectedId = '__page__';

    canvas = root.querySelector('#te-canvas');
    inspector = root.querySelector('#te-inspector');
    toolbar = root.querySelector('#te-toolbar');

    var nameInput = root.querySelector('#te-name');
    nameInput.value = meta.name;
    nameInput.addEventListener('input', function () { meta.name = nameInput.value; });
    root.querySelector('#te-sub').textContent = meta.isNew ? 'New template' : 'Editing';

    buildPalette();
    renderCanvas();
    renderInspector();
    renderToolbar();

    // Canvas interactions.
    canvas.addEventListener('click', function (e) {
      if (e.target.closest('.blk-tools')) return;
      var blk = e.target.closest('.doc-blk');
      if (blk) select(blk.getAttribute('data-id'));
      else if (e.target.closest('.te2-paper-frame')) selectPage();
    });
    canvas.addEventListener('mouseover', function (e) {
      var b = e.target.closest('.doc-blk');
      paperFrame.querySelectorAll('.hovered').forEach(function (n) { n.classList.remove('hovered'); });
      if (b) b.classList.add('hovered');
    });
    canvas.addEventListener('mouseleave', function () {
      if (paperFrame) paperFrame.querySelectorAll('.hovered').forEach(function (n) { n.classList.remove('hovered'); });
    });
    canvas.addEventListener('dragover', onDragOver);
    canvas.addEventListener('drop', onDrop);

    // Top actions.
    var backBtn = root.querySelector('[data-act="back"]');
    if (backBtn) backBtn.addEventListener('click', function () { App.router.navigate({ page: 'templates' }); });
    root.querySelector('[data-act="reset"]').addEventListener('click', selectPage);
    root.querySelector('[data-act="save"]').addEventListener('click', save);

    // Delete key removes selected block (when not editing text).
    keyHandler = function (e) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlock()) {
        var ae = document.activeElement;
        if (ae && ae.getAttribute && ae.getAttribute('contenteditable') === 'true') return;
        e.preventDefault(); deleteBlock(selectedId);
      }
    };
    document.addEventListener('keydown', keyHandler);

    resizeHandler = App.util.debounce(fitCanvas, 120);
    window.addEventListener('resize', resizeHandler);
  }

  function save() {
    if (!meta.name.trim()) { App.toast('Give your template a name', 'error'); rootEl.querySelector('#te-name').focus(); return; }
    var tpl = { id: meta.id || App.util.uuid('tpl'), name: meta.name.trim(), model: App.util.deepClone(model) };
    App.store.saveUserTemplate(tpl);
    App.toast('Template saved', 'success');
    App.router.navigate({ page: 'templates' });
  }

  function unmount() {
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    if (resizeHandler) window.removeEventListener('resize', resizeHandler);
    if (dropLine) { dropLine.remove(); dropLine = null; }
    model = meta = sample = selectedId = null;
    rootEl = canvas = inspector = toolbar = paperFrame = null;
  }

  return { mount: mount, unmount: unmount };
})());
