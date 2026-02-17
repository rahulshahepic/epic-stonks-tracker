import type { StockGrant } from './grant';
import type { Loan } from './loan';
import type { StockPrice } from './stock-price';
import type { ProgramConfig } from './program-config';
import type { ShareExchange } from './share-exchange';
import type { StockSale } from './stock-sale';

/** Top-level container for all user data. */
export interface Portfolio {
  grants: StockGrant[];
  loans: Loan[];
  stockPrices: StockPrice[];
  programConfigs: ProgramConfig[];
  shareExchanges: ShareExchange[];
  stockSales: StockSale[];
}

/** Create a new empty portfolio. */
export function createEmptyPortfolio(): Portfolio {
  return {
    grants: [],
    loans: [],
    stockPrices: [],
    programConfigs: [],
    shareExchanges: [],
    stockSales: [],
  };
}
