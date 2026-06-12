/* ============================================================
   <line-items-editor> — editable invoice line items table.
   Set `.items` (array) and `.currency`; listen for 'items-change'
   (event.detail = updated items array).
   ============================================================ */
(function () {
  var STYLE = '\
  line-items-editor { display: block; }\
  line-items-editor table { width: 100%; border-collapse: collapse; }\
  line-items-editor th { text-align: left; font-size: .74rem; text-transform: uppercase; letter-spacing: .04em; color: var(--text-faint); padding: 6px 8px; font-weight: 600; }\
  line-items-editor td { padding: 4px 6px; vertical-align: middle; }\
  line-items-editor .li-input { width: 100%; border: 1px solid transparent; background: transparent; padding: 7px 8px; border-radius: 6px; font-size: .9rem; font-family: inherit; color: var(--text); }\
  line-items-editor .li-input:hover { border-color: var(--border); }\
  line-items-editor .li-input:focus { outline: none; border-color: var(--brand); background: var(--surface); box-shadow: 0 0 0 2px var(--brand-soft); }\
  line-items-editor .num { text-align: right; }\
  line-items-editor .amount { text-align: right; font-weight: 600; padding-right: 8px; white-space: nowrap; }\
  line-items-editor .col-qty { width: 90px; } line-items-editor .col-rate { width: 120px; } line-items-editor .col-amt { width: 120px; } line-items-editor .col-x { width: 38px; }\
  line-items-editor .li-remove { border: none; background: transparent; color: var(--text-faint); cursor: pointer; padding: 6px; border-radius: 6px; }\
  line-items-editor .li-remove:hover { color: var(--danger); background: var(--danger-soft); }\
  line-items-editor .li-add { margin-top: 8px; }';

  class LineItemsEditor extends HTMLElement {
    set items(v) { this._items = (v || []).map(function (i) { return Object.assign({}, i); }); this.render(); }
    get items() { return this._items || []; }
    set currency(c) { this._currency = c; this.render(); }

    connectedCallback() {
      if (!document.getElementById('line-items-style')) {
        var s = document.createElement('style');
        s.id = 'line-items-style';
        s.textContent = STYLE;
        document.head.appendChild(s);
      }
      if (!this._items) this._items = [];
      this.render();
    }

    emitChange() {
      this.dispatchEvent(new CustomEvent('items-change', { detail: this.items, bubbles: true }));
    }

    render() {
      if (!this.isConnected && !this._items) return;
      var self = this;
      var cur = this._currency || 'USD';

      var rows = this._items.map(function (li, idx) {
        var amount = (Number(li.qty) || 0) * (Number(li.rate) || 0);
        return '\
          <tr data-idx="' + idx + '">\
            <td><input class="li-input" data-f="description" placeholder="item description" value="' + App.util.escapeHtml(li.description) + '"></td>\
            <td class="col-qty"><input class="li-input num" data-f="qty" type="number" min="0" step="any" placeholder="qty" value="' + App.util.escapeHtml(li.qty) + '"></td>\
            <td class="col-rate"><input class="li-input num" data-f="rate" type="number" min="0" step="any" placeholder="rate" value="' + App.util.escapeHtml(li.rate) + '"></td>\
            <td class="col-amt amount js-amount">' + App.util.formatMoney(amount, cur) + '</td>\
            <td class="col-x"><button class="li-remove" title="Remove row"><i class="bi bi-x-lg"></i></button></td>\
          </tr>';
      }).join('');

      this.innerHTML = '\
        <table>\
          <thead><tr>\
            <th>Description</th><th class="col-qty num" style="text-align:right">Qty</th>\
            <th class="col-rate num" style="text-align:right">Rate</th>\
            <th class="col-amt num" style="text-align:right">Amount</th><th class="col-x"></th>\
          </tr></thead>\
          <tbody>' + rows + '</tbody>\
        </table>\
        <button class="btn btn-secondary btn-sm li-add"><i class="bi bi-plus-lg"></i> Add line item</button>';

      // Input handlers.
      this.querySelectorAll('tbody tr').forEach(function (tr) {
        var idx = Number(tr.getAttribute('data-idx'));
        tr.querySelectorAll('.li-input').forEach(function (input) {
          input.addEventListener('input', function () {
            var f = input.getAttribute('data-f');
            self._items[idx][f] = (f === 'qty' || f === 'rate') ? input.value : input.value;
            var amt = (Number(self._items[idx].qty) || 0) * (Number(self._items[idx].rate) || 0);
            tr.querySelector('.js-amount').textContent = App.util.formatMoney(amt, cur);
            self.emitChange();
          });
        });
        tr.querySelector('.li-remove').addEventListener('click', function () {
          self._items.splice(idx, 1);
          self.render();
          self.emitChange();
        });
      });

      this.querySelector('.li-add').addEventListener('click', function () {
        self._items.push(App.invoiceModel.blankLineItem());
        self.render();
        self.emitChange();
      });
    }
  }
  customElements.define('line-items-editor', LineItemsEditor);
})();
