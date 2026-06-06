/* ============================================================
   Page: business-editor — add/edit one sender business
   ============================================================ */
App.pages.register('business-editor', (function () {
  var rootEl = null;
  var business = null;

  function displayName(b) { return b.name || 'Unnamed business'; }

  function confirmDelete(currentBusiness) {
    var dialogEl = document.querySelector('app-dialog');
    if (!dialogEl || typeof dialogEl.confirm !== 'function') return Promise.resolve(false);
    return dialogEl.confirm('Delete business ' + displayName(currentBusiness) + '?', {
      title: 'Confirm deletion',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true
    });
  }

  function writeForm() {
    rootEl.querySelector('#business-editor-title').textContent = business.createdAt ? 'Edit business' : 'New business';
    rootEl.querySelector('[data-act="delete"]').style.display = business.createdAt ? '' : 'none';
    var form = rootEl.querySelector('#contact-form');
    if (!form || typeof form.setData !== 'function') return;
    App.store.ensureContactLogo(business, 'business').then(function (hydrated) {
      business = hydrated;
      form.setData(business);
    });
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
    App.store.saveBusiness(business).then(function () {
      App.toast('Business saved', 'success');
      App.router.navigate({ page: 'businesses' });
    }).catch(function (err) {
      App.toast((err && err.message) || 'Could not save business', 'error');
    });
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
      confirmDelete(business).then(function (confirmed) {
        if (!confirmed) return;
        App.store.deleteBusiness(business.id).then(function () {
          App.toast('Business deleted', 'info');
          App.router.navigate({ page: 'businesses' });
        }).catch(function (err) {
          App.toast((err && err.message) || 'Could not delete business', 'error');
        });
      });
    });
  }

  function unmount() { rootEl = null; business = null; }

  return { mount: mount, unmount: unmount };
})());
