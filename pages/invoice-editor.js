/* ============================================================
   Page: invoice-editor — edit the invoice DIRECTLY on the page.

   The invoice is rendered with the document renderer in "data edit"
   mode: bound fields, dates, the logo and line items are editable
   in place. A slim side panel holds the few things the invoice
   itself can't carry (template, currency, tax, discount, status).
   ============================================================ */
App.pages.register('invoice-editor', (function () {
  var invoice = null;
  var model = null;
  var rootEl = null;
  var scheduleSave = null;

  /* ---------------- autosave ---------------- */
  function setStatus(state) {
    var tag = rootEl && rootEl.querySelector('#ie-status-tag');
    if (!tag) return;
    tag.className = 'ie-status ' + state;
    tag.textContent = state === 'saving' ? 'Saving…' : (state === 'saved' ? '✓ All changes saved' : '');
  }
  function touch() { setStatus('saving'); if (scheduleSave) scheduleSave(); }

  /* ---------------- binding helpers ---------------- */
  function setBinding(binding, value) {
    switch (binding) {
      case 'seller.name': invoice.seller.name = value; invoice.businessId = ''; break;
      case 'seller.address': invoice.seller.address = value; invoice.businessId = ''; break;
      case 'seller.email': invoice.seller.email = value; invoice.businessId = ''; break;
      case 'seller.phone': invoice.seller.phone = value; invoice.businessId = ''; break;
      case 'seller.taxId': invoice.seller.taxId = value; invoice.businessId = ''; break;
      case 'client.name': invoice.buyer.name = value; invoice.clientId = ''; break;
      case 'client.contactName': invoice.buyer.contactName = value; invoice.clientId = ''; break;
      case 'client.address': invoice.buyer.address = value; invoice.clientId = ''; break;
      case 'client.email': invoice.buyer.email = value; invoice.clientId = ''; break;
      case 'client.phone': invoice.buyer.phone = value; invoice.clientId = ''; break;
      case 'client.taxId': invoice.buyer.taxId = value; invoice.clientId = ''; break;
      case 'invoice.number': invoice.meta.number = value; break;
      case 'invoice.title': invoice.meta.title = value; break;
      case 'invoice.poNumber': invoice.meta.poNumber = value; break;
      case 'invoice.issueDate': invoice.meta.issueDate = value; break;
      case 'invoice.dueDate': invoice.meta.dueDate = value; break;
      case 'invoice.notes': invoice.notes = value; break;
      case 'invoice.paymentInstructions': invoice.paymentInstructions = value; break;
    }
  }
  function getLi(id) { return (invoice.lineItems || []).filter(function (li) { return li.id === id; })[0]; }

  /* ---------------- rendering ---------------- */
  function paperHost() { return rootEl.querySelector('#ie-paper'); }

  function reRenderPaper() {
    var host = paperHost();
    host.innerHTML = '';
    host.appendChild(App.templates.renderEditorView(invoice));
    fit();
  }

  var paperZoom = 1;

  function fit() {
    var stage = rootEl.querySelector('.ie-preview-col');
    var paper = rootEl.querySelector('#ie-paper .invoice-paper');
    var autoZoom = App.util.fitA4Paper(stage, paper);
    paperZoom = autoZoom;
  }

  function setPaperZoom(delta) {
    paperZoom = Math.max(0.25, Math.min(3, paperZoom + delta));
    var paper = rootEl.querySelector('#ie-paper .invoice-paper');
    if (paper) paper.style.zoom = String(paperZoom);
  }

  // Repaint values that derive from line items (amounts + totals) without
  // rebuilding the DOM, so the caret stays put while typing.
  function repaintDerived() {
    var host = paperHost();
    host.querySelectorAll('[data-amount-for], td[data-col="amount"]').forEach(function (td) {
      if (td === document.activeElement) return;
      var li = getLi(td.getAttribute('data-amount-for') || td.getAttribute('data-li'));
      if (!li) return;
      var amt = App.invoiceModel.lineAmount(li);
      td.textContent = td.hasAttribute('data-amount-for') ? App.util.formatMoney(amt, invoice.meta.currency) : amt;
    });
    host.querySelectorAll('.doc-blk[data-type="totals"]').forEach(function (w) {
      var f = App.doc.findBlock(model, w.getAttribute('data-id'));
      var box = w.querySelector('.doc-totals');
      if (box) box.innerHTML = App.doc.totalsRowsHtml(invoice, model.page.accent, f ? f.block.props : {});
    });
  }

  /* ---------------- line items ---------------- */
  function addItem() {
    var li = App.invoiceModel.blankLineItem();
    invoice.lineItems.push(li);
    reRenderPaper();
    touch();
    focusCell(li.id, 'description');
  }
  function removeItem(id) {
    invoice.lineItems = (invoice.lineItems || []).filter(function (li) { return li.id !== id; });
    reRenderPaper();
    touch();
  }
  function focusCell(id, col) {
    var cell = rootEl.querySelector('[data-li="' + id + '"][data-col="' + col + '"]');
    if (cell) {
      cell.focus();
      var r = document.createRange(); r.selectNodeContents(cell); r.collapse(false);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    }
  }
  // Enter inside a line-item cell jumps to the same column of the next
  // row, creating a new row when at the end (spreadsheet-style flow).
  function advanceRow(cell) {
    var id = cell.getAttribute('data-li');
    var col = cell.getAttribute('data-col');
    var items = invoice.lineItems || [];
    var idx = -1;
    for (var i = 0; i < items.length; i++) { if (items[i].id === id) { idx = i; break; } }
    if (idx === items.length - 1) { addItem(); return; }
    focusCell(items[idx + 1].id, col);
  }

  /* ---------------- inline date editing ---------------- */
  function openDate(el) {
    var input = document.createElement('input');
    input.type = 'date';
    input.className = 'ie-date-input';
    input.value = el.getAttribute('data-raw') || '';
    var binding = el.getAttribute('data-bind');
    var done = false;
    function commit() { if (done) return; done = true; setBinding(binding, input.value); reRenderPaper(); touch(); }
    input.addEventListener('change', commit);
    input.addEventListener('blur', commit);
    el.parentNode.replaceChild(input, el);
    input.focus();
    if (input.showPicker) { try { input.showPicker(); } catch (e) { } }
  }

  /* ---------------- canvas event wiring ---------------- */
  function wireCanvas() {
    var host = paperHost();

    host.addEventListener('input', function (e) {
      var cell = e.target.closest && e.target.closest('[data-li]');
      if (cell) {
        var li = getLi(cell.getAttribute('data-li')); if (!li) return;
        var col = cell.getAttribute('data-col');
        if (col === 'description') li.description = cell.innerText;
        else if (col === 'amount') { var a = parseFloat(cell.innerText); li.amount = isNaN(a) ? 0 : a; }
        else { var n = parseFloat(cell.innerText); li[col] = isNaN(n) ? 0 : n; delete li.amount; }
        repaintDerived();
        touch();
        return;
      }
      var stat = e.target.closest && e.target.closest('[data-static]');
      if (stat) {
        var blk = stat.closest('.doc-blk'); if (!blk) return;
        var f = App.doc.findBlock(model, blk.getAttribute('data-id')); if (!f) return;
        if (stat.getAttribute('data-static') === 'label') f.block.props.label = stat.innerText;
        else f.block.props.text = stat.innerText;
        touch();
        return;
      }
      var fld = e.target.closest && e.target.closest('.doc-edit[contenteditable="true"]');
      if (fld) {
        var binding = fld.getAttribute('data-bind');
        setBinding(binding, fld.innerText);
        if (binding && binding.indexOf('seller.') === 0) populateBusinessSelect();
        if (binding && binding.indexOf('client.') === 0) populateClientSelect();
        fld.classList.toggle('doc-field-empty', fld.innerText.trim() === '');
        if (binding === 'invoice.number') rootEl.querySelector('#ie-title').textContent = fld.innerText || 'Invoice';
        touch();
      }
    });

    host.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var t = e.target;
      if (t.matches && t.matches('[data-li]')) { e.preventDefault(); advanceRow(t); return; }
      if (t.classList && t.classList.contains('doc-edit') && t.getAttribute('data-kind') !== 'multiline') { e.preventDefault(); t.blur(); }
    });

    host.addEventListener('click', function (e) {
      if (e.target.closest('[data-additem]')) { addItem(); return; }
      var del = e.target.closest('[data-del]'); if (del) { removeItem(del.getAttribute('data-del')); return; }
      if (e.target.closest('[data-logo]')) { rootEl.querySelector('#ie-logo-input').click(); return; }
      var date = e.target.closest('.doc-edit-date'); if (date) { openDate(date); return; }
    });
  }

  /* ---------------- side panel ---------------- */
  function populateTemplateSelect() {
    var sel = rootEl.querySelector('#f-template');
    sel.innerHTML = App.templates.getAll().map(function (t) {
      return '<option value="' + t.id + '"' + (t.id === invoice.templateId ? ' selected' : '') + '>' +
        App.util.escapeHtml(t.name) + (t.builtIn ? '' : ' (custom)') + '</option>';
    }).join('');
    sel.addEventListener('change', function () {
      var tpl = App.templates.get(sel.value);
      invoice.templateId = sel.value;
      if (tpl && tpl.model) { invoice.templateModel = App.util.deepClone(tpl.model); model = invoice.templateModel; }
      reRenderPaper();
      updateSidebar();
      touch();
    });
  }

  function clearBuyer() {
    invoice.clientId = '';
    invoice.buyer = { name: '', contactName: '', address: '', email: '', phone: '', taxId: '' };
  }

  function clearSeller() {
    invoice.businessId = '';
    invoice.seller = { name: '', address: '', email: '', phone: '', taxId: '', logo: '' };
  }

  function populateBusinessSelect() {
    var sel = rootEl.querySelector('#f-business');
    var businesses = App.store.getBusinesses();
    var selected = invoice.businessId || '';
    var manual = !selected && invoice.seller && (
      invoice.seller.name || invoice.seller.address || invoice.seller.email ||
      invoice.seller.phone || invoice.seller.taxId || invoice.seller.logo
    );

    sel.innerHTML = '<option value="">Choose a saved business...</option>' +
      (manual ? '<option value="__manual" selected>Custom invoice business</option>' : '') +
      businesses.map(function (business) {
        var label = business.name || 'Unnamed business';
        return '<option value="' + business.id + '"' + (business.id === selected ? ' selected' : '') + '>' +
          App.util.escapeHtml(label) + '</option>';
      }).join('');
    sel.disabled = businesses.length === 0;
    if (!businesses.length) sel.innerHTML = '<option value="">No saved businesses yet</option>';
  }

  function populateClientSelect() {
    var sel = rootEl.querySelector('#f-client');
    var clients = App.store.getClients();
    var selected = invoice.clientId || '';
    var manual = !selected && invoice.buyer && (
      invoice.buyer.name || invoice.buyer.contactName || invoice.buyer.address ||
      invoice.buyer.email || invoice.buyer.phone || invoice.buyer.taxId
    );

    sel.innerHTML = '<option value="">Choose a saved client...</option>' +
      (manual ? '<option value="__manual" selected>Custom invoice client</option>' : '') +
      clients.map(function (client) {
        var label = client.name || client.contactName || 'Unnamed client';
        return '<option value="' + client.id + '"' + (client.id === selected ? ' selected' : '') + '>' +
          App.util.escapeHtml(label) + '</option>';
      }).join('');
    sel.disabled = clients.length === 0;
    if (!clients.length) sel.innerHTML = '<option value="">No saved clients yet</option>';
  }

  function updateSidebar() {
    var u = App.doc.usedBindings(model);
    rootEl.querySelector('#f-tax-row').style.display = u.hasTotals ? '' : 'none';
  }

  /* ---------------- mount ---------------- */
  function mount(root, params) {
    rootEl = root;

    if (params.id) invoice = App.store.getInvoice(params.id);
    if (!invoice) {
      invoice = App.invoiceModel.createInvoice(params.template);
      if (params.business) App.invoiceModel.applyBusiness(invoice, App.store.getBusiness(params.business));
      if (params.client) App.invoiceModel.applyClient(invoice, App.store.getClient(params.client));
      invoice.meta.number = App.store.nextInvoiceNumber();
      App.store.saveInvoice(invoice);
      App.router.navigate({ page: 'invoice-editor', id: invoice.id }, { replace: true });
    }
    model = invoice.templateModel || App.util.deepClone(App.templates.modelFor(invoice));
    invoice.templateModel = model;

    scheduleSave = App.util.debounce(function () { App.store.saveInvoice(invoice); setStatus('saved'); }, 600);

    root.querySelector('#ie-title').textContent = invoice.meta.number || 'Edit invoice';

    // Side panel state.
    populateBusinessSelect();
    root.querySelector('#f-business').addEventListener('change', function (e) {
      var id = e.target.value;
      if (!id || id === '__manual') return;
      var business = App.store.getBusiness(id);
      if (!business) return;
      App.invoiceModel.applyBusiness(invoice, business);
      populateBusinessSelect();
      reRenderPaper();
      touch();
    });
    root.querySelector('[data-act="manage-businesses"]').addEventListener('click', function () {
      App.router.navigate({ page: 'businesses' });
    });
    root.querySelector('[data-act="clear-business"]').addEventListener('click', function () {
      clearSeller();
      populateBusinessSelect();
      reRenderPaper();
      touch();
    });

    populateClientSelect();
    root.querySelector('#f-client').addEventListener('change', function (e) {
      var id = e.target.value;
      if (!id || id === '__manual') return;
      var client = App.store.getClient(id);
      if (!client) return;
      App.invoiceModel.applyClient(invoice, client);
      populateClientSelect();
      reRenderPaper();
      touch();
    });
    root.querySelector('[data-act="manage-clients"]').addEventListener('click', function () {
      App.router.navigate({ page: 'clients' });
    });
    root.querySelector('[data-act="clear-client"]').addEventListener('click', function () {
      clearBuyer();
      populateClientSelect();
      reRenderPaper();
      touch();
    });

    populateTemplateSelect();
    var statusSel = root.querySelector('#ie-status');
    statusSel.value = invoice.status;
    statusSel.addEventListener('change', function () { invoice.status = statusSel.value; touch(); });

    var cur = root.querySelector('#f-currency');
    cur.value = invoice.meta.currency;
    cur.addEventListener('change', function () { invoice.meta.currency = cur.value; reRenderPaper(); touch(); });

    var tax = root.querySelector('#f-tax');
    tax.value = invoice.taxRate || 0;
    tax.addEventListener('input', function () { invoice.taxRate = tax.value === '' ? 0 : Number(tax.value); repaintDerived(); touch(); });

    var disc = root.querySelector('#f-discount');
    disc.value = invoice.discount || 0;
    disc.addEventListener('input', function () { invoice.discount = disc.value === '' ? 0 : Number(disc.value); repaintDerived(); touch(); });

    updateSidebar();

    // Logo upload (triggered by clicking the logo on the invoice).
    var logoInput = root.querySelector('#ie-logo-input');
    logoInput.addEventListener('change', function () {
      var file = logoInput.files[0]; if (!file) return;
      if (file.size > 1024 * 1024) App.toast('Large image — consider a smaller logo', 'info');
      var reader = new FileReader();
      reader.onload = function () { invoice.seller.logo = reader.result; invoice.businessId = ''; populateBusinessSelect(); reRenderPaper(); touch(); };
      reader.readAsDataURL(file);
      logoInput.value = '';
    });

    reRenderPaper();
    wireCanvas();

    // Top actions.
    root.querySelector('[data-act="save"]').addEventListener('click', function () {
      App.store.saveInvoice(invoice);
      setStatus('saved');
      App.toast('Invoice saved', 'success');
    });
    var backBtn = root.querySelector('[data-act="back"]');
    if (backBtn) backBtn.addEventListener('click', function () { App.router.navigate({ page: 'invoices' }); });
    root.querySelector('[data-act="delete"]').addEventListener('click', function () {
      if (!confirm('Delete invoice ' + invoice.meta.number + '? This cannot be undone.')) return;
      App.store.deleteInvoice(invoice.id);
      App.toast('Invoice deleted', 'info');
      App.router.navigate({ page: 'invoices' });
    });
    root.querySelector('[data-act="pdf"]').addEventListener('click', function (e) {
      var btn = e.currentTarget;
      App.store.saveInvoice(invoice);
      btn.disabled = true;
      var orig = btn.innerHTML;
      btn.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Exporting…';
      App.pdf.exportInvoice(invoice, invoice.meta.number || 'invoice').then(function () {
        App.toast('PDF exported', 'success');
      }).catch(function (err) {
        console.error(err); App.toast('PDF export failed', 'error');
      }).then(function () { btn.disabled = false; btn.innerHTML = orig; });
    });

    _resize = App.util.debounce(fit, 120);
    window.addEventListener('resize', _resize);

    // Mouse-wheel zoom on the invoice preview (Ctrl/Cmd + wheel).
    var stage = root.querySelector('.ie-preview-col');
    if (stage) {
      stage.addEventListener('wheel', function (e) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          var delta = e.deltaY > 0 ? -0.1 : 0.1;
          setPaperZoom(delta);
        }
      }, { passive: false });

      // Click-and-drag pan on invoice preview.
      initInvoicePan(stage);
    }
  }

  var _resize;
  function unmount() {
    if (_resize) window.removeEventListener('resize', _resize);
    destroyInvoicePan();
    if (invoice) App.store.saveInvoice(invoice);
    invoice = model = rootEl = null;
    scheduleSave = null;
  }

  /* ---------------- invoice pan ---------------- */
  var invoicePanState = null;
  var invoicePanCleanup = null;

  function initInvoicePan(stageEl) {
    function setPanReady(ready) {
      stageEl.classList.toggle('pan-ready', ready);
    }

    function onMouseDown(e) {
      // Only pan with Ctrl + left mouse.
      if (e.button !== 0 || !e.ctrlKey) return;
      invoicePanState = { startX: e.clientX, startY: e.clientY, scrollLeft: stageEl.scrollLeft, scrollTop: stageEl.scrollTop };
      stageEl.classList.add('panning');
      e.preventDefault();
    }

    function onMouseMove(e) {
      if (!invoicePanState) return;
      if ((e.buttons & 1) === 0 || !e.ctrlKey) { onMouseUp(); return; }
      var dx = e.clientX - invoicePanState.startX;
      var dy = e.clientY - invoicePanState.startY;
      stageEl.scrollLeft = invoicePanState.scrollLeft - dx;
      stageEl.scrollTop = invoicePanState.scrollTop - dy;
    }

    function onMouseUp() {
      invoicePanState = null;
      stageEl.classList.remove('panning');
    }

    function onKeyDown(e) {
      if (e.key === 'Control') setPanReady(true);
    }

    function onKeyUp(e) {
      if (e.key === 'Control') {
        setPanReady(false);
        onMouseUp();
      }
    }

    function onBlur() {
      setPanReady(false);
      onMouseUp();
    }

    stageEl.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    invoicePanCleanup = function () {
      stageEl.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }

  function destroyInvoicePan() {
    if (invoicePanCleanup) { invoicePanCleanup(); invoicePanCleanup = null; }
    invoicePanState = null;
  }

  return { mount: mount, unmount: unmount };
})());
