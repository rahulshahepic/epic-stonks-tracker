import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import {
  portfolioReducer,
  PortfolioProvider,
  usePortfolio,
} from '../context/PortfolioContext';
import type { PortfolioAction } from '../context/PortfolioContext';
import { createEmptyPortfolio } from '../models/portfolio';
import type { Portfolio } from '../models/portfolio';
import type { StockGrant } from '../models/grant';
import type { Loan } from '../models/loan';
import type { StockPrice } from '../models/stock-price';
import type { StorageProvider } from '../storage/storage-provider';

// ── Mock Storage ───────────────────────────────────────────────

class MockStorageProvider implements StorageProvider {
  private data: Portfolio;
  saveCalled = 0;
  loadCalled = 0;

  constructor(data?: Portfolio) {
    this.data = data ?? createEmptyPortfolio();
  }

  async load(): Promise<Portfolio> {
    this.loadCalled++;
    return this.data;
  }

  async save(p: Portfolio): Promise<void> {
    this.saveCalled++;
    this.data = p;
  }

  async clear(): Promise<void> {
    this.data = createEmptyPortfolio();
  }
}

// ── Reducer tests ──────────────────────────────────────────────

describe('portfolioReducer', () => {
  let state: Portfolio;

  const sampleGrant: StockGrant = {
    id: 'g1',
    type: 'purchase',
    grantDate: '2024-01-01',
    totalShares: 100,
    pricePerShareAtGrant: 10,
    vestingSchedule: [
      { id: 't1', vestDate: '2025-01-01', numberOfShares: 100, taxTreatment: 'income' },
    ],
  };

  const sampleLoan: Loan = {
    id: 'l1',
    type: 'purchase',
    principalAmount: 1000,
    annualInterestRate: 0.04,
    originationDate: '2024-01-01',
    maturityDate: '2034-01-01',
    status: 'active',
  };

  const samplePrice: StockPrice = { date: '2024-06-01', pricePerShare: 15 };

  beforeEach(() => {
    state = createEmptyPortfolio();
  });

  it('SET_PORTFOLIO replaces entire state', () => {
    const newPortfolio: Portfolio = {
      ...createEmptyPortfolio(),
      grants: [sampleGrant],
      loans: [sampleLoan],
      stockPrices: [samplePrice],
    };
    const result = portfolioReducer(state, {
      type: 'SET_PORTFOLIO',
      portfolio: newPortfolio,
    });
    expect(result).toEqual(newPortfolio);
  });

  it('ADD_GRANT appends a grant', () => {
    const result = portfolioReducer(state, {
      type: 'ADD_GRANT',
      grant: sampleGrant,
    });
    expect(result.grants).toHaveLength(1);
    expect(result.grants[0]).toEqual(sampleGrant);
    // Does not mutate original
    expect(state.grants).toHaveLength(0);
  });

  it('UPDATE_GRANT updates an existing grant', () => {
    state = { ...state, grants: [sampleGrant] };
    const updated = { ...sampleGrant, totalShares: 200 };
    const result = portfolioReducer(state, {
      type: 'UPDATE_GRANT',
      grant: updated,
    });
    expect(result.grants).toHaveLength(1);
    expect(result.grants[0].totalShares).toBe(200);
  });

  it('UPDATE_GRANT does not change grants with different id', () => {
    const other: StockGrant = { ...sampleGrant, id: 'g2', totalShares: 50 };
    state = { ...state, grants: [sampleGrant, other] };
    const updated = { ...sampleGrant, totalShares: 999 };
    const result = portfolioReducer(state, {
      type: 'UPDATE_GRANT',
      grant: updated,
    });
    expect(result.grants).toHaveLength(2);
    expect(result.grants.find((g) => g.id === 'g1')?.totalShares).toBe(999);
    expect(result.grants.find((g) => g.id === 'g2')?.totalShares).toBe(50);
  });

  it('DELETE_GRANT removes a grant by id', () => {
    state = { ...state, grants: [sampleGrant] };
    const result = portfolioReducer(state, {
      type: 'DELETE_GRANT',
      grantId: 'g1',
    });
    expect(result.grants).toHaveLength(0);
  });

  it('DELETE_GRANT does nothing if id not found', () => {
    state = { ...state, grants: [sampleGrant] };
    const result = portfolioReducer(state, {
      type: 'DELETE_GRANT',
      grantId: 'nonexistent',
    });
    expect(result.grants).toHaveLength(1);
  });

  it('ADD_LOAN appends a loan', () => {
    const result = portfolioReducer(state, {
      type: 'ADD_LOAN',
      loan: sampleLoan,
    });
    expect(result.loans).toHaveLength(1);
    expect(result.loans[0]).toEqual(sampleLoan);
  });

  it('UPDATE_LOAN updates an existing loan', () => {
    state = { ...state, loans: [sampleLoan] };
    const updated = { ...sampleLoan, principalAmount: 5000 };
    const result = portfolioReducer(state, {
      type: 'UPDATE_LOAN',
      loan: updated,
    });
    expect(result.loans).toHaveLength(1);
    expect(result.loans[0].principalAmount).toBe(5000);
  });

  it('DELETE_LOAN removes a loan by id', () => {
    state = { ...state, loans: [sampleLoan] };
    const result = portfolioReducer(state, {
      type: 'DELETE_LOAN',
      loanId: 'l1',
    });
    expect(result.loans).toHaveLength(0);
  });

  it('ADD_STOCK_PRICE appends and sorts', () => {
    state = {
      ...state,
      stockPrices: [{ date: '2025-01-01', pricePerShare: 20 }],
    };
    const result = portfolioReducer(state, {
      type: 'ADD_STOCK_PRICE',
      price: { date: '2024-06-01', pricePerShare: 15 },
    });
    expect(result.stockPrices).toHaveLength(2);
    expect(result.stockPrices[0].date).toBe('2024-06-01');
    expect(result.stockPrices[1].date).toBe('2025-01-01');
  });

  it('UPDATE_STOCK_PRICE updates price for a given date', () => {
    state = {
      ...state,
      stockPrices: [
        { date: '2024-01-01', pricePerShare: 10 },
        { date: '2025-01-01', pricePerShare: 20 },
      ],
    };
    const result = portfolioReducer(state, {
      type: 'UPDATE_STOCK_PRICE',
      oldDate: '2024-01-01',
      price: { date: '2024-01-01', pricePerShare: 12 },
    });
    expect(result.stockPrices).toHaveLength(2);
    expect(result.stockPrices.find((p) => p.date === '2024-01-01')?.pricePerShare).toBe(12);
  });

  it('UPDATE_STOCK_PRICE can change the date and re-sorts', () => {
    state = {
      ...state,
      stockPrices: [
        { date: '2024-01-01', pricePerShare: 10 },
        { date: '2025-01-01', pricePerShare: 20 },
      ],
    };
    const result = portfolioReducer(state, {
      type: 'UPDATE_STOCK_PRICE',
      oldDate: '2024-01-01',
      price: { date: '2025-06-01', pricePerShare: 30 },
    });
    expect(result.stockPrices).toHaveLength(2);
    expect(result.stockPrices[0].date).toBe('2025-01-01');
    expect(result.stockPrices[1].date).toBe('2025-06-01');
  });

  it('DELETE_STOCK_PRICE removes a price by date', () => {
    state = {
      ...state,
      stockPrices: [
        { date: '2024-01-01', pricePerShare: 10 },
        { date: '2025-01-01', pricePerShare: 20 },
      ],
    };
    const result = portfolioReducer(state, {
      type: 'DELETE_STOCK_PRICE',
      date: '2024-01-01',
    });
    expect(result.stockPrices).toHaveLength(1);
    expect(result.stockPrices[0].date).toBe('2025-01-01');
  });

  // ── Program Config actions ────────────────────────

  const sampleConfig = {
    id: 'pc1',
    name: '2024 Program',
    programYear: 2024,
    standardInterestRate: 0.04,
    standardLoanTermYears: 10,
    downPaymentPercent: 0.1,
    shareExchangeAvailable: true,
    freeShareRatio: 0.5,
    catchUpShareRatio: 0.5,
    grantTemplates: {},
  };

  it('ADD_PROGRAM_CONFIG appends a config', () => {
    const result = portfolioReducer(state, {
      type: 'ADD_PROGRAM_CONFIG',
      config: sampleConfig,
    });
    expect(result.programConfigs).toHaveLength(1);
    expect(result.programConfigs[0]).toEqual(sampleConfig);
  });

  it('UPDATE_PROGRAM_CONFIG updates an existing config', () => {
    state = { ...state, programConfigs: [sampleConfig] };
    const updated = { ...sampleConfig, name: 'Updated Program' };
    const result = portfolioReducer(state, {
      type: 'UPDATE_PROGRAM_CONFIG',
      config: updated,
    });
    expect(result.programConfigs).toHaveLength(1);
    expect(result.programConfigs[0].name).toBe('Updated Program');
  });

  it('DELETE_PROGRAM_CONFIG removes a config by id', () => {
    state = { ...state, programConfigs: [sampleConfig] };
    const result = portfolioReducer(state, {
      type: 'DELETE_PROGRAM_CONFIG',
      configId: 'pc1',
    });
    expect(result.programConfigs).toHaveLength(0);
  });

  // ── Share Exchange actions ──────────────────────

  const sampleExchange = {
    id: 'ex1',
    date: '2024-06-01',
    sourceGrantId: 'g1',
    targetGrantId: 'g2',
    sharesExchanged: 10,
    pricePerShareAtExchange: 15,
    valueAtExchange: 150,
  };

  it('ADD_SHARE_EXCHANGE appends an exchange', () => {
    const result = portfolioReducer(state, {
      type: 'ADD_SHARE_EXCHANGE',
      exchange: sampleExchange,
    });
    expect(result.shareExchanges).toHaveLength(1);
    expect(result.shareExchanges[0]).toEqual(sampleExchange);
  });

  it('UPDATE_SHARE_EXCHANGE updates an existing exchange', () => {
    state = { ...state, shareExchanges: [sampleExchange] };
    const updated = { ...sampleExchange, sharesExchanged: 20 };
    const result = portfolioReducer(state, {
      type: 'UPDATE_SHARE_EXCHANGE',
      exchange: updated,
    });
    expect(result.shareExchanges).toHaveLength(1);
    expect(result.shareExchanges[0].sharesExchanged).toBe(20);
  });

  it('DELETE_SHARE_EXCHANGE removes an exchange by id', () => {
    state = { ...state, shareExchanges: [sampleExchange] };
    const result = portfolioReducer(state, {
      type: 'DELETE_SHARE_EXCHANGE',
      exchangeId: 'ex1',
    });
    expect(result.shareExchanges).toHaveLength(0);
  });

  // ── Stock Sale actions ──────────────────────────

  const sampleSale = {
    id: 's1',
    date: '2025-01-01',
    sourceGrantId: 'g1',
    sharesSold: 20,
    pricePerShare: 25,
    totalProceeds: 500,
    costBasis: 10,
    reason: 'voluntary' as const,
  };

  it('ADD_STOCK_SALE appends a sale', () => {
    const result = portfolioReducer(state, {
      type: 'ADD_STOCK_SALE',
      sale: sampleSale,
    });
    expect(result.stockSales).toHaveLength(1);
    expect(result.stockSales[0]).toEqual(sampleSale);
  });

  it('UPDATE_STOCK_SALE updates an existing sale', () => {
    state = { ...state, stockSales: [sampleSale] };
    const updated = { ...sampleSale, sharesSold: 30 };
    const result = portfolioReducer(state, {
      type: 'UPDATE_STOCK_SALE',
      sale: updated,
    });
    expect(result.stockSales).toHaveLength(1);
    expect(result.stockSales[0].sharesSold).toBe(30);
  });

  it('DELETE_STOCK_SALE removes a sale by id', () => {
    state = { ...state, stockSales: [sampleSale] };
    const result = portfolioReducer(state, {
      type: 'DELETE_STOCK_SALE',
      saleId: 's1',
    });
    expect(result.stockSales).toHaveLength(0);
  });

  it('CLEAR_ALL resets to empty portfolio', () => {
    state = {
      ...createEmptyPortfolio(),
      grants: [sampleGrant],
      loans: [sampleLoan],
      stockPrices: [samplePrice],
    };
    const result = portfolioReducer(state, { type: 'CLEAR_ALL' });
    expect(result).toEqual(createEmptyPortfolio());
  });

  it('default action returns current state', () => {
    const result = portfolioReducer(state, {
      type: 'UNKNOWN_ACTION' as PortfolioAction['type'],
    } as PortfolioAction);
    expect(result).toBe(state);
  });
});

