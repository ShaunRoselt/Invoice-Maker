/* ============================================================
   list-selection.js — shift-click multi-select for data tables
   ============================================================ */
window.App = window.App || {};

App.listSelection = function (opts) {
  opts = opts || {};
  var selected = Object.create(null);
  var anchorId = null;
  var singular = opts.singular || 'item';
  var plural = opts.plural || singular + 's';

  function count() {
    return Object.keys(selected).length;
  }

  function ids() {
    return Object.keys(selected);
  }

  function has(id) {
    return !!selected[id];
  }

  function notify() {
    if (typeof opts.onChange === 'function') opts.onChange();
  }

  function clear() {
    selected = Object.create(null);
    anchorId = null;
    notify();
  }

  function prune(validIds) {
    var allowed = Object.create(null);
    validIds.forEach(function (id) { allowed[id] = true; });
    var changed = false;
    Object.keys(selected).forEach(function (id) {
      if (!allowed[id]) {
        delete selected[id];
        changed = true;
      }
    });
    if (anchorId && !allowed[anchorId]) anchorId = null;
    if (changed) notify();
  }

  function setOne(id, on) {
    if (on) selected[id] = true;
    else delete selected[id];
    anchorId = id;
    notify();
  }

  function toggle(id) {
    if (selected[id]) delete selected[id];
    else selected[id] = true;
    anchorId = id;
    notify();
  }

  function selectRange(visibleIds, fromId, toId) {
    var i0 = visibleIds.indexOf(fromId);
    var i1 = visibleIds.indexOf(toId);
    if (i0 < 0 || i1 < 0) return;
    var start = Math.min(i0, i1);
    var end = Math.max(i0, i1);
    for (var i = start; i <= end; i++) selected[visibleIds[i]] = true;
    notify();
  }

  function selectAll(visibleIds) {
    visibleIds.forEach(function (id) { selected[id] = true; });
    notify();
  }

  function handleRowClick(e, id, visibleIds) {
    if (e.target.closest('[data-row-act]') || e.target.closest('.sort-btn') || e.target.closest('.select-col')) {
      return null;
    }

    if (e.shiftKey) {
      e.preventDefault();
      if (anchorId != null && visibleIds.indexOf(anchorId) >= 0 && anchorId !== id) {
        selectRange(visibleIds, anchorId, id);
      } else {
        selected[id] = true;
      }
      anchorId = id;
      return 'select';
    }

    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      toggle(id);
      return 'select';
    }

    if (count() > 0) clear();
    return 'navigate';
  }

  function headerCell(allSelected) {
    if (!count()) {
      return '<th class="select-col select-col-head" aria-hidden="true"></th>';
    }
    return '<th class="select-col select-col-head">' +
      '<label class="row-check visible" title="Select all on this page">' +
      '<input type="checkbox" class="select-all-cb"' + (allSelected ? ' checked' : '') + ' aria-label="Select all">' +
      '</label></th>';
  }

  function rowCell(id) {
    var on = has(id);
    var visible = count() > 0 || on;
    return '<td class="select-col">' +
      '<label class="row-check' + (visible ? ' visible' : '') + '">' +
      '<input type="checkbox" class="row-select-cb" data-id="' + App.util.escapeHtml(id) + '"' +
      (on ? ' checked' : '') + ' aria-label="Select row">' +
      '</label></td>';
  }

  function syncBulkBar(cardEl) {
    if (!cardEl) return;
    var bar = cardEl.querySelector('.list-bulk-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'list-bulk-bar';
      bar.innerHTML =
        '<div class="list-bulk-left">' +
          '<span class="list-bulk-count"></span>' +
          '<span class="list-bulk-hint">Shift+click rows to select more</span>' +
        '</div>' +
        '<div class="list-bulk-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-bulk-act="clear">Clear</button>' +
          '<button type="button" class="btn btn-danger btn-sm" data-bulk-act="delete">' +
            '<i class="bi bi-trash"></i> Delete selected</button>' +
        '</div>';
      cardEl.insertBefore(bar, cardEl.firstChild);
      bar.querySelector('[data-bulk-act="clear"]').addEventListener('click', function () { clear(); });
      bar.querySelector('[data-bulk-act="delete"]').addEventListener('click', function () {
        if (typeof opts.onBulkDelete === 'function') opts.onBulkDelete(ids().slice());
      });
    }
    var n = count();
    bar.hidden = n === 0;
    cardEl.classList.toggle('has-selection', n > 0);
    bar.querySelector('.list-bulk-count').textContent = n === 1 ? ('1 ' + singular + ' selected') : (n + ' ' + plural + ' selected');
  }

  function bindTable(tableEl, visibleIds, cardEl, onNavigate) {
    if (!tableEl) return;
    tableEl.classList.toggle('selection-active', count() > 0);

    tableEl.querySelectorAll('tbody tr[data-id]').forEach(function (tr) {
      var id = tr.getAttribute('data-id');
      tr.classList.toggle('row-selected', has(id));
      var cb = tr.querySelector('.row-select-cb');
      if (cb) cb.checked = has(id);
    });

    var allSelected = visibleIds.length > 0 && visibleIds.every(function (id) { return has(id); });
    var headCb = tableEl.querySelector('.select-all-cb');
    if (headCb) headCb.checked = allSelected;

    syncBulkBar(cardEl);

    var headCheck = tableEl.querySelector('.select-all-cb');
    if (headCheck && !headCheck._bound) {
      headCheck._bound = true;
      headCheck.addEventListener('click', function (e) {
        e.stopPropagation();
        if (headCheck.checked) selectAll(visibleIds);
        else clear();
      });
    }

    tableEl.querySelectorAll('.row-select-cb').forEach(function (cb) {
      if (cb._bound) return;
      cb._bound = true;
      cb.addEventListener('click', function (e) { e.stopPropagation(); });
      cb.addEventListener('change', function () {
        var rowId = cb.getAttribute('data-id');
        if (cb.checked) {
          selected[rowId] = true;
          anchorId = rowId;
        } else {
          delete selected[rowId];
        }
        notify();
      });
    });

    tableEl.querySelectorAll('tbody tr[data-id]').forEach(function (tr) {
      if (tr._selBound) return;
      tr._selBound = true;
      tr.addEventListener('click', function (e) {
        var rowId = tr.getAttribute('data-id');
        var action = handleRowClick(e, rowId, visibleIds);
        if (action === 'navigate' && typeof onNavigate === 'function') onNavigate(rowId, e);
      });
    });
  }

  return {
    count: count,
    ids: ids,
    has: has,
    clear: clear,
    prune: prune,
    toggle: toggle,
    headerCell: headerCell,
    rowCell: rowCell,
    bindTable: bindTable,
    syncBulkBar: syncBulkBar
  };
};
