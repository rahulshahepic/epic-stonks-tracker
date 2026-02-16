import { createEmptyPortfolio } from '../models';
import type { Portfolio } from '../models';
import type { StorageProvider } from './storage-provider';

const DEFAULT_KEY = 'epic-stonks-portfolio';

/** StorageProvider backed by browser localStorage. */
export class LocalStorageProvider implements StorageProvider {
  private readonly key: string;

  constructor(key: string = DEFAULT_KEY) {
    this.key = key;
  }

  async load(): Promise<Portfolio> {
    const raw = localStorage.getItem(this.key);
    if (!raw) return createEmptyPortfolio();
    try {
      const parsed = JSON.parse(raw);
      return this.migrate(parsed);
    } catch {
      return createEmptyPortfolio();
    }
  }

  async save(portfolio: Portfolio): Promise<void> {
    localStorage.setItem(this.key, JSON.stringify(portfolio));
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.key);
  }

  /**
   * Migrate data from older schema versions if needed.
   * For now, just ensures all required fields exist.
   */
  private migrate(data: Record<string, unknown>): Portfolio {
    const empty = createEmptyPortfolio();
    return {
      grants: Array.isArray(data.grants) ? data.grants : empty.grants,
      loans: Array.isArray(data.loans) ? data.loans : empty.loans,
      stockPrices: Array.isArray(data.stockPrices)
        ? data.stockPrices
        : empty.stockPrices,
    };
  }
}
