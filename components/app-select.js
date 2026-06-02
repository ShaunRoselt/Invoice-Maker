/* ============================================================
   <app-select> — custom dropdown facade for native <select>.

   Use App.selects.enhance(root) to upgrade existing select.select
   controls while preserving their value, disabled state, and events.
   ============================================================ */
(function () {
  var STYLE = '\
    :host { display: block; position: relative; width: 100%; font-family: inherit; }\
    :host([data-inline]) { display: inline-block; width: auto; min-width: 0; vertical-align: middle; }\
    .app-select-trigger { width: 100%; min-height: 40px; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 11px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font: inherit; font-size: .92rem; line-height: 1.2; text-align: left; cursor: pointer; transition: border-color .12s, box-shadow .12s, background .12s; }\
    .app-select-trigger:hover { background: var(--surface-hover); }\
    .app-select-trigger:focus { outline: none; border-color: var(--focus-border); box-shadow: 0 0 0 3px var(--focus-glow); }\
    .app-select-trigger[disabled] { cursor: not-allowed; opacity: .62; }\
    .app-select-left { display:flex; align-items:center; gap:6px; color:var(--text-muted); flex:0 0 auto; padding: 4px 8px; border-right: 1px solid var(--border-strong); border-radius: 6px; margin-right: 6px; background: var(--surface-2); }\
    .app-select-left i { font-size:.95rem; color:var(--text-muted); }\
    .app-select-label-text { font-weight:600; color:var(--text-muted); font-size:.85rem; white-space:nowrap; }\
    .app-select-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex:0 1 auto; min-width:0; font-weight:500; }\
    .app-select-caret { flex: 0 0 auto; color: var(--text-muted); font-size: .72rem; line-height: 1; margin-left: 8px; transition: transform .15s; }\
    /* Panel itself should allow visible overflow; inner options list handles scrolling */\
    .app-select-panel { position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 2600; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); box-shadow: var(--shadow); padding: 6px; max-height: none; overflow: visible; }\
    .app-select-search { width: 100%; min-height: 34px; margin: 0 0 6px; padding: 7px 10px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text); font: inherit; font-size: .86rem; outline: none; transition: border-color .12s, box-shadow .12s; }\
    .app-select-search:focus { border-color: var(--focus-border); box-shadow: 0 0 0 3px var(--focus-glow); }\
    .app-select-search::placeholder { color: var(--text-faint); }\
    /* Options list - use a thin themed scrollbar instead of hiding native scrollbars */\
    .app-select-options { max-height: none; overflow-y: auto; scrollbar-width: thin; -ms-overflow-style: auto; }\
    /* WebKit-based browsers */\
    .app-select-options::-webkit-scrollbar { width: 10px; }\
    .app-select-options::-webkit-scrollbar-track { background: transparent; border-radius: 8px; }\
    .app-select-options::-webkit-scrollbar-thumb { background: rgba(0,0,0,.18); border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }\
    .app-select-options::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,.28); }\
    /* Firefox */\
    .app-select-options { scrollbar-color: rgba(0,0,0,.18) transparent; }\
    /* Dark theme tweaks */\
    :host-context([data-theme="dark"]) .app-select-options::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); }\
    :host-context([data-theme="dark"]) .app-select-options::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.14); }\
    :host-context([data-theme="dark"]) .app-select-options { scrollbar-color: rgba(255,255,255,.08) transparent; }\
    .app-select-option { min-height: 34px; display: flex; align-items: center; gap:10px; padding: 8px 12px; border-radius: var(--radius-sm); color: var(--text); font-size: .9rem; cursor: pointer; user-select: none; transition: background .12s, color .12s; }\
    .app-select-option:hover, .app-select-option[aria-selected="true"] { background: var(--surface-hover); }\
    .app-select-dot { width:10px; height:10px; border-radius:50%; display:inline-block; flex:0 0 auto; margin-right:6px; }\
    .app-select-empty { padding: 14px 15px; color: var(--text-muted); font-size: .88rem; text-align:center; }\
    [hidden] { display: none !important; }\
    :host([open]) .app-select-caret { transform: rotate(180deg); }\
    :host-context([data-theme="dark"]) .app-select-trigger { background: var(--surface-hover); border-color: var(--border); }\
    :host-context([data-theme="dark"]) .app-select-trigger:hover { background: rgba(255,255,255,.08); }\
    :host-context([data-theme="dark"]) .app-select-panel { background: #202128; border-color: var(--border); box-shadow: 0 18px 44px rgba(0,0,0,.48); }\
    :host-context([data-theme="dark"]) .app-select-left { background: rgba(255,255,255,.05); border-color: var(--border); }\
    :host-context([data-theme="dark"]) .app-select-search { background: rgba(255,255,255,.04); border-color: var(--border); }\
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
      var display = optionText(selected) || this.getAttribute('placeholder') || 'Select...';
      if (selected && this._select && this._select.hasAttribute('data-show-currency-symbol') && window.App && App.util && typeof App.util.currencySymbol === 'function') {
        var sym = App.util.currencySymbol(selected.value || optionText(selected));
        if (sym) display = sym + ' ' + display;
      }
      this._valueEl.textContent = display;
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

      // Show panel so it can be measured, then position it fixed to avoid
      // clipping when inside scrollable/overflowing containers (eg sidebar).
      this._panel.hidden = false;
      // compute trigger position relative to viewport
      var rect = this._trigger.getBoundingClientRect();
      var vw = window.innerWidth || document.documentElement.clientWidth;
      var vh = window.innerHeight || document.documentElement.clientHeight;

      // Temporarily move the panel offscreen to measure its intrinsic width
      // (accounts for search input, dots, labels, etc.). Then clamp to viewport.
      this._panel.style.position = 'fixed';
      this._panel.style.left = '-9999px';
      this._panel.style.top = '-9999px';
      this._panel.style.right = 'auto';
      this._panel.style.bottom = 'auto';
      this._panel.style.width = 'auto';
      this._panel.style.maxHeight = '';
      if (this._optionsEl) this._optionsEl.style.maxHeight = '';

      // Force layout and measure
      var requiredWidth = Math.ceil(this._panel.getBoundingClientRect().width) || 0;

      // Also ensure we account for the widest child (search input / options)
      try {
        var childMax = 0;
        this._panel.querySelectorAll('.app-select-option, .app-select-search, .app-select-empty').forEach(function (c) {
          var w = Math.ceil(c.scrollWidth || c.getBoundingClientRect().width || 0);
          if (w > childMax) childMax = w;
        });
        if (childMax > requiredWidth) requiredWidth = childMax + 16; // small padding
      } catch (e) { /* ignore measurement errors */ }

      // Ensure it's at least as wide as the trigger
      if (requiredWidth < rect.width) requiredWidth = Math.ceil(rect.width);

      // Don't exceed viewport with small margin
      var margin = 8;
      var maxAllowed = Math.max(120, vw - (margin * 2));
      if (requiredWidth > maxAllowed) requiredWidth = maxAllowed;

      // Set final width and compute left clamped to viewport
      this._panel.style.width = requiredWidth + 'px';
      var left = rect.left;
      if (left + requiredWidth > vw - margin) left = Math.max(margin, vw - requiredWidth - margin);
      if (left < margin) left = margin;
      this._panel.style.left = left + 'px';

      // Decide whether to open below or above depending on available space
      var spaceBelow = Math.max(0, vh - rect.bottom - 8);
      var spaceAbove = Math.max(0, rect.top - 8);
      if (spaceBelow >= spaceAbove) {
        // open below — constrain the inner options list
        this._panel.style.top = (rect.bottom + 6) + 'px';
        this._panel.style.bottom = 'auto';
        if (this._optionsEl) this._optionsEl.style.maxHeight = Math.max(80, spaceBelow - 12) + 'px';
      } else {
        // open above — constrain the inner options list
        this._panel.style.top = 'auto';
        this._panel.style.bottom = (vh - rect.top + 6) + 'px';
        if (this._optionsEl) this._optionsEl.style.maxHeight = Math.max(80, spaceAbove - 12) + 'px';
      }

      this.setAttribute('open', '');
      this._trigger.setAttribute('aria-expanded', 'true');
      document.addEventListener('pointerdown', this._onDocumentPointerDown);
      setTimeout(() => this._search.focus(), 0);
    }

    close() {
      if (!this._rendered) return;
      this._panel.hidden = true;
      this.removeAttribute('open');
      this._trigger.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', this._onDocumentPointerDown);

      // Clear any positioning styles applied when opened
      this._panel.style.position = '';
      this._panel.style.left = '';
      this._panel.style.top = '';
      this._panel.style.bottom = '';
      this._panel.style.right = '';
      this._panel.style.width = '';
      this._panel.style.maxHeight = '';
      if (this._optionsEl) this._optionsEl.style.maxHeight = '';
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
        var displayText = text;
        if (this._select && this._select.hasAttribute('data-show-currency-symbol') && window.App && App.util && typeof App.util.currencySymbol === 'function') {
          var sym = App.util.currencySymbol(option.value || text);
          if (sym) displayText = sym + ' ' + text;
        }
        var dot = '';
        if (option.value && colorMap[option.value]) dot = '<span class="app-select-dot" style="background:' + colorMap[option.value] + '"></span>';
        html += '<div class="app-select-option" role="option" tabindex="-1" data-value="' + App.util.escapeHtml(option.value) + '" aria-selected="' + (option.selected ? 'true' : 'false') + '">' + dot + App.util.escapeHtml(displayText) + '</div>';
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