// ── PortfolioProvider + usePortfolio tests ──────────────────────

describe('PortfolioProvider and usePortfolio', () => {
  it('provides portfolio context to children', async () => {
    const storage = new MockStorageProvider();

    function TestComponent() {
      const { portfolio, loading } = usePortfolio();
      if (loading) return <p>Loading...</p>;
      return <p data-testid="grants-count">{portfolio.grants.length}</p>;
    }

    render(
      <PortfolioProvider storage={storage}>
        <TestComponent />
      </PortfolioProvider>
    );

    // Initially loading
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // After load completes
    await waitFor(() => {
      expect(screen.getByTestId('grants-count')).toHaveTextContent('0');
    });
  });

  it('loads initial data from storage', async () => {
    const initialData: Portfolio = {
      ...createEmptyPortfolio(),
      grants: [
        {
          id: 'g1',
          type: 'purchase',
          grantDate: '2024-01-01',
          totalShares: 100,
          pricePerShareAtGrant: 10,
          vestingSchedule: [],
        },
      ],
      loans: [],
      stockPrices: [],
    };
    const storage = new MockStorageProvider(initialData);

    function TestComponent() {
      const { portfolio, loading } = usePortfolio();
      if (loading) return <p>Loading...</p>;
      return <p data-testid="grants-count">{portfolio.grants.length}</p>;
    }

    render(
      <PortfolioProvider storage={storage}>
        <TestComponent />
      </PortfolioProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('grants-count')).toHaveTextContent('1');
    });
  });

  it('dispatches actions and updates context', async () => {
    const storage = new MockStorageProvider();

    function TestComponent() {
      const { portfolio, dispatch, loading } = usePortfolio();
      if (loading) return <p>Loading...</p>;
      return (
        <div>
          <p data-testid="grants-count">{portfolio.grants.length}</p>
          <button
            onClick={() =>
              dispatch({
                type: 'ADD_GRANT',
                grant: {
                  id: 'new-g',
                  type: 'bonus',
                  grantDate: '2025-01-01',
                  totalShares: 50,
                  pricePerShareAtGrant: 20,
                  vestingSchedule: [],
                },
              })
            }
          >
            Add
          </button>
        </div>
      );
    }

    render(
      <PortfolioProvider storage={storage}>
        <TestComponent />
      </PortfolioProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('grants-count')).toHaveTextContent('0');
    });

    await act(async () => {
      screen.getByText('Add').click();
    });

    expect(screen.getByTestId('grants-count')).toHaveTextContent('1');
  });

  it('throws when usePortfolio is used outside PortfolioProvider', () => {
    function BadComponent() {
      usePortfolio();
      return <div />;
    }

    // Suppress error boundary console output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<BadComponent />)).toThrow(
      'usePortfolio must be used within a PortfolioProvider'
    );
    spy.mockRestore();
  });

  it('saves to storage after state changes', async () => {
    const storage = new MockStorageProvider();

    function TestComponent() {
      const { portfolio, dispatch, loading } = usePortfolio();
      if (loading) return <p>Loading...</p>;
      return (
        <div>
          <p data-testid="count">{portfolio.grants.length}</p>
          <button
            onClick={() =>
              dispatch({
                type: 'ADD_GRANT',
                grant: {
                  id: 'save-test-g',
                  type: 'free',
                  grantDate: '2025-01-01',
                  totalShares: 10,
                  pricePerShareAtGrant: 0,
                  vestingSchedule: [],
                },
              })
            }
          >
            Add
          </button>
        </div>
      );
    }

    render(
      <PortfolioProvider storage={storage}>
        <TestComponent />
      </PortfolioProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('0');
    });

    const saveBefore = storage.saveCalled;

    await act(async () => {
      screen.getByText('Add').click();
    });

    // Wait for save effect to fire
    await waitFor(() => {
      expect(storage.saveCalled).toBeGreaterThan(saveBefore);
    });
  });
});
