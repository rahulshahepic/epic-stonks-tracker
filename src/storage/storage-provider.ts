import type { Portfolio } from '../models';

/**
 * Abstract storage interface for portfolio data.
 *
 * Implementations can target localStorage, Firestore, DynamoDB,
 * CosmosDB, Cloud SQL, etc. The app code depends only on this
 * interface, making it easy to swap backends.
 */
export interface StorageProvider {
  /** Load the portfolio from storage. Returns empty portfolio if none exists. */
  load(): Promise<Portfolio>;

  /** Save the entire portfolio to storage. */
  save(portfolio: Portfolio): Promise<void>;

  /** Delete all stored data. */
  clear(): Promise<void>;
}
