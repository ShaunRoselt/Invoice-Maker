/* ============================================================
   <app-dialog> — reusable dialog wrapper using native <dialog>.
   API:
     window.appDialog(message, opts) -> Promise<boolean>
     document.querySelector('app-dialog').confirm(message, opts) -> Promise<boolean>

   Options: { title, confirmText, cancelText, danger }
   ============================================================ */
(function () {
  var STYLE = [
    'app-dialog dialog { border: none; border-radius: 12px; padding: 0; background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm); width: 520px; max-width: calc(100% - 32px); max-height: calc(100% - 32px); font-family: inherit; position: fixed; inset: 0; margin: auto; transform: none; z-index: 2200; }',
    'app-dialog dialog::backdrop { background: rgba(0,0,0,0.5); backdrop-filter: blur(2px); z-index: 2100; }',
    'app-dialog .dialog-pad { padding: 18px 20px; }',
    'app-dialog .dialog-title { margin: 0 0 6px; font-size: 1.05rem; font-weight: 700; }',
    'app-dialog .dialog-body { margin-bottom: 18px; color: var(--text-muted); }',
    'app-dialog .dialog-actions { display:flex; gap: 8px; justify-content: flex-end; padding: 0 20px 18px; }',
    'app-dialog .btn { min-width: 80px; display: inline-flex; justify-content: center; align-items: center; }',
    'app-dialog .btn-danger { background: #b91c1c; color: white; border-color: transparent; }',
    '@media (max-width:520px){ app-dialog dialog{ width: auto; max-width: calc(100% - 24px); } }'
  ].join('');

  class AppDialog extends HTMLElement {
    connectedCallback() {
      if (!document.getElementById('app-dialog-style')) {
        var s = document.createElement('style');
        s.id = 'app-dialog-style';
        s.textContent = STYLE;
        document.head.appendChild(s);
      }
      if (!this._init) {
        this.innerHTML = [
          '<dialog class="im-dialog" aria-hidden="true">',
          '<form method="dialog">',
          '<div class="dialog-pad">',
          '<h3 class="dialog-title"></h3>',
          '<div class="dialog-body"></div>',
          '</div>',
          '<div class="dialog-actions">',
          '<button value="cancel" class="btn btn-ghost btn-sm cancel">Cancel</button>',
          '<button value="confirm" class="btn btn-danger btn-sm confirm">Delete</button>',
          '</div>',
          '</form>',
          '</dialog>'
        ].join('');
        this._dialog = this.querySelector('dialog');
        this._form = this.querySelector('form');
        this._title = this.querySelector('.dialog-title');
        this._body = this.querySelector('.dialog-body');
        this._confirmBtn = this.querySelector('.confirm');
        this._cancelBtn = this.querySelector('.cancel');
        this._dialog.addEventListener('click', this._handleBackdropClick.bind(this));
        this._init = true;
      }
    }

    _handleBackdropClick(e) {
      if (!this._dialog || !this._dialog.open || !this._form) return;
      var rect = this._form.getBoundingClientRect();
      var inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (!inside) this._dialog.close('cancel');
    }

    confirm(message, opts) {
      opts = opts || {};
      this._title.textContent = opts.title || '';
      this._body.textContent = message || opts.message || '';
      this._confirmBtn.textContent = opts.confirmText || (opts.danger ? 'Delete' : 'OK');
      this._cancelBtn.textContent = opts.cancelText || 'Cancel';
      var self = this;
      return new Promise(function (resolve) {
        function onClose() {
          console.debug('app-dialog: close', self._dialog.returnValue);
          var val = self._dialog.returnValue;
          cleanup();
          resolve(val === 'confirm');
        }
        function cleanup() {
          self._dialog.removeEventListener('close', onClose);
        }
        self._dialog.addEventListener('close', onClose);
        try {
          console.debug('app-dialog: showModal()');
          self._dialog.showModal();
          // focus confirm by default
          setTimeout(function () { try { self._confirmBtn.focus(); } catch (e) { } }, 50);
        } catch (e) {
          cleanup();
          resolve(false);
        }
      });
    }

    open(options) {
      options = options || {};
      this._title.textContent = options.title || '';
      this._body.textContent = options.message || '';
      if (options.confirmText) this._confirmBtn.textContent = options.confirmText;
      if (options.cancelText) this._cancelBtn.textContent = options.cancelText;
      var self = this;
      return new Promise(function (resolve) {
        function onClose() { cleanup(); resolve(self._dialog.returnValue); }
        function cleanup() { self._dialog.removeEventListener('close', onClose); }
        self._dialog.addEventListener('close', onClose);
        try { self._dialog.showModal(); } catch (e) { cleanup(); resolve(null); }
      });
    }
  }

  customElements.define('app-dialog', AppDialog);

  // Global helper
  window.appDialog = function (message, opts) {
    var el = document.querySelector('app-dialog');
    if (!el) {
      el = document.createElement('app-dialog');
      document.body.appendChild(el);
    }
    if (typeof el.confirm !== 'function') return Promise.resolve(false);
    return el.confirm(message, opts);
  };

  // If App exists at load time, attach helper there too.
  if (window.App) window.App.dialog = window.appDialog;
})();
