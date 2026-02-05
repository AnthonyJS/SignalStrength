import { Journey } from '../models/Journey.js';

const DB_NAME = 'signal-strength-db';
const DB_VERSION = 1;
const STORE_NAME = 'journeys';

/**
 * Service for storing and retrieving journey data using IndexedDB.
 */
export class StorageService {
  constructor() {
    this.db = null;
  }

  /**
   * Opens the IndexedDB database.
   * @returns {Promise<IDBDatabase>}
   */
  async open() {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('startTime', 'startTime', { unique: false });
          store.createIndex('name', 'name', { unique: false });
        }
      };
    });
  }

  /**
   * Saves a journey to the database.
   * @param {Journey} journey
   * @returns {Promise<void>}
   */
  async saveJourney(journey) {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(journey.toJSON());

      request.onerror = () => {
        reject(new Error('Failed to save journey'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Gets a journey by ID.
   * @param {string} id
   * @returns {Promise<Journey|null>}
   */
  async getJourney(id) {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onerror = () => {
        reject(new Error('Failed to get journey'));
      };

      request.onsuccess = () => {
        if (request.result) {
          resolve(Journey.fromJSON(request.result));
        } else {
          resolve(null);
        }
      };
    });
  }

  /**
   * Gets all journeys, sorted by startTime descending.
   * @returns {Promise<Journey[]>}
   */
  async getAllJourneys() {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('startTime');
      const request = index.openCursor(null, 'prev');
      const journeys = [];

      request.onerror = () => {
        reject(new Error('Failed to get journeys'));
      };

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          journeys.push(Journey.fromJSON(cursor.value));
          cursor.continue();
        } else {
          resolve(journeys);
        }
      };
    });
  }

  /**
   * Deletes a journey by ID.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteJourney(id) {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => {
        reject(new Error('Failed to delete journey'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Exports a journey as a JSON file download.
   * @param {Journey} journey
   */
  async exportJourney(journey) {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      journey: journey.toJSON()
    };

    const filename = `journey-${journey.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.json`;
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    // Use Web Share API on iOS/mobile — gives the native share sheet
    // so the user can explicitly "Save to Files", AirDrop, etc.
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename)] })) {
      const file = new File([blob], filename, { type: 'application/json' });
      await navigator.share({ files: [file] });
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Imports a journey from a JSON file.
   * @param {File} file
   * @returns {Promise<Journey>}
   */
  async importJourney(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target.result);

          if (!data.journey) {
            throw new Error('Invalid journey file format');
          }

          const journey = Journey.fromJSON(data.journey);
          await this.saveJourney(journey);
          resolve(journey);
        } catch (error) {
          reject(new Error(`Failed to import journey: ${error.message}`));
        }
      };

      reader.readAsText(file);
    });
  }

  /**
   * Clears all journeys from the database.
   * @returns {Promise<void>}
   */
  async clearAll() {
    const db = await this.open();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => {
        reject(new Error('Failed to clear database'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Closes the database connection.
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
