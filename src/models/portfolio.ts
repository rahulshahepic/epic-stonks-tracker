import type { StockGrant } from './grant';
import type { Loan } from './loan';
import type { StockPrice } from './stock-price';

/** Top-level container for all user data. */
export interface Portfolio {
  grants: StockGrant[];
  loans: Loan[];
  stockPrices: StockPrice[];
}

/** Create a new empty portfolio. */
export function createEmptyPortfolio(): Portfolio {
  return {
    grants: [],
    loans: [],
    stockPrices: [],
  };
}
