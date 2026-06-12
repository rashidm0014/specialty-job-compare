/* Phase 2: IndexedDB storage, lazy specialty loading, PWA registration */
(function () {
  "use strict";

  const DB_NAME = "SpecialtyJobCompare";
  const DB_VERSION = 1;
  const STORE_NAME = "kv";
  const DATA_BASE = "data/specialties/";

  window.SPECIALTY_INDEX = {};
  window.SPECIALTIES = {};
  window.EXPANDED_QUESTIONS = {};
  window.SCORING_CONTEXT = {};

  const loaded = new Set();
  const inflight = Object.create(null);
  let dbPromise = null;
  let indexPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function idbGet(key) {
    const db = await openDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbSet(key, value) {
    const db = await openDb();
    if (!db) return false;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE_NAME).put(value, key);
    });
  }

  function localGet(key) {
    try {
      return window.localStorage ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }

  function localSet(key, value) {
    try {
      if (!window.localStorage) return false;
      localStorage.setItem(key, value);
      return true;
    } catch (err) {
      if (err && err.name === "QuotaExceededError") {
        toast("Storage limit reached. Export your data before adding more.");
      } else {
        toast("Browser storage is unavailable. Use Export/Share to save your data.");
      }
      return false;
    }
  }

  async function migrateFromLocalStorage(key) {
    const legacy = localGet(key);
    if (!legacy) return null;
    try {
      await idbSet(key, legacy);
      try {
        localStorage.removeItem(key);
      } catch {}
      return legacy;
    } catch {
      return legacy;
    }
  }

  window.appStorageGet = async function appStorageGet(key) {
    try {
      const fromIdb = await idbGet(key);
      if (fromIdb != null) return fromIdb;
    } catch (err) {
      console.warn("IndexedDB read failed, falling back to localStorage", err);
    }
    return migrateFromLocalStorage(key);
  };

  window.appStorageSet = async function appStorageSet(key, value) {
    try {
      const ok = await idbSet(key, value);
      if (ok) return true;
    } catch (err) {
      console.warn("IndexedDB write failed, falling back to localStorage", err);
    }
    return localSet(key, value);
  };

  function applySpecialtyPayload(key, payload) {
    const { expandedQuestions, scoringContext, ...spec } = payload;
    window.SPECIALTIES[key] = spec;
    window.EXPANDED_QUESTIONS[key] = expandedQuestions || {};
    window.SCORING_CONTEXT[key] = scoringContext || {};
    loaded.add(key);
  }

  window.loadSpecialtyIndex = async function loadSpecialtyIndex() {
    if (indexPromise) return indexPromise;
    indexPromise = fetch(DATA_BASE + "index.json")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load specialty index");
        return r.json();
      })
      .then((data) => {
        window.SPECIALTY_INDEX = data;
        return data;
      })
      .catch((err) => {
        indexPromise = null;
        console.error(err);
        toast("Could not load specialty list. Check network or refresh.");
        throw err;
      });
    return indexPromise;
  };

  window.loadSpecialty = async function loadSpecialty(key) {
    if (loaded.has(key)) return window.SPECIALTIES[key];
    if (inflight[key]) return inflight[key];
    inflight[key] = fetch(DATA_BASE + key + ".json")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load specialty: " + key);
        return r.json();
      })
      .then((payload) => {
        applySpecialtyPayload(key, payload);
        delete inflight[key];
        return window.SPECIALTIES[key];
      })
      .catch((err) => {
        delete inflight[key];
        console.error(err);
        toast("Could not load " + (window.SPECIALTY_INDEX[key]?.name || key) + " workspace.");
        throw err;
      });
    return inflight[key];
  };

  window.ensureSpecialtiesLoaded = async function ensureSpecialtiesLoaded(keys) {
    const pending = keys.filter((k) => k && !loaded.has(k));
    await Promise.all(pending.map((k) => loadSpecialty(k)));
  };

  window.registerServiceWorker = function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
    navigator.serviceWorker.register("sw.js").catch((err) => console.warn("SW registration failed", err));
  };
})();
