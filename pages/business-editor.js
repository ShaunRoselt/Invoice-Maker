/* ============================================================
   Page: business-editor — add/edit one sender business
   ============================================================ */
App.pages.register('business-editor', (function () {
  var rootEl = null;
  var business = null;

  function displayName(b) { return b.name || 'Unnamed business'; }

  function writeForm() {
    rootEl.querySelector('#business-editor-title').textContent = business.createdAt ? 'Edit business' : 'New business';
    rootEl.querySelector('[data-act="delete"]').style.display = business.createdAt ? '' : 'none';
    var form = rootEl.querySelector('#contact-form');
    if (form && typeof form.setData === 'function') form.setData(business);
  }

  function save() {
    var form = rootEl.querySelector('#contact-form');
    if (form && typeof form.validate === 'function') {
      var check = form.validate();
      if (!check.valid) {
        App.toast(check.message || 'Please fill in all required fields', 'error');
        return;
      }
    }
    var data = form && typeof form.getData === 'function' ? form.getData() : {};
    business = Object.assign(business || {}, data);
    business = App.store.saveBusiness(business);
    App.toast('Business saved', 'success');
    App.router.navigate({ page: 'businesses' });
  }

  function mount(root, params) {
    rootEl = root;
    business = params.id ? App.store.getBusiness(params.id) : null;
    if (!business) business = App.store.emptyBusiness();
    writeForm();

    var backBtn = root.querySelector('[data-act="back"]');
    if (backBtn) backBtn.addEventListener('click', function () { App.router.navigate({ page: 'businesses' }); });
    root.querySelector('[data-act="save"]').addEventListener('click', save);
    var del = root.querySelector('[data-act="delete"]');
    if (del) del.addEventListener('click', function () {
      if (!business.createdAt) return;
      if (!confirm('Delete business ' + displayName(business) + '?')) return;
      App.store.deleteBusiness(business.id);
      App.toast('Business deleted', 'info');
      App.router.navigate({ page: 'businesses' });
    });
  }

  function unmount() { rootEl = null; business = null; }

  return { mount: mount, unmount: unmount };
})();
