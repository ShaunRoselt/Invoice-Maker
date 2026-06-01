# Roselt Invoice Generator — Developer Notes

A single-page invoice app built with plain **HTML, CSS and JavaScript** — no build step, no frameworks, no ES modules. Pick a professional template, edit it live, save your invoices and export them to PDF.

## Features (developer view)

- **Template gallery** — 3 built-in professional designs (Classic Corporate, Modern Minimal, Bold Sidebar).
- **Pick → edit instantly** — choosing a template opens it straight in the invoice editor.
- **Block-based template designer** — a WYSIWYG editor: click any element to edit it inline, drag a handle to reorder, drag components (Heading, Text, Field, Image, Columns, Line items, Totals, Divider, Spacer) and live **merge fields** from the rail onto the page, with per-block style controls and page settings.
- **Live invoice editor** — logo upload, business & client details, line items with auto-totals, tax & discount, notes.
- **Custom templates** — fork a built-in or design your own from scratch; saved with their full layout.
- **Saved invoices** — list, search, open, duplicate, delete; track status (draft / sent / paid / overdue).
- **PDF export** — one-click download via `html2pdf.js`.
- **Dark / light mode** — toggle in the header, remembered across sessions (also respects your OS preference).
- **Local-first** — everything persists in `localStorage`. No account, no server.

## Running (developer)

Page content is loaded with `fetch()`, so the app must be served over HTTP (opening `index.html` directly with `file://` will not work).

```bash
# from the project root
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve`, VS Code Live Server, etc.).

## Routing (developer)

Single page; the view is controlled by a `page=` URL parameter. **Routes are not hardcoded** — a route exists simply because a matching file exists in `pages/`. `?page=dashboard` loads `pages/dashboard.html`. A page's `.css` and `.js` are **optional**; the router fetches them only if present. Unknown pages fall back to `pages/404.html`.

### Adding a page

Drop a `pages/<name>.html` file in and it's instantly routable at `?page=<name>`. Optionally add `pages/<name>.css` and a `pages/<name>.js` that calls:

```js
App.pages.register('<name>', {
  mount: function (root, params) { /* build the page; params = URL query */ },
  unmount: function () { /* optional cleanup */ }
});
```

## Project structure

See the original README for a full layout; top-level items of interest:

```
index.html            App shell (header + sidebar + outlet) and script loading
assets/js/            core helpers and router
components/           web components
pages/                optional {html,css,js} per route
templates/            built-in template models
```

## How templates work

A template is a **block document** — `{ page, blocks[] }` — rendered by `doc.js`. Blocks include `heading`, `text`, `field` (a live merge field bound to invoice data), `image`, `columns`, `items` (the line-items table), `totals`, `divider` and `spacer`. The same renderer powers the editor, the invoice preview and PDF export.

## Dependencies (CDN)

- [Bootstrap Icons](https://icons.getbootstrap.com/) — icons
- [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) — PDF export
