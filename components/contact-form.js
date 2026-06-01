/* ============================================================
   <contact-form> — shared form for Client and Business editors
   Methods:
     setData(obj) -> populate fields
     getData() -> return object with fields + logo
     validate() -> { valid, message, errors }
   Usage: <contact-form id="contact-form" data-entity="client"></contact-form>
  ============================================================ */
(function () {
  var REQUIRED_FIELDS = ['name'];

  var DEFAULT_DATA = {
    name: '',
    contactName: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    taxId: '',
    notes: '',
    logo: ''
  };

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  class ContactForm extends HTMLElement {
    connectedCallback() {
      if (this._init) return;
      this.innerHTML = '\
        <form class="card card-pad record-form contact-form-inner" novalidate>\
          <div class="field">\
            <label>Logo <span class="field-optional">(optional)</span></label>\
            <div class="logo-field">\
              <img class="logo-preview" alt="Logo preview" style="display:none">\
              <div class="logo-controls">\
                <input type="file" accept="image/*" class="contact-logo-input">\
                <button class="btn btn-ghost btn-sm contact-remove-logo" type="button" style="display:none">Remove</button>\
              </div>\
            </div>\
          </div>\
          <div class="field" data-wrap="name">\
            <label>Name <span class="field-required" aria-hidden="true">*</span></label>\
            <input class="input" data-field="name" autocomplete="organization">\
            <p class="field-error" data-error="name" hidden></p>\
          </div>\
          <div class="field" data-wrap="contactName">\
            <label>Contact person <span class="field-optional">(optional)</span></label>\
            <input class="input" data-field="contactName" autocomplete="name">\
          </div>\
          <div class="field-row">\
            <div class="field" data-wrap="email">\
              <label>Email <span class="field-optional">(optional)</span></label>\
              <input class="input" type="email" data-field="email" autocomplete="email">\
              <p class="field-error" data-error="email" hidden></p>\
            </div>\
            <div class="field" data-wrap="phone">\
              <label>Phone <span class="field-optional">(optional)</span></label>\
              <input class="input" type="tel" data-field="phone" autocomplete="tel">\
            </div>\
          </div>\
          <div class="field" data-wrap="website">\
            <label>Website <span class="field-optional">(optional)</span></label>\
            <input class="input" type="url" data-field="website" placeholder="https://example.com" autocomplete="url">\
            <p class="field-error" data-error="website" hidden></p>\
          </div>\
          <div class="field" data-wrap="address">\
            <label>Address <span class="field-optional">(optional)</span></label>\
            <textarea class="textarea" data-field="address" autocomplete="street-address"></textarea>\
          </div>\
          <div class="field" data-wrap="taxId">\
            <label>Tax ID / VAT number <span class="field-optional">(optional)</span></label>\
            <input class="input" data-field="taxId">\
          </div>\
          <div class="field" data-wrap="notes">\
            <label>Notes <span class="field-optional">(optional)</span></label>\
            <textarea class="textarea" data-field="notes" placeholder="Internal notes — not shown on invoices"></textarea>\
          </div>\
          <p class="form-required-note">Fields marked with <span class="field-required">*</span> are required.</p>\
        </form>';

      this._form = this.querySelector('form');
      this._fields = Array.prototype.slice.call(this.querySelectorAll('[data-field]'));
      this._logoInput = this.querySelector('.contact-logo-input');
      this._logoPreview = this.querySelector('.logo-preview');
      this._removeBtn = this.querySelector('.contact-remove-logo');
      this._data = Object.assign({}, DEFAULT_DATA);

      var self = this;
      this._logoInput.addEventListener('change', function (e) {
        var f = (e.target.files && e.target.files[0]) || null;
        if (!f) return;
        if (f.size > 1024 * 1024) App && App.toast && App.toast('Large image - consider a smaller logo', 'info');
        var reader = new FileReader();
        reader.onload = function () {
          self._data = self._data || {};
          self._data.logo = reader.result;
          self._updatePreview();
        };
        reader.readAsDataURL(f);
        e.target.value = '';
      });

      this._removeBtn.addEventListener('click', function () {
        self._data = self._data || {};
        self._data.logo = '';
        self._updatePreview();
      });

      this._fields.forEach(function (input) {
        input.addEventListener('input', function () {
          self._clearFieldError(input.getAttribute('data-field'));
        });
        input.addEventListener('blur', function () {
          self._validateField(input.getAttribute('data-field'), true);
        });
      });

      this._form.addEventListener('submit', function (e) { e.preventDefault(); });

      this._init = true;
      if (this._pendingData) { this.setData(this._pendingData); delete this._pendingData; }
    }

    _fieldWrap(key) {
      return this.querySelector('[data-wrap="' + key + '"]');
    }

    _setFieldError(key, message) {
      var wrap = this._fieldWrap(key);
      if (!wrap) return;
      var err = wrap.querySelector('[data-error="' + key + '"]');
      wrap.classList.toggle('field-invalid', !!message);
      if (err) {
        err.textContent = message || '';
        err.hidden = !message;
      }
    }

    _clearFieldError(key) {
      this._setFieldError(key, '');
    }

    _validateField(key, soft) {
      var input = this.querySelector('[data-field="' + key + '"]');
      if (!input) return true;
      var value = (input.value || '').trim();
      var required = REQUIRED_FIELDS.indexOf(key) >= 0;

      if (required && !value) {
        if (!soft) this._setFieldError(key, 'This field is required.');
        return false;
      }

      if (key === 'email' && value && !isValidEmail(value)) {
        this._setFieldError(key, 'Enter a valid email address.');
        return false;
      }

      if (key === 'website' && value && !/^https?:\/\/.+/i.test(value)) {
        this._setFieldError(key, 'Enter a valid URL starting with http:// or https://');
        return false;
      }

      this._clearFieldError(key);
      return true;
    }

    _updatePreview() {
      if (this._data && this._data.logo) {
        this._logoPreview.src = this._data.logo;
        this._logoPreview.style.display = '';
        this._removeBtn.style.display = '';
      } else {
        this._logoPreview.src = '';
        this._logoPreview.style.display = 'none';
        this._removeBtn.style.display = 'none';
      }
    }

    setData(obj) {
      if (!this._init) { this._pendingData = obj || {}; return; }
      this._data = Object.assign({}, DEFAULT_DATA, obj || {});
      var self = this;
      this._fields.forEach(function (input) {
        var key = input.getAttribute('data-field');
        input.value = self._data[key] || '';
      });
      this._fields.forEach(function (input) {
        self._clearFieldError(input.getAttribute('data-field'));
      });
      this._updatePreview();
    }

    getData() {
      var out = Object.assign({}, this._data || {}, DEFAULT_DATA);
      this._fields.forEach(function (input) {
        var k = input.getAttribute('data-field');
        out[k] = (input.value || '').trim();
      });
      return out;
    }

    validate() {
      var errors = [];
      var self = this;

      REQUIRED_FIELDS.forEach(function (key) {
        if (!self._validateField(key, false)) {
          errors.push({ field: key, message: 'Name is required.' });
        }
      });

      ['email', 'website'].forEach(function (key) {
        if (errors.every(function (e) { return e.field !== key; })) {
          if (!self._validateField(key, false)) {
            errors.push({ field: key, message: 'Invalid ' + key + '.' });
          }
        }
      });

      if (errors.length) {
        var first = this.querySelector('[data-field="' + errors[0].field + '"]');
        if (first) first.focus();
        return {
          valid: false,
          message: errors.length === 1 ? errors[0].message : 'Please fix the highlighted fields.',
          errors: errors
        };
      }

      return { valid: true, message: '', errors: [] };
    }
  }

  customElements.define('contact-form', ContactForm);
})();
