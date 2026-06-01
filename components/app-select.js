/* ============================================================
   <app-select> — custom dropdown facade for native <select>.

   Use App.selects.enhance(root) to upgrade existing select.select
   controls while preserving their value, disabled state, and events.
   ============================================================ */
(function () {
  var STYLE = '\
    :host { display: block; position: relative; width: 100%; font-family: inherit; }\
    :host([data-inline]) { display: inline-block; width: auto; min-width: 150px; vertical-align: middle; }\
    .app-select-trigger { width: 100%; min-height: 40px; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; border: 1px solid var(--border-strong); border-radius: 0; background: var(--surface-2); color: var(--text); font: inherit; font-size: .92rem; line-height: 1.2; text-align: left; cursor: pointer; transition: border-color .12s, box-shadow .12s, background .12s; }\
    .app-select-trigger:hover { background: color-mix(in srgb, var(--surface-2) 94%, var(--text) 6%); }\
    .app-select-trigger:focus { outline: none; border-color: var(--focus-border); box-shadow: 0 0 0 3px var(--focus-glow); }\
    .app-select-trigger[disabled] { cursor: not-allowed; opacity: .62; }\
    .app-select-left { display:flex; align-items:center; gap:8px; color:var(--text-muted); flex:0 0 auto; padding: 7px 10px; border-right: 1px solid rgba(255,255,255,.08); border-radius: 0; margin-right: 8px; background: rgba(255,255,255,.03); }\
    .app-select-left i { font-size:1rem; color:var(--text-muted); }\
    .app-select-label-text { font-weight:600; color:var(--text-muted); font-size:.9rem; white-space:nowrap; }\
    .app-select-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex:1 1 auto; min-width:0; }\
    .app-select-caret { flex: 0 0 auto; color: var(--text-muted); font-size: .78rem; line-height: 1; margin-left: 8px; }\
    .app-select-panel { position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 2600; border: 1px solid var(--border); border-radius: 0; background: var(--surface); color: var(--text); box-shadow: var(--shadow); padding: 6px; max-height: none; overflow: visible; }\
    .app-select-search { width: 100%; min-height: 32px; margin: 0 0 5px; padding: 7px 10px; border: 1px solid var(--focus-border); border-radius: 7px; background: var(--surface); color: var(--text); font: inherit; font-size: .86rem; outline: none; box-shadow: 0 0 0 2px var(--focus-glow); }\
    .app-select-search::placeholder { color: var(--text-faint); }\
    .app-select-options { max-height: none; overflow-y: visible; scrollbar-width: none; -ms-overflow-style: none; }\
    .app-select-options::-webkit-scrollbar { display: none; }\
    .app-select-option { min-height: 34px; display: flex; align-items: center; gap:10px; padding: 10px 14px; border-radius: 0; color: var(--text); font-size: .9rem; cursor: pointer; user-select: none; transition: background .12s; }\
    .app-select-option:hover, .app-select-option[aria-selected="true"] { background: var(--surface-hover); }\
    .app-select-dot { width:10px; height:10px; border-radius:50%; display:inline-block; flex:0 0 auto; margin-right:6px; }\
    .app-select-empty { padding: 14px 15px; color: var(--text-muted); font-size: .88rem; }\
    [hidden] { display: none !important; }\
    :host-context([data-theme="dark"]) .app-select-trigger { background: var(--surface-hover); border-color: var(--border); }\
    :host-context([data-theme="dark"]) .app-select-panel { background: #202128; border-color: var(--border); box-shadow: 0 18px 44px rgba(0,0,0,.48); }\
    :host-context([data-theme="dark"]) .app-select-search { background: #1f2027; }\
  ';

  function optionText(option) {
    return option ? (option.textContent || '').trim() : '';
  }

  class AppSelect extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._onDocumentPointerDown = this._onDocumentPointerDown.bind(this);
    }

    connectedCallback() {
      if (this._rendered) return;
      this.shadowRoot.innerHTML = '<style>' + STYLE + '</style>' +
        '<button class="app-select-trigger" type="button" role="combobox" aria-expanded="false">' +
          '<span class="app-select-left" hidden><i class="bi bi-filter" aria-hidden="true"></i><span class="app-select-label-text"></span></span>' +
          '<span class="app-select-value"></span><span class="app-select-caret" aria-hidden="true">▾</span>' +
        '</button>' +
        '<div class="app-select-panel" hidden>' +
          '<input class="app-select-search" type="search" autocomplete="off">' +
          '<div class="app-select-options" role="listbox"></div>' +
        '</div>';
      this._trigger = this.shadowRoot.querySelector('.app-select-trigger');
      this._left = this.shadowRoot.querySelector('.app-select-left');
      this._labelText = this.shadowRoot.querySelector('.app-select-label-text');
      this._valueEl = this.shadowRoot.querySelector('.app-select-value');
      this._panel = this.shadowRoot.querySelector('.app-select-panel');
      this._search = this.shadowRoot.querySelector('.app-select-search');
      this._optionsEl = this.shadowRoot.querySelector('.app-select-options');
      this._trigger.addEventListener('click', () => this.toggle());
      this._trigger.addEventListener('keydown', (e) => this._onTriggerKeydown(e));
      this._search.addEventListener('input', () => this._renderOptions(this._search.value));
      this._search.addEventListener('keydown', (e) => this._onSearchKeydown(e));
      this._rendered = true;
      this.sync();
    }

    attachSelect(select) {
      this._select = select;
      select.hidden = true;
      select.setAttribute('data-app-select-enhanced', 'true');
      if (select.id && !this.id) this.id = select.id + '-control';
      if (select.style && select.style.width === 'auto') this.setAttribute('data-inline', '');
      this._selectChange = () => this.sync();
      select.addEventListener('change', this._selectChange);
      this._observer = new MutationObserver(() => this.sync());
      this._observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'selected', 'value', 'label'] });
      this.sync();
    }

    disconnectedCallback() {
      document.removeEventListener('pointerdown', this._onDocumentPointerDown);
      if (this._select && this._selectChange) this._select.removeEventListener('change', this._selectChange);
      if (this._observer) this._observer.disconnect();
    }

    get value() { return this._select ? this._select.value : ''; }
    set value(v) {
      if (!this._select) return;
      this._select.value = v;
      this.sync();
    }

    sync() {
      if (!this._rendered || !this._select) return;
      var selected = this._select.options[this._select.selectedIndex];
      this._valueEl.textContent = optionText(selected) || this.getAttribute('placeholder') || 'Select...';
      // label (left) support: host attribute `data-label` or `label`
      var lbl = this.getAttribute('data-label') || this.getAttribute('label') || '';
      if (lbl && this._left) {
        this._labelText.textContent = lbl;
        this._left.hidden = false;
      } else if (this._left) {
        this._left.hidden = true;
      }
      this._trigger.disabled = this._select.disabled;
      if (this._select.disabled) this.close();
      if (!this._panel.hidden) this._renderOptions(this._search.value);
    }

    open() {
      if (!this._select || this._select.disabled || !this._panel.hidden) return;
      this._search.value = '';
      this._search.placeholder = this._select.getAttribute('data-search-placeholder') || 'Search options';
      this._renderOptions('');
      this._panel.hidden = false;
      this._trigger.setAttribute('aria-expanded', 'true');
      document.addEventListener('pointerdown', this._onDocumentPointerDown);
      setTimeout(() => this._search.focus(), 0);
    }

    close() {
      if (!this._rendered) return;
      this._panel.hidden = true;
      this._trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', this._onDocumentPointerDown);
    }

    toggle() {
      if (this._panel.hidden) this.open();
      else this.close();
    }

    _renderOptions(query) {
      var q = (query || '').trim().toLowerCase();
      var html = '';
      var colorMap = { draft: '#6b7280', sent: '#2563eb', paid: '#16a34a', overdue: '#dc2626', outstanding: '#f59e0b' };
      Array.prototype.forEach.call(this._select.options, (option) => {
        var text = optionText(option);
        if (q && text.toLowerCase().indexOf(q) === -1 && String(option.value).toLowerCase().indexOf(q) === -1) return;
        var dot = '';
        if (option.value && colorMap[option.value]) dot = '<span class="app-select-dot" style="background:' + colorMap[option.value] + '"></span>';
        html += '<div class="app-select-option" role="option" tabindex="-1" data-value="' + App.util.escapeHtml(option.value) + '" aria-selected="' + (option.selected ? 'true' : 'false') + '">' + dot + App.util.escapeHtml(text) + '</div>';
      });
      this._optionsEl.innerHTML = html || '<div class="app-select-empty">No matches</div>';
      this._optionsEl.querySelectorAll('.app-select-option').forEach((item) => {
        item.addEventListener('click', () => this._choose(item.getAttribute('data-value')));
        item.addEventListener('keydown', (e) => this._onOptionKeydown(e, item));
      });
      var active = this._optionsEl.querySelector('[aria-selected="true"]');
      if (active) active.scrollIntoView({ block: 'nearest' });
    }

    _choose(value) {
      if (!this._select || this._select.value === value) {
        this.close();
        this._trigger.focus();
        return;
      }
      this._select.value = value;
      this.sync();
      this._select.dispatchEvent(new Event('input', { bubbles: true }));
      this._select.dispatchEvent(new Event('change', { bubbles: true }));
      this.close();
      this._trigger.focus();
    }

    _onDocumentPointerDown(e) {
      if (e.composedPath && e.composedPath().indexOf(this) !== -1) return;
      this.close();
    }

    _onTriggerKeydown(e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.open();
      }
    }

    _onSearchKeydown(e) {
      var options = Array.prototype.slice.call(this._optionsEl.querySelectorAll('.app-select-option'));
      if (e.key === 'Escape') {
        this.close();
        this._trigger.focus();
      } else if (e.key === 'Enter' && options[0]) {
        e.preventDefault();
        this._choose(options[0].getAttribute('data-value'));
      } else if (e.key === 'ArrowDown' && options[0]) {
        e.preventDefault();
        options[0].focus();
      }
    }

    _onOptionKeydown(e, item) {
      var options = Array.prototype.slice.call(this._optionsEl.querySelectorAll('.app-select-option'));
      var index = options.indexOf(item);
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._choose(item.getAttribute('data-value'));
      } else if (e.key === 'Escape') {
        this.close();
        this._trigger.focus();
      } else if (e.key === 'ArrowDown' && options[index + 1]) {
        e.preventDefault();
        options[index + 1].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (options[index - 1]) options[index - 1].focus();
        else this._search.focus();
      }
    }
  }

  customElements.define('app-select', AppSelect);

  window.App = window.App || {};
  App.selects = {
    enhance: function (root) {
      root = root || document;
      root.querySelectorAll('select.select:not([data-app-select-enhanced]):not([data-native-select])').forEach(function (select) {
        var el = document.createElement('app-select');
        select.insertAdjacentElement('afterend', el);
        el.attachSelect(select);
      });
    }
  };
})();
