/* ============================================================
   Page: 404 — make the nav links use the router.
   ============================================================ */
App.pages.register('404', (function () {
  function mount(root) {
    root.querySelectorAll('[data-link]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        App.router.navigate({ page: a.getAttribute('data-link') });
      });
    });
  }
  return { mount: mount };
})());
