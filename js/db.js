(() => {
  "use strict";
  const DATABASE_NAME = "YaduvanshiDB";
  const DATABASE_VERSION = 1;
  const STORE_NAME = "records";

  let databasePromise = null;
  function openNamedDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          ["title", "category", "status", "date", "updatedAt"].forEach((key) => {
            store.createIndex(key, key, { unique: false });
          });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject( request.error || new Error("Unable to open YaduvanshiDB.") );
      };

      request.onblocked = () => {
        console.warn( "[Yaduvanshi Desk] Database opening is blocked. Close other project tabs and retry." );
      };
    });
  }

  function openDatabase() {
    if (!("indexedDB" in window)) {
      return Promise.reject( new Error("IndexedDB is not supported in this browser.") );
    }

    if (databasePromise) {
      return databasePromise;
    }

    databasePromise = openNamedDatabase().then((db) => {
        db.onversionchange = () => {
          db.close();
          databasePromise = null;
        };

        return db;
      }).catch((error) => {
        databasePromise = null;
        throw error;
      });
    return databasePromise;
  }

  async function transact(mode, operation) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      let result;
      let settled = false;

      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const fail = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      transaction.oncomplete = () => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      transaction.onerror = () => {
        fail( transaction.error || new Error("The database transaction failed.") );
      };

      transaction.onabort = () => {
        fail( transaction.error || new Error("The database transaction was cancelled.") );
      };

      try {
        operation(store, (value) => {
          result = value;
        });
      } catch (error) {
        try {
          transaction.abort();
        } catch (_) {}

        fail(error);
      }
    });
  }

  window.YaduvanshiDB = Object.freeze({
    openDatabase, add: (record) => transact("readwrite", (store) => {
        store.add(record);
      }),

    update: (record) => transact("readwrite", (store) => {
        store.put(record);
      }),

    remove: (id) => transact("readwrite", (store) => {
        store.delete(id);
      }),

    clear: () => transact("readwrite", (store) => {
        store.clear();
      }),

    get: (id) => transact("readonly", (store, set) => {
        const request = store.get(id);
        request.onsuccess = () => {
          set(request.result || null);
        };
      }),

    getAll: () => transact("readonly", (store, set) => {
        const request = store.getAll();
        request.onsuccess = () => {
          set(request.result || []);
        };
      }),

    importRecords: (records) => transact("readwrite", (store) => {
        records.forEach((record) => {
          store.put(record);
        });
      })
  });
})();