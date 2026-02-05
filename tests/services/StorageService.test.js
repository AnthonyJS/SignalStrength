import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StorageService } from '../../js/services/StorageService.js';
import { Journey } from '../../js/models/Journey.js';

// Mock IndexedDB for testing
const mockIndexedDB = () => {
  const stores = {};

  const createMockStore = (name) => {
    const data = new Map();

    return {
      put: (value) => {
        const request = createMockRequest();
        setTimeout(() => {
          data.set(value.id, value);
          request.onsuccess?.();
        }, 0);
        return request;
      },
      get: (key) => {
        const request = createMockRequest();
        setTimeout(() => {
          request.result = data.get(key);
          request.onsuccess?.();
        }, 0);
        return request;
      },
      delete: (key) => {
        const request = createMockRequest();
        setTimeout(() => {
          data.delete(key);
          request.onsuccess?.();
        }, 0);
        return request;
      },
      clear: () => {
        const request = createMockRequest();
        setTimeout(() => {
          data.clear();
          request.onsuccess?.();
        }, 0);
        return request;
      },
      index: () => ({
        openCursor: () => {
          const request = createMockRequest();
          setTimeout(() => {
            const values = Array.from(data.values())
              .sort((a, b) => b.startTime - a.startTime);

            let index = 0;
            const createCursor = () => {
              if (index < values.length) {
                return {
                  value: values[index],
                  continue: () => {
                    index++;
                    request.result = createCursor();
                    request.onsuccess?.({ target: request });
                  }
                };
              }
              return null;
            };

            request.result = createCursor();
            request.onsuccess?.({ target: request });
          }, 0);
          return request;
        }
      }),
      createIndex: vi.fn(),
      _data: data
    };
  };

  const createMockRequest = () => ({
    result: null,
    error: null,
    onsuccess: null,
    onerror: null
  });

  const mockDB = {
    objectStoreNames: { contains: (name) => !!stores[name] },
    createObjectStore: (name) => {
      stores[name] = createMockStore(name);
      return stores[name];
    },
    transaction: (storeNames) => ({
      objectStore: (name) => stores[name]
    }),
    close: vi.fn()
  };

  const open = (name, version) => {
    const request = createMockRequest();
    setTimeout(() => {
      if (!stores.journeys) {
        stores.journeys = createMockStore('journeys');
        request.onupgradeneeded?.({ target: { result: mockDB } });
      }
      request.result = mockDB;
      request.onsuccess?.();
    }, 0);
    return request;
  };

  return { open, _stores: stores, _mockDB: mockDB };
};

describe('StorageService', () => {
  let service;
  let originalIndexedDB;

  beforeEach(() => {
    originalIndexedDB = globalThis.indexedDB;
    globalThis.indexedDB = mockIndexedDB();
    service = new StorageService();
  });

  afterEach(() => {
    service.close();
    globalThis.indexedDB = originalIndexedDB;
  });

  describe('open', () => {
    it('opens the database', async () => {
      const db = await service.open();
      expect(db).toBeDefined();
    });

    it('returns same db instance on subsequent calls', async () => {
      const db1 = await service.open();
      const db2 = await service.open();
      expect(db1).toBe(db2);
    });
  });

  describe('saveJourney', () => {
    it('saves a journey to the database', async () => {
      const journey = Journey.create('Test');
      await service.saveJourney(journey);

      const retrieved = await service.getJourney(journey.id);
      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBe('Test');
    });
  });

  describe('getJourney', () => {
    it('returns null for non-existent journey', async () => {
      const result = await service.getJourney('non-existent-id');
      expect(result).toBeNull();
    });

    it('returns Journey instance', async () => {
      const journey = Journey.create('Test');
      await service.saveJourney(journey);

      const retrieved = await service.getJourney(journey.id);
      expect(retrieved).toBeInstanceOf(Journey);
    });
  });

  describe('getAllJourneys', () => {
    it('returns empty array when no journeys', async () => {
      const journeys = await service.getAllJourneys();
      expect(journeys).toEqual([]);
    });

    it('returns all journeys sorted by startTime descending', async () => {
      const journey1 = new Journey({ name: 'First', startTime: 1000 });
      const journey2 = new Journey({ name: 'Second', startTime: 2000 });
      const journey3 = new Journey({ name: 'Third', startTime: 3000 });

      await service.saveJourney(journey1);
      await service.saveJourney(journey2);
      await service.saveJourney(journey3);

      const journeys = await service.getAllJourneys();

      expect(journeys).toHaveLength(3);
      expect(journeys[0].name).toBe('Third');
      expect(journeys[1].name).toBe('Second');
      expect(journeys[2].name).toBe('First');
    });
  });

  describe('deleteJourney', () => {
    it('deletes a journey', async () => {
      const journey = Journey.create('Test');
      await service.saveJourney(journey);
      await service.deleteJourney(journey.id);

      const retrieved = await service.getJourney(journey.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('exportJourney', () => {
    it('creates a download link', () => {
      // Mock URL methods (not available in jsdom)
      const mockUrl = 'blob:test-url';
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn().mockReturnValue(mockUrl);
      URL.revokeObjectURL = vi.fn();

      const createElementSpy = vi.spyOn(document, 'createElement');
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn()
      };
      createElementSpy.mockReturnValue(mockAnchor);

      const journey = Journey.create('Test Journey');
      service.exportJourney(journey);

      expect(mockAnchor.click).toHaveBeenCalled();
      expect(mockAnchor.download).toContain('journey-test-journey');
      expect(mockAnchor.download).toContain('.json');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });
  });

  describe('importJourney', () => {
    it('imports a valid journey file', async () => {
      const journeyData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        journey: {
          id: 'test-id',
          name: 'Imported Journey',
          startTime: Date.now(),
          endTime: null,
          dataPoints: []
        }
      };

      const file = new File([JSON.stringify(journeyData)], 'journey.json', {
        type: 'application/json'
      });

      const imported = await service.importJourney(file);

      expect(imported).toBeInstanceOf(Journey);
      expect(imported.name).toBe('Imported Journey');
    });

    it('rejects invalid JSON', async () => {
      const file = new File(['not valid json'], 'journey.json', {
        type: 'application/json'
      });

      await expect(service.importJourney(file)).rejects.toThrow('Failed to import journey');
    });

    it('rejects file without journey property', async () => {
      const file = new File([JSON.stringify({ foo: 'bar' })], 'journey.json', {
        type: 'application/json'
      });

      await expect(service.importJourney(file)).rejects.toThrow('Invalid journey file format');
    });
  });

  describe('clearAll', () => {
    it('removes all journeys', async () => {
      await service.saveJourney(Journey.create('Test 1'));
      await service.saveJourney(Journey.create('Test 2'));
      await service.clearAll();

      const journeys = await service.getAllJourneys();
      expect(journeys).toEqual([]);
    });
  });
});
