// The browser's shelf for what the game keeps that is too big for localStorage: the saves (game/
// save.js) and the phone's photos (ui/phone.js), in IndexedDB. Without IndexedDB they go to
// localStorage (the photos may not fit there: then they are not kept).

const DB = 'scribble-city';
const VERSION = 2;
const STORES = ['saves', 'photos'];

let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      if (!window.indexedDB) return resolve(null);
      const r = indexedDB.open(DB, VERSION);
      r.onupgradeneeded = () => {
        for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s);
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.onblocked = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
  return dbp;
}

const lsKey = (store, key) => `${DB}-${store}-${key}`;

function tx(d, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function put(store, key, value) {
  const d = await db();
  if (!d) {
    localStorage.setItem(lsKey(store, key), JSON.stringify(value));
    return;
  }
  await tx(d, store, 'readwrite', (s) => s.put(value, key));
}

export async function get(store, key) {
  const d = await db();
  if (!d) {
    const s = localStorage.getItem(lsKey(store, key));
    return s ? JSON.parse(s) : null;
  }
  try {
    return (await tx(d, store, 'readonly', (s) => s.get(key))) || null;
  } catch (e) {
    return null;
  }
}

export async function del(store, key) {
  const d = await db();
  if (!d) {
    localStorage.removeItem(lsKey(store, key));
    return;
  }
  await tx(d, store, 'readwrite', (s) => s.delete(key));
}

// every key in a store, oldest first
export async function keys(store) {
  const d = await db();
  if (!d) {
    const pre = lsKey(store, '');
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(pre)) out.push(k.slice(pre.length));
    }
    return out.sort();
  }
  try {
    return ((await tx(d, store, 'readonly', (s) => s.getAllKeys())) || []).map(String).sort();
  } catch (e) {
    return [];
  }
}
