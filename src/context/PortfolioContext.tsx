import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { Portfolio, StockGrant, Loan, StockPrice } from '../models';
import { createEmptyPortfolio } from '../models';
import type { StorageProvider } from '../storage';

// ── Actions ─────────────────────────────────────────────────────

export type PortfolioAction =
  | { type: 'SET_PORTFOLIO'; portfolio: Portfolio }
  | { type: 'ADD_GRANT'; grant: StockGrant }
  | { type: 'UPDATE_GRANT'; grant: StockGrant }
  | { type: 'DELETE_GRANT'; grantId: string }
  | { type: 'ADD_LOAN'; loan: Loan }
  | { type: 'UPDATE_LOAN'; loan: Loan }
  | { type: 'DELETE_LOAN'; loanId: string }
  | { type: 'ADD_STOCK_PRICE'; price: StockPrice }
  | { type: 'UPDATE_STOCK_PRICE'; oldDate: string; price: StockPrice }
  | { type: 'DELETE_STOCK_PRICE'; date: string }
  | { type: 'CLEAR_ALL' };

// ── Reducer ─────────────────────────────────────────────────────

export function portfolioReducer(
  state: Portfolio,
  action: PortfolioAction
): Portfolio {
  switch (action.type) {
    case 'SET_PORTFOLIO':
      return action.portfolio;

    case 'ADD_GRANT':
      return { ...state, grants: [...state.grants, action.grant] };

    case 'UPDATE_GRANT':
      return {
        ...state,
        grants: state.grants.map((g) =>
          g.id === action.grant.id ? action.grant : g
        ),
      };

    case 'DELETE_GRANT':
      return {
        ...state,
        grants: state.grants.filter((g) => g.id !== action.grantId),
      };

    case 'ADD_LOAN':
      return { ...state, loans: [...state.loans, action.loan] };

    case 'UPDATE_LOAN':
      return {
        ...state,
        loans: state.loans.map((l) =>
          l.id === action.loan.id ? action.loan : l
        ),
      };

    case 'DELETE_LOAN':
      return {
        ...state,
        loans: state.loans.filter((l) => l.id !== action.loanId),
      };

    case 'ADD_STOCK_PRICE':
      return {
        ...state,
        stockPrices: [...state.stockPrices, action.price].sort((a, b) =>
          a.date < b.date ? -1 : a.date > b.date ? 1 : 0
        ),
      };

    case 'UPDATE_STOCK_PRICE':
      return {
        ...state,
        stockPrices: state.stockPrices
          .map((p) => (p.date === action.oldDate ? action.price : p))
          .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
      };

    case 'DELETE_STOCK_PRICE':
      return {
        ...state,
        stockPrices: state.stockPrices.filter((p) => p.date !== action.date),
      };

    case 'CLEAR_ALL':
      return createEmptyPortfolio();

    default:
      return state;
  }
}

// ── Context ─────────────────────────────────────────────────────

interface PortfolioContextValue {
  portfolio: Portfolio;
  dispatch: Dispatch<PortfolioAction>;
  loading: boolean;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

interface PortfolioProviderProps {
  children: ReactNode;
  storage: StorageProvider;
}

export function PortfolioProvider({
  children,
  storage,
}: PortfolioProviderProps) {
  const [portfolio, dispatch] = useReducer(
    portfolioReducer,
    createEmptyPortfolio()
  );
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    storage.load().then((data) => {
      dispatch({ type: 'SET_PORTFOLIO', portfolio: data });
      setLoading(false);
      setInitialized(true);
    });
  }, [storage]);

  // Save to storage on every change (after initial load)
  useEffect(() => {
    if (initialized) {
      storage.save(portfolio);
    }
  }, [portfolio, storage, initialized]);

  return (
    <PortfolioContext.Provider value={{ portfolio, dispatch, loading }}>
      {children}
    </PortfolioContext.Provider>
  );
}

/** Hook to access the portfolio context. Must be used within a PortfolioProvider. */
export function usePortfolio(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext);
  if (!ctx) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return ctx;
}
