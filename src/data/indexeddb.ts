/**
 * Speicherung auf dem Gerät.
 *
 * Alle Daten liegen in IndexedDB im Browser des Benutzers. Sie überstehen
 * das Neuladen der Seite und das Schließen des Browsers. Sie werden nicht
 * synchronisiert und sind nicht zwischen echten Benutzerkonten geteilt – das
 * wird in der Oberfläche auch so benannt.
 */

import { openDB, type IDBPDatabase } from "idb";
import {
  COLLECTION_NAMES,
  type CollectionName,
  type Collections,
  type Repository,
  type StorageMode,
} from "./repository";

const DATABASE_NAME = "dock";
const DATABASE_VERSION = 1;
const BLOB_STORE = "blobs";

type AnyRecord = { id: string };

async function open(name: string): Promise<IDBPDatabase> {
  return openDB(name, DATABASE_VERSION, {
    upgrade(db) {
      for (const name of COLLECTION_NAMES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
    },
  });
}

export class IndexedDbRepository implements Repository {
  readonly mode: StorageMode = "lokal";
  private handle: Promise<IDBPDatabase> | null = null;

  /**
   * Der Name der Datenbank ist einstellbar. Im Betrieb ist er immer derselbe;
   * Tests koennen so nebeneinander laufen, ohne sich zu stoeren.
   */
  constructor(private readonly name: string = DATABASE_NAME) {}

  private db(): Promise<IDBPDatabase> {
    if (!this.handle) this.handle = open(this.name);
    return this.handle;
  }

  /** Schliesst die Verbindung. Wird im Betrieb nicht gebraucht. */
  async close(): Promise<void> {
    if (!this.handle) return;
    (await this.handle).close();
    this.handle = null;
  }

  async list<K extends CollectionName>(name: K): Promise<Collections[K][]> {
    const db = await this.db();
    return (await db.getAll(name)) as Collections[K][];
  }

  async get<K extends CollectionName>(
    name: K,
    id: string,
  ): Promise<Collections[K] | undefined> {
    const db = await this.db();
    return (await db.get(name, id)) as Collections[K] | undefined;
  }

  async put<K extends CollectionName>(
    name: K,
    value: Collections[K],
  ): Promise<void> {
    const db = await this.db();
    // Der Schlüssel steckt im Datensatz. Ein erneuter Schreibvorgang mit
    // derselben Kennung ersetzt, er legt nichts zusätzlich an.
    await db.put(name, value as unknown as AnyRecord);
  }

  async putMany<K extends CollectionName>(
    name: K,
    values: readonly Collections[K][],
  ): Promise<void> {
    if (values.length === 0) return;
    const db = await this.db();
    const tx = db.transaction(name, "readwrite");
    await Promise.all([
      ...values.map((value) => tx.store.put(value as unknown as AnyRecord)),
      tx.done,
    ]);
  }

  async remove(name: CollectionName, id: string): Promise<void> {
    const db = await this.db();
    await db.delete(name, id);
  }

  async putBlob(id: string, blob: Blob): Promise<void> {
    const db = await this.db();
    await db.put(BLOB_STORE, blob, id);
  }

  async getBlob(id: string): Promise<Blob | undefined> {
    const db = await this.db();
    return (await db.get(BLOB_STORE, id)) as Blob | undefined;
  }

  async removeBlob(id: string): Promise<void> {
    const db = await this.db();
    await db.delete(BLOB_STORE, id);
  }

  async clear(): Promise<void> {
    const db = await this.db();
    const tx = db.transaction([...COLLECTION_NAMES, BLOB_STORE], "readwrite");
    await Promise.all([
      ...COLLECTION_NAMES.map((name) => tx.objectStore(name).clear()),
      tx.objectStore(BLOB_STORE).clear(),
      tx.done,
    ]);
  }
}

/**
 * Speicherung im Arbeitsspeicher.
 *
 * Wird für Tests und für die Vorschau der Website verwendet. Sie überlebt
 * das Neuladen nicht und gibt das auch nicht vor.
 */
export class MemoryRepository implements Repository {
  readonly mode: StorageMode = "lokal";
  private data = new Map<CollectionName, Map<string, unknown>>();
  private blobs = new Map<string, Blob>();

  private bucket(name: CollectionName): Map<string, unknown> {
    let bucket = this.data.get(name);
    if (!bucket) {
      bucket = new Map();
      this.data.set(name, bucket);
    }
    return bucket;
  }

  async list<K extends CollectionName>(name: K): Promise<Collections[K][]> {
    return [...this.bucket(name).values()] as Collections[K][];
  }

  async get<K extends CollectionName>(
    name: K,
    id: string,
  ): Promise<Collections[K] | undefined> {
    return this.bucket(name).get(id) as Collections[K] | undefined;
  }

  async put<K extends CollectionName>(
    name: K,
    value: Collections[K],
  ): Promise<void> {
    this.bucket(name).set((value as unknown as AnyRecord).id, value);
  }

  async putMany<K extends CollectionName>(
    name: K,
    values: readonly Collections[K][],
  ): Promise<void> {
    for (const value of values) await this.put(name, value);
  }

  async remove(name: CollectionName, id: string): Promise<void> {
    this.bucket(name).delete(id);
  }

  async putBlob(id: string, blob: Blob): Promise<void> {
    this.blobs.set(id, blob);
  }

  async getBlob(id: string): Promise<Blob | undefined> {
    return this.blobs.get(id);
  }

  async removeBlob(id: string): Promise<void> {
    this.blobs.delete(id);
  }

  async clear(): Promise<void> {
    this.data.clear();
    this.blobs.clear();
  }
}

/** Gibt es in dieser Umgebung überhaupt IndexedDB? */
export function hasIndexedDb(): boolean {
  return typeof globalThis !== "undefined" && "indexedDB" in globalThis;
}

export function createLocalRepository(): Repository {
  return hasIndexedDb() ? new IndexedDbRepository() : new MemoryRepository();
}
