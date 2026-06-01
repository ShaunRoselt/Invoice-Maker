/* ============================================================
   <invoice-preview> — renders an invoice with its template onto
   an A4 "paper". Set `.invoice` to (re)render. The inner
   `.invoice-paper` element is what gets exported to PDF.
   ============================================================ */
(function () {
  var STYLE = '\
  invoice-preview { display: block; }\
  invoice-preview .paper-wrap { display: flex; justify-content: center; padding: 8px; }\
  invoice-preview .invoice-paper { box-shadow: var(--shadow); }\
  @media (max-width: 900px) { invoice-preview .paper-wrap { transform-origin: top center; } }';

  class InvoicePreview extends HTMLElement {
    set invoice(inv) { this._inv = inv; this.render(); }
    get invoice() { return this._inv; }

    connectedCallback() {
      if (!document.getElementById('invoice-preview-style')) {
        var s = document.createElement('style');
        s.id = 'invoice-preview-style';
        s.textContent = STYLE;
        document.head.appendChild(s);
      }
      if (this._inv) this.render();
    }

    getPaper() { return this.querySelector('.invoice-paper'); }

    render() {
      if (!this._inv) return;
      this.innerHTML = '<div class="paper-wrap"><div class="invoice-paper"></div></div>';
      var paper = this.querySelector('.invoice-paper');
      try {
        paper.appendChild(App.templates.renderInvoice(this._inv));
      } catch (e) {
        paper.innerHTML = '<div style="padding:40px;color:#dc2626">Template error: ' + App.util.escapeHtml(e.message) + '</div>';
      }
    }
  }
  customElements.define('invoice-preview', InvoicePreview);
})();
