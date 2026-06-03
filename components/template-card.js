/* ============================================================
   <template-card> — gallery card with full A4 preview (scaled to
   fit, no scrollbar) + Use / Edit layout actions.
   ============================================================ */
(function () {
  var STYLE = '\
  template-card { display: block; width: 100%; }\
  template-card .tc {\
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);\
    overflow: hidden; box-shadow: var(--shadow-sm);\
    transition: box-shadow .15s, transform .15s, border-color .15s;\
    display: flex; flex-direction: column;\
  }\
  template-card .tc:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); border-color: var(--border-strong); }\
  template-card .tc-preview.a4-preview-stage {\
    overflow: hidden;\
    aspect-ratio: 794 / 1123;\
    width: 100%;\
    border-radius: 0;\
    border: none; border-bottom: 1px solid var(--border);\
  }\
  [data-theme="dark"] template-card .tc-preview.a4-preview-stage { border-bottom-color: var(--border); box-shadow: none; }\
  template-card .tc-meta { padding: 14px 16px 0; flex: 1; }\
  template-card .tc-title { font-weight: 700; margin: 0 0 4px; display: flex; align-items: center; gap: 8px; font-size: 1rem; flex-wrap: wrap; }\
  template-card .tc-desc { color: var(--text-muted); font-size: .84rem; margin: 0 0 12px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }\
  template-card .tc-tag {\
    font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;\
    padding: 2px 7px; border-radius: 6px; background: var(--surface-2); color: var(--text-faint); flex-shrink: 0;\
  }\
  template-card .tc-actions { display: flex; gap: 8px; padding: 0 16px 16px; }\
  template-card .tc-actions .btn { flex: 1; justify-content: center; }\
  template-card .tc-preview .a4-paper-host,\
  template-card .tc-preview .invoice-paper--readonly { pointer-events: none; user-select: none; }\
  template-card .tc-preview [contenteditable] { pointer-events: none !important; }\
  [data-theme="dark"] template-card .tc { background: var(--surface); border-color: var(--border); }\
  [data-theme="dark"] template-card .tc-tag { background: var(--surface-2); color: var(--text-faint); }';

  class TemplateCard extends HTMLElement {
    set template(def) { this._def = def; this.render(); }
    get template() { return this._def; }

    connectedCallback() {
      if (!document.getElementById('template-card-style')) {
        var s = document.createElement('style');
        s.id = 'template-card-style';
        s.textContent = STYLE;
        document.head.appendChild(s);
      }
      if (this._def) this.render();
    }

    disconnectedCallback() {
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
    }

    _fitPreview() {
      var stage = this.querySelector('.tc-preview');
      var paper = this.querySelector('.invoice-paper');
      App.util.fitA4PaperInBox(stage, paper);
    }

    _renderPreview() {
      var host = this.querySelector('.a4-paper-host');
      if (!host || !this._def) return;
      try {
        host.innerHTML = '';
        var inv = App.templates.previewInvoice(this._def.id);
        host.appendChild(App.templates.renderGalleryView(inv));
        this._fitPreview();
      } catch (e) {
        console.error(e);
        host.innerHTML = '<div style="padding:40px;color:#94a3b8;text-align:center">Preview unavailable</div>';
      }
    }

    render() {
      if (!this._def) return;
      var def = this._def;
      var self = this;

      var beta = false;
      try {
        var s = App.store && typeof App.store.getSettings === 'function' ? App.store.getSettings() : null;
        beta = !!(s && s.betaMode);
      } catch (e) { beta = false; }

      this.innerHTML = '\
        <div class="tc">\
          <div class="tc-preview a4-preview-stage">\
            <div class="a4-paper-host"></div>\
          </div>\
          <div class="tc-meta">\
            <h3 class="tc-title"><span class="name"></span><span class="tc-tag"></span></h3>\
            <p class="tc-desc"></p>\
          </div>\
          <div class="tc-actions">\
            <button class="btn btn-primary btn-sm" data-act="use"><i class="bi bi-pencil-square"></i> Use</button>\
            <button class="btn btn-secondary btn-sm" data-act="edit"><i class="bi bi-sliders"></i> Edit layout</button>\
          </div>\
        </div>';

      this.querySelector('.name').textContent = def.name;
      this.querySelector('.tc-desc').textContent = def.description || '';
      this.querySelector('.tc-tag').textContent = def.builtIn ? 'Built-in' : 'Custom';

      if (!beta) {
        var editBtn = this.querySelector('[data-act="edit"]');
        if (editBtn) editBtn.style.display = 'none';
      }

      this._renderPreview();

      var previewEl = this.querySelector('.tc-preview');
      if (this._ro) this._ro.disconnect();
      if (typeof ResizeObserver !== 'undefined' && previewEl) {
        this._ro = new ResizeObserver(function () { self._fitPreview(); });
        this._ro.observe(previewEl);
      }

      this.querySelector('[data-act="use"]').addEventListener('click', function () {
        self.dispatchEvent(new CustomEvent('tpl-use', { detail: def, bubbles: true }));
      });
      this.querySelector('[data-act="edit"]').addEventListener('click', function () {
        self.dispatchEvent(new CustomEvent('tpl-edit', { detail: def, bubbles: true }));
      });
    }
  }
  customElements.define('template-card', TemplateCard);
})();
