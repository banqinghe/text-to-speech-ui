const DB_NAME = 'tts-history-db';
const STORE_NAME = 'generations';
const MAX_HISTORY = 10;

export interface Generation {
  id: number;
  text: string;
  blob: Blob;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp');
      }
    };
  });
}

export async function saveGeneration(text: string, blob: Blob): Promise<Generation> {
  const db = await openDB();
  
  // 1. Save new generation
  const generation = await new Promise<Generation>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const newItem = { text, blob, timestamp: Date.now() };
    
    const request = store.add(newItem);
    
    request.onsuccess = () => {
      resolve({ ...newItem, id: request.result as number });
    };
    request.onerror = () => reject(request.error);
  });

  // 2. Cleanup old records
  await cleanupHistory(db);

  return generation;
}

export async function getGenerations(): Promise<Generation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    // Get all, but we want them in descending order. 
    // IDB cursors can do 'prev', but getAll is simpler for small datasets.
    // We'll sort in JS.
    const request = index.getAll();

    request.onsuccess = () => {
      const results = (request.result as Generation[]).sort((a, b) => b.timestamp - a.timestamp);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

async function cleanupHistory(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('timestamp');

    const request = index.getAllKeys();

    request.onsuccess = () => {
      const keys = request.result;
      if (keys.length > MAX_HISTORY) {
        // keys are sorted by timestamp ascending because of the index? 
        // Actually getAllKeys on an index returns keys sorted by the index key.
        // So the oldest timestamps are first.
        const keysToDelete = keys.slice(0, keys.length - MAX_HISTORY);
        
        keysToDelete.forEach(key => {
          store.delete(key); // Note: we need to delete by Primary Key (id), but getAllKeys on index returns Primary Keys?
          // Wait, getAllKeys on index returns the Primary Keys (id) sorted by the Index Key (timestamp).
          // Yes, that is correct.
        });
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}
