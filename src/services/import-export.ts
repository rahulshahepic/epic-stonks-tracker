import type { Portfolio } from '../models';
import {
  validateGrant,
  validateLoan,
  validateStockPrice,
  validateProgramConfig,
  validateShareExchange,
  validateStockSale,
} from '../models';
import { createEmptyPortfolio } from '../models';

export interface ImportResult {
  success: boolean;
  portfolio: Portfolio;
  warnings: string[];
  errors: string[];
}

/**
 * Parse and validate a JSON string as a Portfolio.
 * Returns the parsed portfolio along with any warnings or errors.
 */
export function importPortfolioFromJson(json: string): ImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return {
      success: false,
      portfolio: createEmptyPortfolio(),
      warnings: [],
      errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`],
    };
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {
      success: false,
      portfolio: createEmptyPortfolio(),
      warnings: [],
      errors: ['JSON must be an object with grants, loans, and stockPrices arrays.'],
    };
  }

  const data = raw as Record<string, unknown>;
  const portfolio = createEmptyPortfolio();

  // Parse grants
  if (Array.isArray(data.grants)) {
    for (let i = 0; i < data.grants.length; i++) {
      const grant = data.grants[i];
      const grantErrors = validateGrant(grant);
      if (grantErrors.length > 0) {
        warnings.push(`Grant ${i}: ${grantErrors.join('; ')}`);
      } else {
        portfolio.grants.push(grant);
      }
    }
  } else if (data.grants !== undefined) {
    warnings.push('grants field is not an array, skipping.');
  }

  // Parse loans
  if (Array.isArray(data.loans)) {
    for (let i = 0; i < data.loans.length; i++) {
      const loan = data.loans[i];
      const loanErrors = validateLoan(loan);
      if (loanErrors.length > 0) {
        warnings.push(`Loan ${i}: ${loanErrors.join('; ')}`);
      } else {
        portfolio.loans.push(loan);
      }
    }
  } else if (data.loans !== undefined) {
    warnings.push('loans field is not an array, skipping.');
  }

  // Parse stock prices
  if (Array.isArray(data.stockPrices)) {
    for (let i = 0; i < data.stockPrices.length; i++) {
      const price = data.stockPrices[i];
      const priceErrors = validateStockPrice(price);
      if (priceErrors.length > 0) {
        warnings.push(`Stock price ${i}: ${priceErrors.join('; ')}`);
      } else {
        portfolio.stockPrices.push(price);
      }
    }
  } else if (data.stockPrices !== undefined) {
    warnings.push('stockPrices field is not an array, skipping.');
  }

  // Parse program configs
  if (Array.isArray(data.programConfigs)) {
    for (let i = 0; i < data.programConfigs.length; i++) {
      const config = data.programConfigs[i];
      const configErrors = validateProgramConfig(config);
      if (configErrors.length > 0) {
        warnings.push(`Program config ${i}: ${configErrors.join('; ')}`);
      } else {
        portfolio.programConfigs.push(config);
      }
    }
  } else if (data.programConfigs !== undefined) {
    warnings.push('programConfigs field is not an array, skipping.');
  }

  // Parse share exchanges
  if (Array.isArray(data.shareExchanges)) {
    for (let i = 0; i < data.shareExchanges.length; i++) {
      const exchange = data.shareExchanges[i];
      const exchangeErrors = validateShareExchange(exchange);
      if (exchangeErrors.length > 0) {
        warnings.push(`Share exchange ${i}: ${exchangeErrors.join('; ')}`);
      } else {
        portfolio.shareExchanges.push(exchange);
      }
    }
  } else if (data.shareExchanges !== undefined) {
    warnings.push('shareExchanges field is not an array, skipping.');
  }

  // Parse stock sales
  if (Array.isArray(data.stockSales)) {
    for (let i = 0; i < data.stockSales.length; i++) {
      const sale = data.stockSales[i];
      const saleErrors = validateStockSale(sale);
      if (saleErrors.length > 0) {
        warnings.push(`Stock sale ${i}: ${saleErrors.join('; ')}`);
      } else {
        portfolio.stockSales.push(sale);
      }
    }
  } else if (data.stockSales !== undefined) {
    warnings.push('stockSales field is not an array, skipping.');
  }

  return {
    success: errors.length === 0,
    portfolio,
    warnings,
    errors,
  };
}

/** Export a portfolio to a formatted JSON string. */
export function exportPortfolioToJson(portfolio: Portfolio): string {
  return JSON.stringify(portfolio, null, 2);
}

/**
 * Merge an imported portfolio into an existing one.
 * New items are added; existing items (by ID) are updated.
 */
export function mergePortfolios(
  existing: Portfolio,
  incoming: Portfolio
): Portfolio {
  const mergedGrants = mergeById(existing.grants, incoming.grants);
  const mergedLoans = mergeById(existing.loans, incoming.loans);

  // Stock prices: merge by date (incoming overwrites existing for same date)
  const priceMap = new Map(existing.stockPrices.map((p) => [p.date, p]));
  for (const p of incoming.stockPrices) {
    priceMap.set(p.date, p);
  }
  const mergedPrices = Array.from(priceMap.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );

  return {
    grants: mergedGrants,
    loans: mergedLoans,
    stockPrices: mergedPrices,
    programConfigs: mergeById(
      existing.programConfigs ?? [],
      incoming.programConfigs ?? []
    ),
    shareExchanges: mergeById(
      existing.shareExchanges ?? [],
      incoming.shareExchanges ?? []
    ),
    stockSales: mergeById(
      existing.stockSales ?? [],
      incoming.stockSales ?? []
    ),
  };
}

function mergeById<T extends { id: string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const map = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}
