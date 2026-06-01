/* ============================================================
   pdf.js — export to PDF using html2pdf (CDN).

   To guarantee the PDF looks EXACTLY like the on-screen preview,
   exportInvoice() renders the invoice through the very same
   renderer (App.templates.renderInvoice) into a full-size A4
   "paper", off-screen and unscaled, then rasterizes that.
   ============================================================ */
window.App = window.App || {};

App.pdf = (function () {
  var A4_W = 794;   // px @96dpi (210mm)
  var A4_H = 1123;  // px @96dpi (297mm)

  function opts(filename) {
    return {
      margin: 0,
      filename: (filename || 'invoice') + '.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false, windowWidth: A4_W },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    };
  }

  // Render an already full-size node to PDF, off-screen.
  function exportNode(node, filename) {
    if (typeof window.html2pdf === 'undefined') { window.print(); return Promise.resolve(); }
    var holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + A4_W + 'px;background:#fff;';
    holder.appendChild(node);
    document.body.appendChild(holder);
    return window.html2pdf().set(opts(filename)).from(node).save()
      .then(function () { holder.remove(); })
      .catch(function (err) { holder.remove(); throw err; });
  }

  // Preferred entry point: render the invoice exactly like the preview.
  function exportInvoice(invoice, filename) {
    var paper = document.createElement('div');
    paper.className = 'invoice-paper';
    paper.style.cssText = 'width:' + A4_W + 'px;min-height:' + A4_H + 'px;background:#fff;overflow:hidden;box-shadow:none;border-radius:0;';
    paper.appendChild(App.templates.renderInvoice(invoice));
    return exportNode(paper, filename || (invoice && invoice.meta && invoice.meta.number) || 'invoice');
  }

  // Fallback: export an existing element by cloning it at full scale.
  function exportElement(element, filename) {
    if (!element) return Promise.reject(new Error('No element to export'));
    if (typeof window.html2pdf === 'undefined') { window.print(); return Promise.resolve(); }
    var clone = element.cloneNode(true);
    clone.style.zoom = '1';
    clone.style.transform = 'none';
    clone.style.width = A4_W + 'px';
    clone.style.boxShadow = 'none';
    return exportNode(clone, filename);
  }

  return { exportInvoice: exportInvoice, exportElement: exportElement };
})();
