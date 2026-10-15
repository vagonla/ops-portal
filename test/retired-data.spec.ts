import { expect, it, vi } from 'vitest';
import { clearRetiredData } from '../src/lib/retiredData';
it('removes retired metadata while retaining the existing employee list, files and profile', () => {
  const keys = ['ops-tracked-friends-v1', 'vardiya-app-state', 'vardiya-my-name', 'vardiya-route-data', 'vardiya-my-stop', 'ops-analytics-visitor-v1', 'ops-analytics-session-v1', 'vardiya-pending-invite'];
  const saved = new Map(keys.map(key => [key, 'saved']));
  const browser = {
    localStorage: { removeItem: (key: string) => saved.delete(key) },
    sessionStorage: { removeItem: vi.fn() }, document: { cookie: '' },
    location: { protocol: 'https:' }, indexedDB: { deleteDatabase: vi.fn(() => ({})) },
  };
  clearRetiredData(browser);
  expect([...saved.keys()]).toEqual(keys.slice(0, 5));
  expect(browser.indexedDB.deleteDatabase).toHaveBeenCalledWith('ops-analytics-v1');
});
it('still opens when browser storage is disabled', () => {
  const browser = {
    get localStorage() { throw new Error('blocked'); },
    get sessionStorage() { throw new Error('blocked'); },
    get indexedDB() { throw new Error('blocked'); },
    document: { cookie: '' }, location: { protocol: 'http:' },
  };
  expect(() => clearRetiredData(browser)).not.toThrow();
});
