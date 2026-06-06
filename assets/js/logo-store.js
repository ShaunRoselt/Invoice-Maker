/* ============================================================
   logo-store.js — client/business logo blobs (IndexedDB)
   ============================================================ */
window.App = window.App || {};

App.logoStore = (function () {
  var MAX_BYTES = 10 * 1024 * 1024;

  function storeKey(type, id) {
    return type + ':' + id;
  }

  function get(type, id) {
    return App.idb.getBlob(storeKey(type, id));
  }

  function put(type, id, dataUrl) {
    return App.idb.setBlob(storeKey(type, id), dataUrl || '');
  }

  return {
    MAX_BYTES: MAX_BYTES,
    storeKey: storeKey,
    get: get,
    put: put,
    getCached: function (type, id) {
      return App.idb.getBlobCached(storeKey(type, id));
    },
    prime: function (type, id, dataUrl) {
      App.idb.primeBlob(storeKey(type, id), dataUrl || '');
    }
  };
})();
