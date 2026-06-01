/* ============================================================
   routing.js — SPA router driven by the ?page= URL parameter.

   Routes are NOT hardcoded. A route exists if pages/<name>.html
   exists. Each page MAY optionally have pages/<name>.css and
   pages/<name>.js. Page scripts register behaviour via
   App.pages.register(name, { mount, unmount }). Unknown pages
   fall back to pages/404.html.
   ============================================================ */
window.App = window.App || {};

App.pages = (function () {
  var registry = {};
  return {
    register: function (name, def) { registry[name] = def; },
    get: function (name) { return registry[name]; }
  };
})();

App.router = (function () {
  var DEFAULT = 'dashboard';
  var NOT_FOUND = '404';

  var cssLoaded = {};      // name -> true (style injected)
  var jsLoaded = {};       // name -> true (script executed)
  var existence = {};      // "pages/x.ext" -> bool cache
  var current = null;      // { name, def }
  var outlet = null;

  function getParams() {
    var sp = new URLSearchParams(window.location.search);
    var obj = {};
    sp.forEach(function (v, k) { obj[k] = v; });
    return obj;
  }

  function requestedPage() {
    var p = getParams().page;
    return p || DEFAULT;
  }

  function buildUrl(params) {
    var sp = new URLSearchParams();
    Object.keys(params).forEach(function (k) {
      if (params[k] !== null && params[k] !== undefined && params[k] !== '') sp.set(k, params[k]);
    });
    var qs = sp.toString();
    return qs ? '?' + qs : '?';
  }

  function navigate(params, opts) {
    opts = opts || {};
    var url = buildUrl(params);
    if (opts.replace) window.history.replaceState({}, '', url);
    else window.history.pushState({}, '', url);
    render();
  }

  // Fetch a resource if present. Returns text or null (404/error).
  function fetchIfExists(path) {
    return fetch(path, { cache: 'no-cache' }).then(function (res) {
      existence[path] = res.ok;
      return res.ok ? res.text() : null;
    }).catch(function () {
      existence[path] = false;
      return null;
    });
  }

  // Inject (once) a page's optional CSS, fetched as text so a missing
  // file never produces a console 404.
  function ensureCss(name) {
    if (cssLoaded[name]) return Promise.resolve();
    return fetchIfExists('pages/' + name + '.css').then(function (text) {
      cssLoaded[name] = true;
      if (text != null) {
        var style = document.createElement('style');
        style.setAttribute('data-page-css', name);
        style.textContent = text;
        document.head.appendChild(style);
      }
    });
  }

  // Inject (once) a page's optional JS by executing fetched text in the
  // global scope (so it can call App.pages.register without modules).
  function ensureJs(name) {
    if (jsLoaded[name]) return Promise.resolve();
    return fetchIfExists('pages/' + name + '.js').then(function (text) {
      jsLoaded[name] = true;
      if (text != null) {
        var script = document.createElement('script');
        script.setAttribute('data-page-js', name);
        script.textContent = text + '\n//# sourceURL=pages/' + name + '.js';
        document.body.appendChild(script);   // executes synchronously
      }
    });
  }

  function showLoading() {
    outlet.innerHTML = '<div class="route-loading" style="padding:48px;text-align:center;color:var(--text-muted)">' +
      '<i class="bi bi-arrow-repeat spin" style="font-size:1.6rem;display:block;margin-bottom:8px"></i>Loading\u2026</div>';
  }

  function pageLabel(name, params) {
    var labels = {
      dashboard: 'Dashboard',
      invoices: 'Invoices',
      'invoice-editor': 'Invoice',
      clients: 'Clients',
      'client-editor': params && params.id ? 'Edit client' : 'New client',
      businesses: 'Businesses',
      'business-editor': params && params.id ? 'Edit business' : 'New business',
      templates: 'Templates',
      'template-editor': 'Template editor',
      settings: 'Settings',
      '404': 'Page not found'
    };
    return labels[name] || name;
  }

  function parentFor(name) {
    return {
      'invoice-editor': 'invoices',
      'client-editor': 'clients',
      'business-editor': 'businesses',
      'template-editor': 'templates'
    }[name] || null;
  }

  function breadcrumbHtml(name, params) {
    if (name === DEFAULT) return '';
    var parent = parentFor(name);
    var html = '<nav class="breadcrumbs" aria-label="Breadcrumb">' +
      '<a href="' + buildUrl({ page: DEFAULT }) + '" data-bc-page="' + DEFAULT + '">Dashboard</a>';
    if (parent) {
      html += '<i class="bi bi-chevron-right"></i><a href="' + buildUrl({ page: parent }) + '" data-bc-page="' + parent + '">' + App.util.escapeHtml(pageLabel(parent, params)) + '</a>';
    }
    html += '<i class="bi bi-chevron-right"></i><span>' + App.util.escapeHtml(pageLabel(name, params)) + '</span></nav>';
    return html;
  }

  function render() {
    var requested = requestedPage();
    showLoading();

    // Tear down previous page.
    if (current && current.def && typeof current.def.unmount === 'function') {
      try { current.def.unmount(); } catch (e) { console.error(e); }
    }

    fetchIfExists('pages/' + requested + '.html').then(function (html) {
      var name = requested;
      if (html == null) {
        name = NOT_FOUND;
        return fetchIfExists('pages/' + NOT_FOUND + '.html').then(function (nf) {
          return { name: name, html: nf != null ? nf : fallback404(requested) };
        });
      }
      return { name: name, html: html };
    }).then(function (resolved) {
      // Guard against rapid navigation.
      if (requestedPage() !== requested) return;

      App.bus.emit('route:change', { page: resolved.name, requested: requested, params: getParams() });

      return Promise.all([ensureCss(resolved.name), ensureJs(resolved.name)]).then(function () {
        if (requestedPage() !== requested) return;
        outlet.innerHTML = breadcrumbHtml(resolved.name, getParams()) + resolved.html;
        outlet.querySelectorAll('[data-bc-page]').forEach(function (a) {
          a.addEventListener('click', function (e) {
            e.preventDefault();
            navigate({ page: a.getAttribute('data-bc-page') });
          });
        });
        var def = App.pages.get(resolved.name);
        current = { name: resolved.name, def: def };
        if (def && typeof def.mount === 'function') {
          try { def.mount(outlet, getParams()); } catch (e) { console.error('Mount failed for ' + resolved.name, e); }
        }
        if (App.selects && typeof App.selects.enhance === 'function') App.selects.enhance(outlet);
        outlet.scrollTop = 0;
      });
    }).catch(function (err) {
      console.error(err);
      outlet.innerHTML = '<div class="empty-state"><i class="bi bi-exclamation-triangle"></i>' +
        '<h3>Could not load this page</h3><p class="text-muted">' + App.util.escapeHtml(err.message) + '</p>' +
        '<p class="text-muted">If you opened the file directly, run a local server (see README).</p></div>';
    });
  }

  function fallback404(requested) {
    return '<div class="empty-state"><i class="bi bi-compass"></i>' +
      '<h3>Page not found</h3><p class="text-muted">No page named \u201c' + App.util.escapeHtml(requested) + '\u201d.</p>' +
      '<a class="btn btn-primary" href="' + buildUrl({ page: 'dashboard' }) + '">Go to dashboard</a></div>';
  }

  function init() {
    outlet = document.getElementById('app');
    window.addEventListener('popstate', render);
    render();
  }

  return {
    init: init,
    navigate: navigate,
    getParams: getParams,
    requestedPage: requestedPage,
    currentPage: requestedPage,   // alias kept for components
    buildUrl: buildUrl
  };
})();
