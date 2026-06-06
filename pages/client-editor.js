/* ============================================================
   Page: client-editor — add/edit one client
   ============================================================ */
App.pages.register('client-editor', (function () {
  var rootEl = null;
  var client = null;

  function displayName(c) { return c.name || c.contactName || 'Unnamed client'; }

  function confirmDelete(currentClient) {
    var dialogEl = document.querySelector('app-dialog');
    if (!dialogEl || typeof dialogEl.confirm !== 'function') return Promise.resolve(false);
    return dialogEl.confirm('Delete client ' + displayName(currentClient) + '?', {
      title: 'Confirm deletion',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true
    });
  }

  function writeForm() {
    rootEl.querySelector('#client-editor-title').textContent = client.createdAt ? 'Edit client' : 'New client';
    rootEl.querySelector('[data-act="delete"]').style.display = client.createdAt ? '' : 'none';
    var form = rootEl.querySelector('#contact-form');
    if (!form || typeof form.setData !== 'function') return;
    App.store.ensureContactLogo(client, 'client').then(function (hydrated) {
      client = hydrated;
      form.setData(client);
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
    client = Object.assign(client || {}, data);
    App.store.saveClient(client).then(function () {
      App.toast('Client saved', 'success');
      App.router.navigate({ page: 'clients' });
    }).catch(function (err) {
      App.toast((err && err.message) || 'Could not save client', 'error');
    });
  }

  function mount(root, params) {
    rootEl = root;
    client = params.id ? App.store.getClient(params.id) : null;
    if (!client) client = App.store.emptyClient();
    writeForm();

    var backBtn = root.querySelector('[data-act="back"]');
    if (backBtn) backBtn.addEventListener('click', function () { App.router.navigate({ page: 'clients' }); });
    root.querySelector('[data-act="save"]').addEventListener('click', save);
    var del = root.querySelector('[data-act="delete"]');
    if (del) del.addEventListener('click', function () {
      if (!client.createdAt) return;
      confirmDelete(client).then(function (confirmed) {
        if (!confirmed) return;
        App.store.deleteClient(client.id).then(function () {
          App.toast('Client deleted', 'info');
          App.router.navigate({ page: 'clients' });
        }).catch(function (err) {
          App.toast((err && err.message) || 'Could not delete client', 'error');
        });
      });
    });
  }

  function unmount() { rootEl = null; client = null; }

  return { mount: mount, unmount: unmount };
})());
