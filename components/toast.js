/* ============================================================
   <im-toast> — lightweight notification host.
   Trigger via: App.bus.emit('toast', { type:'success', message:'Saved' })
   or App.toast('Saved', 'success').
   ============================================================ */
(function () {
  var STYLE = '\
  im-toast { position: fixed; bottom: 22px; right: 22px; z-index: 1000; display: flex; flex-direction: column; gap: 10px; pointer-events: none; }\
  im-toast .toast { pointer-events: auto; min-width: 220px; max-width: 360px; background: #1e293b; color: #fff; padding: 12px 16px; border-radius: 10px; box-shadow: 0 8px 28px rgba(15,23,42,.28); display: flex; align-items: center; gap: 10px; font-size: .9rem; font-weight: 500; opacity: 0; transform: translateY(8px); transition: opacity .18s, transform .18s; }\
  im-toast .toast.show { opacity: 1; transform: translateY(0); }\
  im-toast .toast i { font-size: 1.15rem; flex-shrink: 0; }\
  im-toast .toast.success { background: #16a34a; }\
  im-toast .toast.error { background: #dc2626; }\
  im-toast .toast.info { background: #334155; }';

  var ICONS = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill' };

  class ImToast extends HTMLElement {
    connectedCallback() {
      if (!document.getElementById('im-toast-style')) {
        var s = document.createElement('style');
        s.id = 'im-toast-style';
        s.textContent = STYLE;
        document.head.appendChild(s);
      }
      var self = this;
      App.bus.on('toast', function (payload) { self.show(payload); });
    }

    show(payload) {
      var type = payload.type || 'info';
      var node = document.createElement('div');
      node.className = 'toast ' + type;
      node.innerHTML = '<i class="bi ' + (ICONS[type] || ICONS.info) + '"></i><span></span>';
      node.querySelector('span').textContent = payload.message || '';
      this.appendChild(node);
      requestAnimationFrame(function () { node.classList.add('show'); });
      setTimeout(function () {
        node.classList.remove('show');
        setTimeout(function () { node.remove(); }, 220);
      }, payload.duration || 2600);
    }
  }

  customElements.define('im-toast', ImToast);

  // Convenience helper.
  App.toast = function (message, type) {
    App.bus.emit('toast', { message: message, type: type || 'info' });
  };
})();
