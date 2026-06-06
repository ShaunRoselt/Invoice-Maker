/* ============================================================
   idb.js — IndexedDB persistence (replaces localStorage)
   ============================================================ */
window.App = window.App || {};

App.idb = (function () {
  var DB_NAME = 'roseltInvoiceGenerator_v1';
  var LEGACY_LOGO_DB = 'roseltInvoiceGenerator_v1_logos';
  var VERSION = 1;
  var STORE_KV = 'kv';
  var STORE_BLOBS = 'blobs';
  var LEGACY_PREFIX = 'roseltInvoiceGenerator_v1_';
  var LEGACY_THEME = LEGACY_PREFIX + 'theme';
  var MIGRATION_KEY = '__migrated_v1';

  var kvCache = Object.create(null);
  var blobCache = Object.create(null);
  var dbPromise = null;
  var readyPromise = null;
  var readyFlag = false;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB is not available in this browser.'));
        return;
      }
      var req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_KV)) db.createObjectStore(STORE_KV);
        if (!db.objectStoreNames.contains(STORE_BLOBS)) db.createObjectStore(STORE_BLOBS);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('Could not open database.')); };
    });
    return dbPromise;
  }

  function loadKvCache(db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_KV, 'readonly');
      var store = tx.objectStore(STORE_KV);
      var req = store.openCursor();
      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (cursor) {
          kvCache[cursor.key] = cursor.value;
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = function () { reject(req.error || new Error('Could not load data.')); };
    });
  }

  function loadBlobCache(db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE_BLOBS, 'readonly');
      var store = tx.objectStore(STORE_BLOBS);
      var req = store.openCursor();
      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (cursor) {
          blobCache[cursor.key] = cursor.value || '';
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = function () { reject(req.error || new Error('Could not load images.')); };
    });
  }

  function persistKv(key, value) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_KV, 'readwrite');
        tx.objectStore(STORE_KV).put(value, key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('Could not save data.')); };
        tx.onabort = function () { reject(tx.error || new Error('Could not save data.')); };
      });
    });
  }

  function persistBlob(key, value) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_BLOBS, 'readwrite');
        var store = tx.objectStore(STORE_BLOBS);
        if (value) store.put(value, key);
        else store.delete(key);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error || new Error('Could not save image.')); };
        tx.onabort = function () { reject(tx.error || new Error('Could not save image.')); };
      });
    });
  }

  function readLegacyJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function stripLegacyLogo(contact) {
    if (!contact) return contact;
    var copy = Object.assign({}, contact);
    if (copy.logo && String(copy.logo).indexOf('data:') === 0) {
      copy.hasLogo = true;
    }
    copy.logo = '';
    return copy;
  }

  function queueLegacyLogo(type, id, dataUrl) {
    if (!dataUrl) return Promise.resolve();
    var key = type + ':' + id;
    blobCache[key] = dataUrl;
    return persistBlob(key, dataUrl);
  }

  function migrateLegacyLogosFromContacts(list, type) {
    if (!list || !list.length) return Promise.resolve(list);
    var jobs = [];
    var out = list.map(function (item) {
      if (item.logo && String(item.logo).indexOf('data:') === 0) {
        jobs.push(queueLegacyLogo(type, item.id, item.logo));
      }
      return stripLegacyLogo(item);
    });
    return Promise.all(jobs).then(function () { return out; });
  }

  function migrateOldLogoDb() {
    return new Promise(function (resolve) {
      if (!window.indexedDB) { resolve(); return; }
      var req = indexedDB.open(LEGACY_LOGO_DB, 1);
      req.onerror = function () { resolve(); };
      req.onsuccess = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('logos')) {
          db.close();
          resolve();
          return;
        }
        var tx = db.transaction('logos', 'readonly');
        var store = tx.objectStore('logos');
        var cur = store.openCursor();
        var jobs = [];
        cur.onsuccess = function (e) {
          var cursor = e.target.result;
          if (cursor) {
            if (cursor.value && blobCache[cursor.key] === undefined) {
              blobCache[cursor.key] = cursor.value;
              jobs.push(persistBlob(cursor.key, cursor.value));
            }
            cursor.continue();
          } else {
            db.close();
            Promise.all(jobs).then(resolve).catch(resolve);
          }
        };
        cur.onerror = function () { db.close(); resolve(); };
      };
    });
  }

  function clearLegacyLocalStorage() {
    try {
      [
        LEGACY_PREFIX + 'settings',
        LEGACY_PREFIX + 'invoices',
        LEGACY_PREFIX + 'userTemplates',
        LEGACY_PREFIX + 'clients',
        LEGACY_PREFIX + 'businesses',
        LEGACY_PREFIX + 'counter',
        LEGACY_THEME
      ].forEach(function (key) { localStorage.removeItem(key); });
    } catch (e) { /* ignore */ }
  }

  function migrateFromLocalStorage(db) {
    if (kvCache[MIGRATION_KEY]) return Promise.resolve();

    var legacyMap = {
      settings: LEGACY_PREFIX + 'settings',
      invoices: LEGACY_PREFIX + 'invoices',
      userTemplates: LEGACY_PREFIX + 'userTemplates',
      clients: LEGACY_PREFIX + 'clients',
      businesses: LEGACY_PREFIX + 'businesses',
      counter: LEGACY_PREFIX + 'counter'
    };

    var jobs = [];
    Object.keys(legacyMap).forEach(function (key) {
      var legacyKey = legacyMap[key];
      var val = readLegacyJson(legacyKey, null);
      if (val !== null && kvCache[key] === undefined) {
        kvCache[key] = val;
        jobs.push(persistKv(key, val));
      }
    });

    try {
      var theme = localStorage.getItem(LEGACY_THEME);
      if (theme && kvCache.theme === undefined) {
        kvCache.theme = theme;
        jobs.push(persistKv('theme', theme));
      }
    } catch (e) { /* ignore */ }

    return Promise.all(jobs).then(function () {
      return migrateLegacyLogosFromContacts(kvCache.clients || [], 'client').then(function (clients) {
        kvCache.clients = clients;
        return persistKv('clients', clients);
      });
    }).then(function () {
      return migrateLegacyLogosFromContacts(kvCache.businesses || [], 'business').then(function (businesses) {
        kvCache.businesses = businesses;
        return persistKv('businesses', businesses);
      });
    }).then(function () {
      return migrateOldLogoDb();
    }).then(function () {
      kvCache[MIGRATION_KEY] = true;
      return persistKv(MIGRATION_KEY, true);
    }).then(function () {
      clearLegacyLocalStorage();
    });
  }

  function ready() {
    if (readyPromise) return readyPromise;
    readyPromise = openDb()
      .then(function (db) {
        return loadKvCache(db).then(function () {
          return loadBlobCache(db);
        }).then(function () {
          return migrateFromLocalStorage(db);
        });
      })
      .then(function () {
        readyFlag = true;
      });
    return readyPromise;
  }

  function isReady() {
    return readyFlag;
  }

  function getKv(key, fallback) {
    return kvCache[key] !== undefined ? kvCache[key] : fallback;
  }

  function setKv(key, value) {
    kvCache[key] = value;
    return persistKv(key, value);
  }

  function getBlob(key) {
    if (blobCache[key] !== undefined) return Promise.resolve(blobCache[key]);
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_BLOBS, 'readonly');
        var req = tx.objectStore(STORE_BLOBS).get(key);
        req.onsuccess = function () {
          blobCache[key] = req.result || '';
          resolve(blobCache[key]);
        };
        req.onerror = function () { reject(req.error || new Error('Could not load image.')); };
      });
    });
  }

  function setBlob(key, value) {
    blobCache[key] = value || '';
    return persistBlob(key, value || '');
  }

  function getBlobCached(key) {
    return blobCache[key];
  }

  function primeBlob(key, value) {
    blobCache[key] = value || '';
  }

  return {
    ready: ready,
    isReady: isReady,
    getKv: getKv,
    setKv: setKv,
    getBlob: getBlob,
    setBlob: setBlob,
    getBlobCached: getBlobCached,
    primeBlob: primeBlob
  };
})();
