import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PortfolioProvider } from '../context/PortfolioContext';
import { createEmptyPortfolio } from '../models/portfolio';
import type { Portfolio } from '../models/portfolio';
import type { StorageProvider } from '../storage/storage-provider';
import type { StockGrant } from '../models/grant';
import type { Loan } from '../models/loan';
import type { ProgramConfig } from '../models/program-config';
import type { ShareExchange } from '../models/share-exchange';
import type { StockSale } from '../models/stock-sale';

import { ProgramConfigPage } from '../components/ProgramConfigPage';
import { ShareExchangesPage } from '../components/ShareExchangesPage';
import { StockSalesPage } from '../components/StockSalesPage';
import { ProjectionsPanel } from '../components/ProjectionsPanel';
import { AiImportHelper } from '../components/AiImportHelper';
import { PortfolioCharts } from '../components/PortfolioCharts';
import { ThemeProvider } from '../context/ThemeContext';

// ── Mock Storage ───────────────────────────────────────────────

class MockStorageProvider implements StorageProvider {
  private data: Portfolio;

  constructor(data?: Portfolio) {
    this.data = data ?? createEmptyPortfolio();
  }

  async load(): Promise<Portfolio> {
    return this.data;
  }

  async save(p: Portfolio): Promise<void> {
    this.data = p;
  }

  async clear(): Promise<void> {
    this.data = createEmptyPortfolio();
  }
}

// ── Render helper ──────────────────────────────────────────────

function renderWithProviders(
  ui: React.ReactElement,
  options?: { data?: Portfolio; route?: string }
) {
  const storage = new MockStorageProvider(options?.data);
  const route = options?.route ?? '/';

  return render(
    <ThemeProvider>
      <PortfolioProvider storage={storage}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </PortfolioProvider>
    </ThemeProvider>
  );
}

// ── Sample data ────────────────────────────────────────────────

const sampleGrant: StockGrant = {
  id: 'g1',
  type: 'purchase',
  grantDate: '2024-01-01',
  totalShares: 100,
  pricePerShareAtGrant: 10,
  vestingSchedule: [
    { id: 't1', vestDate: '2024-06-01', numberOfShares: 50, taxTreatment: 'income' },
    { id: 't2', vestDate: '2025-06-01', numberOfShares: 50, taxTreatment: 'capital_gains' },
  ],
  notes: 'First grant',
};

const sampleGrant2: StockGrant = {
  id: 'g2',
  type: 'free',
  grantDate: '2024-01-01',
  totalShares: 50,
  pricePerShareAtGrant: 10,
  vestingSchedule: [
    { id: 't3', vestDate: '2025-01-01', numberOfShares: 50, taxTreatment: 'income' },
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

const sampleConfig: ProgramConfig = {
  id: 'pc1',
  name: '2024 Stock Purchase Program',
  programYear: 2024,
  standardInterestRate: 0.04,
  standardLoanTermYears: 10,
  downPaymentPercent: 0.1,
  shareExchangeAvailable: true,
  freeShareRatio: 0.5,
  catchUpShareRatio: 0.5,
  grantTemplates: {
    purchase: {
      vestingYears: 5,
      vestingTemplate: [
        { yearOffset: 1, shareFraction: 0.5, taxTreatment: 'none' },
        { yearOffset: 2, shareFraction: 0.5, taxTreatment: 'capital_gains' },
      ],
    },
  },
  notes: 'Test config',
};

const sampleExchange: ShareExchange = {
  id: 'ex1',
  date: '2024-06-15',
  sourceGrantId: 'g1',
  targetGrantId: 'g2',
  sharesExchanged: 10,
  pricePerShareAtExchange: 15,
  valueAtExchange: 150,
  notes: 'Down payment exchange',
};

const sampleSale: StockSale = {
  id: 's1',
  date: '2025-01-15',
  sourceGrantId: 'g1',
  sharesSold: 20,
  pricePerShare: 25,
  totalProceeds: 500,
  costBasis: 10,
  reason: 'voluntary',
  notes: 'Test sale',
};

function portfolioWithConfigs(): Portfolio {
  return {
    ...createEmptyPortfolio(),
    grants: [sampleGrant, sampleGrant2],
    loans: [sampleLoan],
    stockPrices: [
      { date: '2024-01-01', pricePerShare: 10 },
      { date: '2025-01-01', pricePerShare: 20 },
    ],
    programConfigs: [sampleConfig],
    shareExchanges: [],
    stockSales: [],
  };
}

function portfolioWithExchanges(): Portfolio {
  return {
    ...portfolioWithConfigs(),
    shareExchanges: [sampleExchange],
  };
}

function portfolioWithSales(): Portfolio {
  return {
    ...portfolioWithConfigs(),
    stockSales: [sampleSale],
  };
}

// ── ProgramConfigPage tests ──────────────────────────────────

describe('ProgramConfigPage', () => {
  it('shows loading state', () => {
    const storage = new MockStorageProvider();
    storage.load = () => new Promise(() => {});
    render(
      <PortfolioProvider storage={storage}>
        <MemoryRouter>
          <ProgramConfigPage />
        </MemoryRouter>
      </PortfolioProvider>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    renderWithProviders(<ProgramConfigPage />);
    await waitFor(() => {
      expect(screen.getByText(/No program configs yet/)).toBeInTheDocument();
    });
  });

  it('renders config list with data', async () => {
    renderWithProviders(<ProgramConfigPage />, { data: portfolioWithConfigs() });
    await waitFor(() => {
      expect(screen.getByText('2024 Stock Purchase Program')).toBeInTheDocument();
      expect(screen.getByText('2024')).toBeInTheDocument();
      expect(screen.getByText(/Rate: 4.0%/)).toBeInTheDocument();
      expect(screen.getByText(/Term: 10yr/)).toBeInTheDocument();
      expect(screen.getByText('Test config')).toBeInTheDocument();
    });
  });

  it('shows Add Program button', async () => {
    renderWithProviders(<ProgramConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Program')).toBeInTheDocument();
    });
  });

  it('shows form when Add Program is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProgramConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Program')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Program'));
    expect(screen.getByText('New Program')).toBeInTheDocument();
    expect(screen.getByLabelText('Program Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Program Year')).toBeInTheDocument();
    expect(screen.getByLabelText('Interest Rate (decimal)')).toBeInTheDocument();
  });

  it('can cancel the form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProgramConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Program')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Program'));
    expect(screen.getByText('New Program')).toBeInTheDocument();
    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByText('New Program')).not.toBeInTheDocument();
  });

  it('shows validation errors on invalid submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProgramConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Program')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Program'));

    // Clear the pre-filled name
    await user.clear(screen.getByLabelText('Program Name'));

    // Submit with empty name
    const formSubmit = screen.getAllByText('Add Program').find(
      (el) => el.tagName === 'BUTTON' && el.closest('form')
    );
    await user.click(formSubmit!);

    await waitFor(() => {
      expect(screen.getByText(/Program name is required/)).toBeInTheDocument();
    });
  });

  it('can submit a valid config', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProgramConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Program')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Program'));

    // Fill in the form (defaults are pre-filled, just modify name)
    await user.clear(screen.getByLabelText('Program Name'));
    await user.type(screen.getByLabelText('Program Name'), 'My Program');

    // Ensure year is set
    fireEvent.change(screen.getByLabelText('Program Year'), {
      target: { value: '2025' },
    });

    const formSubmit = screen.getAllByText('Add Program').find(
      (el) => el.tagName === 'BUTTON' && el.closest('form')
    );
    await user.click(formSubmit!);

    await waitFor(() => {
      expect(screen.queryByText('New Program')).not.toBeInTheDocument();
      expect(screen.getByText('My Program')).toBeInTheDocument();
    });
  });

  it('can edit a config', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProgramConfigPage />, { data: portfolioWithConfigs() });

    await waitFor(() => {
      expect(screen.getByText('2024 Stock Purchase Program')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Edit'));
    expect(screen.getByText('Edit Program')).toBeInTheDocument();
    expect(screen.getByLabelText('Program Name')).toHaveValue('2024 Stock Purchase Program');
  });

  it('can submit an edited config', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProgramConfigPage />, { data: portfolioWithConfigs() });

    await waitFor(() => {
      expect(screen.getByText('2024 Stock Purchase Program')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Edit'));

    await user.clear(screen.getByLabelText('Program Name'));
    await user.type(screen.getByLabelText('Program Name'), 'Updated Program');

    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(screen.queryByText('Edit Program')).not.toBeInTheDocument();
      expect(screen.getByText('Updated Program')).toBeInTheDocument();
    });
  });

  it('can delete a config', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProgramConfigPage />, { data: portfolioWithConfigs() });

    await waitFor(() => {
      expect(screen.getByText('2024 Stock Purchase Program')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Delete'));
    await waitFor(() => {
      expect(screen.getByText(/No program configs yet/)).toBeInTheDocument();
    });
  });

  it('displays vesting templates in form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProgramConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Program')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Program'));

    // Default form has grantTemplates populated
    expect(screen.getByText('Vesting Templates')).toBeInTheDocument();
    expect(screen.getByText('Purchase')).toBeInTheDocument();
  });

  it('can change share exchange availability', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProgramConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Program')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Program'));
    const select = screen.getByLabelText('Share Exchange Available');
    await user.selectOptions(select, 'no');
    expect(select).toHaveValue('no');
  });

  it('can change free share ratio', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProgramConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Program')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Program'));
    const input = screen.getByLabelText('Free Share Ratio');
    fireEvent.change(input, { target: { value: '0.75' } });
    expect(input).toHaveValue(0.75);
  });

  it('can change catch-up share ratio', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProgramConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Program')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Program'));
    const input = screen.getByLabelText('Catch-up Share Ratio');
    fireEvent.change(input, { target: { value: '0.3' } });
    expect(input).toHaveValue(0.3);
  });

  it('can fill notes field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProgramConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Program')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Program'));
    const notesInput = screen.getByLabelText('Notes');
    await user.type(notesInput, 'Some notes');
    expect(notesInput).toHaveValue('Some notes');
  });
});

// ── ShareExchangesPage tests ──────────────────────────────────

describe('ShareExchangesPage', () => {
  it('shows loading state', () => {
    const storage = new MockStorageProvider();
    storage.load = () => new Promise(() => {});
    render(
      <PortfolioProvider storage={storage}>
        <MemoryRouter>
          <ShareExchangesPage />
        </MemoryRouter>
      </PortfolioProvider>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    renderWithProviders(<ShareExchangesPage />);
    await waitFor(() => {
      expect(screen.getByText(/No share exchanges recorded yet/)).toBeInTheDocument();
    });
  });

  it('renders exchange list with data', async () => {
    renderWithProviders(<ShareExchangesPage />, { data: portfolioWithExchanges() });
    await waitFor(() => {
      expect(screen.getByText('Share Exchange')).toBeInTheDocument();
      expect(screen.getByText(/10 shares/)).toBeInTheDocument();
      expect(screen.getByText('Down payment exchange')).toBeInTheDocument();
    });
  });

  it('shows Add Exchange button', async () => {
    renderWithProviders(<ShareExchangesPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Exchange')).toBeInTheDocument();
    });
  });

  it('shows the exchange info note', async () => {
    renderWithProviders(<ShareExchangesPage />);
    await waitFor(() => {
      expect(screen.getByText(/not a sale — no taxable event/)).toBeInTheDocument();
    });
  });

  it('shows form when Add Exchange is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShareExchangesPage />, { data: portfolioWithConfigs() });
    await waitFor(() => {
      expect(screen.getByText('Add Exchange')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Exchange'));
    expect(screen.getByText('New Exchange')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByLabelText(/Source Grant/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Target Grant/)).toBeInTheDocument();
  });

  it('can cancel the form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShareExchangesPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Exchange')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Exchange'));
    expect(screen.getByText('New Exchange')).toBeInTheDocument();
    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByText('New Exchange')).not.toBeInTheDocument();
  });

  it('shows validation errors on invalid submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShareExchangesPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Exchange')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Exchange'));

    const formSubmit = screen.getAllByText('Add Exchange').find(
      (el) => el.tagName === 'BUTTON' && el.closest('form')
    );
    await user.click(formSubmit!);

    await waitFor(() => {
      expect(screen.getByText(/Exchange date is required/)).toBeInTheDocument();
    });
  });

  it('can submit a valid exchange', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShareExchangesPage />, { data: portfolioWithConfigs() });
    await waitFor(() => {
      expect(screen.getByText('Add Exchange')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Exchange'));

    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2024-07-01' },
    });

    // Select source and target grants
    await user.selectOptions(screen.getByLabelText(/Source Grant/), 'g1');
    await user.selectOptions(screen.getByLabelText(/Target Grant/), 'g2');

    fireEvent.change(screen.getByLabelText('Shares Exchanged'), {
      target: { value: '5' },
    });
    fireEvent.change(screen.getByLabelText(/Price\/Share at Exchange/), {
      target: { value: '20' },
    });

    const formSubmit = screen.getAllByText('Add Exchange').find(
      (el) => el.tagName === 'BUTTON' && el.closest('form')
    );
    await user.click(formSubmit!);

    await waitFor(() => {
      expect(screen.queryByText('New Exchange')).not.toBeInTheDocument();
      expect(screen.getByText(/5 shares/)).toBeInTheDocument();
    });
  });

  it('can edit an exchange', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShareExchangesPage />, { data: portfolioWithExchanges() });

    await waitFor(() => {
      expect(screen.getByText('Share Exchange')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Edit'));
    expect(screen.getByText('Edit Exchange')).toBeInTheDocument();
  });

  it('can submit an edited exchange', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShareExchangesPage />, { data: portfolioWithExchanges() });

    await waitFor(() => {
      expect(screen.getByText('Share Exchange')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Edit'));

    // Change notes
    await user.clear(screen.getByLabelText('Notes'));
    await user.type(screen.getByLabelText('Notes'), 'Updated notes');

    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(screen.queryByText('Edit Exchange')).not.toBeInTheDocument();
      expect(screen.getByText('Updated notes')).toBeInTheDocument();
    });
  });

  it('can delete an exchange', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShareExchangesPage />, { data: portfolioWithExchanges() });

    await waitFor(() => {
      expect(screen.getByText('Share Exchange')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Delete'));
    await waitFor(() => {
      expect(screen.getByText(/No share exchanges recorded yet/)).toBeInTheDocument();
    });
  });

  it('auto-calculates total value', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ShareExchangesPage />, { data: portfolioWithConfigs() });
    await waitFor(() => {
      expect(screen.getByText('Add Exchange')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Exchange'));

    fireEvent.change(screen.getByLabelText('Shares Exchanged'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText(/Price\/Share at Exchange/), {
      target: { value: '20' },
    });

    // Total value should be auto-calculated as $200
    const totalValueInput = screen.getByDisplayValue('$200');
    expect(totalValueInput).toBeInTheDocument();
  });
});

// ── StockSalesPage tests ──────────────────────────────────────

describe('StockSalesPage', () => {
  it('shows loading state', () => {
    const storage = new MockStorageProvider();
    storage.load = () => new Promise(() => {});
    render(
      <PortfolioProvider storage={storage}>
        <MemoryRouter>
          <StockSalesPage />
        </MemoryRouter>
      </PortfolioProvider>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    renderWithProviders(<StockSalesPage />);
    await waitFor(() => {
      expect(screen.getByText(/No stock sales recorded yet/)).toBeInTheDocument();
    });
  });

  it('renders sales list with data', async () => {
    renderWithProviders(<StockSalesPage />, { data: portfolioWithSales() });
    await waitFor(() => {
      expect(screen.getByText('Voluntary')).toBeInTheDocument();
      expect(screen.getByText(/20 shares/)).toBeInTheDocument();
      expect(screen.getByText('Test sale')).toBeInTheDocument();
    });
  });

  it('shows summary stats when sales exist', async () => {
    renderWithProviders(<StockSalesPage />, { data: portfolioWithSales() });
    await waitFor(() => {
      expect(screen.getByText('Shares Sold')).toBeInTheDocument();
      expect(screen.getByText('Total Proceeds')).toBeInTheDocument();
      expect(screen.getByText('Realized Gains')).toBeInTheDocument();
    });
  });

  it('shows Record Sale button', async () => {
    renderWithProviders(<StockSalesPage />);
    await waitFor(() => {
      expect(screen.getByText('Record Sale')).toBeInTheDocument();
    });
  });

  it('shows form when Record Sale is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StockSalesPage />, { data: portfolioWithConfigs() });
    await waitFor(() => {
      expect(screen.getByText('Record Sale')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Record Sale'));
    expect(screen.getByLabelText('Sale Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Source Grant')).toBeInTheDocument();
    expect(screen.getByLabelText('Shares Sold')).toBeInTheDocument();
    expect(screen.getByLabelText(/Price\/Share/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cost Basis/)).toBeInTheDocument();
    expect(screen.getByLabelText('Reason')).toBeInTheDocument();
  });

  it('can cancel the form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StockSalesPage />);
    await waitFor(() => {
      expect(screen.getByText('Record Sale')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Record Sale'));
    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByLabelText('Sale Date')).not.toBeInTheDocument();
  });

  it('shows validation errors on invalid submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StockSalesPage />);
    await waitFor(() => {
      expect(screen.getByText('Record Sale')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Record Sale'));

    const formSubmit = screen.getAllByText('Record Sale').find(
      (el) => el.tagName === 'BUTTON' && el.closest('form')
    );
    await user.click(formSubmit!);

    await waitFor(() => {
      expect(screen.getByText(/Sale date is required/)).toBeInTheDocument();
    });
  });

  it('can submit a valid sale', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StockSalesPage />, { data: portfolioWithConfigs() });
    await waitFor(() => {
      expect(screen.getByText('Record Sale')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Record Sale'));

    fireEvent.change(screen.getByLabelText('Sale Date'), {
      target: { value: '2025-02-01' },
    });
    await user.selectOptions(screen.getByLabelText('Source Grant'), 'g1');
    fireEvent.change(screen.getByLabelText('Shares Sold'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText(/Price\/Share/), {
      target: { value: '30' },
    });
    fireEvent.change(screen.getByLabelText(/Cost Basis/), {
      target: { value: '10' },
    });

    const formSubmit = screen.getAllByText('Record Sale').find(
      (el) => el.tagName === 'BUTTON' && el.closest('form')
    );
    await user.click(formSubmit!);

    await waitFor(() => {
      expect(screen.getByText(/10 shares/)).toBeInTheDocument();
    });
  });

  it('shows Related Loan field when reason is loan_payoff', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StockSalesPage />, { data: portfolioWithConfigs() });
    await waitFor(() => {
      expect(screen.getByText('Record Sale')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Record Sale'));

    // Change reason to loan_payoff
    await user.selectOptions(screen.getByLabelText('Reason'), 'loan_payoff');

    // Related Loan field should appear
    expect(screen.getByLabelText('Related Loan')).toBeInTheDocument();
  });

  it('can edit a sale', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StockSalesPage />, { data: portfolioWithSales() });

    await waitFor(() => {
      expect(screen.getByText('Voluntary')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Edit'));
    expect(screen.getByText('Edit Sale')).toBeInTheDocument();
  });

  it('can submit an edited sale', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StockSalesPage />, { data: portfolioWithSales() });

    await waitFor(() => {
      expect(screen.getByText('Voluntary')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Edit'));

    await user.clear(screen.getByLabelText('Notes'));
    await user.type(screen.getByLabelText('Notes'), 'Updated sale');

    await user.click(screen.getByText('Update'));

    await waitFor(() => {
      expect(screen.queryByText('Edit Sale')).not.toBeInTheDocument();
      expect(screen.getByText('Updated sale')).toBeInTheDocument();
    });
  });

  it('can delete a sale', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StockSalesPage />, { data: portfolioWithSales() });

    await waitFor(() => {
      expect(screen.getByText('Voluntary')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Delete'));
    await waitFor(() => {
      expect(screen.getByText(/No stock sales recorded yet/)).toBeInTheDocument();
    });
  });

  it('shows capital gain calculation in form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StockSalesPage />, { data: portfolioWithConfigs() });
    await waitFor(() => {
      expect(screen.getByText('Record Sale')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Record Sale'));

    fireEvent.change(screen.getByLabelText('Shares Sold'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText(/Price\/Share/), {
      target: { value: '30' },
    });
    fireEvent.change(screen.getByLabelText(/Cost Basis/), {
      target: { value: '10' },
    });

    // Capital gain = 10 * (30 - 10) = $200
    expect(screen.getByDisplayValue('$200')).toBeInTheDocument();
  });
});

// ── ProjectionsPanel tests ────────────────────────────────────

describe('ProjectionsPanel', () => {
  it('returns null when no stock prices', () => {
    const portfolio = createEmptyPortfolio();
    const { container } = render(<ProjectionsPanel portfolio={portfolio} asOfDate="2025-01-01" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders collapsed by default', () => {
    const portfolio = portfolioWithConfigs();
    render(<ProjectionsPanel portfolio={portfolio} asOfDate="2025-01-01" />);
    expect(screen.getByText('Future Projections')).toBeInTheDocument();
    // Should show + indicator since it's collapsed
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('expands on click', async () => {
    const user = userEvent.setup();
    const portfolio = portfolioWithConfigs();
    render(<ProjectionsPanel portfolio={portfolio} asOfDate="2025-01-01" />);

    await user.click(screen.getByText('Future Projections'));

    // Should show year-by-year table
    expect(screen.getByText('Year')).toBeInTheDocument();
    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByText('Held')).toBeInTheDocument();
    expect(screen.getByText('Net Value')).toBeInTheDocument();
  });

  it('expands on Enter key', async () => {
    const portfolio = portfolioWithConfigs();
    render(<ProjectionsPanel portfolio={portfolio} asOfDate="2025-01-01" />);

    const header = screen.getByText('Future Projections').closest('[role="button"]')!;
    fireEvent.keyDown(header, { key: 'Enter' });

    expect(screen.getByText('Year')).toBeInTheDocument();
  });

  it('expands on Space key', async () => {
    const portfolio = portfolioWithConfigs();
    render(<ProjectionsPanel portfolio={portfolio} asOfDate="2025-01-01" />);

    const header = screen.getByText('Future Projections').closest('[role="button"]')!;
    fireEvent.keyDown(header, { key: ' ' });

    expect(screen.getByText('Year')).toBeInTheDocument();
  });

  it('allows changing growth rate', async () => {
    const user = userEvent.setup();
    const portfolio = portfolioWithConfigs();
    render(<ProjectionsPanel portfolio={portfolio} asOfDate="2025-01-01" />);

    await user.click(screen.getByText('Future Projections'));

    const growthSelect = screen.getByLabelText('Annual Growth Rate');
    await user.selectOptions(growthSelect, '0.12');
    expect(growthSelect).toHaveValue('0.12');
  });

  it('allows changing years ahead', async () => {
    const user = userEvent.setup();
    const portfolio = portfolioWithConfigs();
    render(<ProjectionsPanel portfolio={portfolio} asOfDate="2025-01-01" />);

    await user.click(screen.getByText('Future Projections'));

    const yearsSelect = screen.getByLabelText('Years Ahead');
    await user.selectOptions(yearsSelect, '5');
    expect(yearsSelect).toHaveValue('5');
  });

  it('collapses when clicked again', async () => {
    const user = userEvent.setup();
    const portfolio = portfolioWithConfigs();
    render(<ProjectionsPanel portfolio={portfolio} asOfDate="2025-01-01" />);

    // Expand
    await user.click(screen.getByText('Future Projections'));
    expect(screen.getByText('Year')).toBeInTheDocument();

    // Collapse
    await user.click(screen.getByText('Future Projections'));
    expect(screen.queryByText('Year')).not.toBeInTheDocument();
  });
});

// ── AiImportHelper tests ──────────────────────────────────────

describe('AiImportHelper', () => {
  it('renders collapsed initially', () => {
    render(<AiImportHelper />);
    expect(screen.getByText('Convert Data with AI')).toBeInTheDocument();
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('expands on click', async () => {
    const user = userEvent.setup();
    render(<AiImportHelper />);

    await user.click(screen.getByText('Convert Data with AI'));

    expect(screen.getByText(/Have stock or loan data/)).toBeInTheDocument();
    expect(screen.getByText('Copy Prompt')).toBeInTheDocument();
    expect(screen.getByText(/Step 1/)).toBeInTheDocument();
    expect(screen.getByText(/Step 2/)).toBeInTheDocument();
    expect(screen.getByText(/Step 3/)).toBeInTheDocument();
  });

  it('expands on Enter key', async () => {
    render(<AiImportHelper />);

    const header = screen.getByText('Convert Data with AI').closest('[role="button"]')!;
    fireEvent.keyDown(header, { key: 'Enter' });

    expect(screen.getByText('Copy Prompt')).toBeInTheDocument();
  });

  it('expands on Space key', async () => {
    render(<AiImportHelper />);

    const header = screen.getByText('Convert Data with AI').closest('[role="button"]')!;
    fireEvent.keyDown(header, { key: ' ' });

    expect(screen.getByText('Copy Prompt')).toBeInTheDocument();
  });

  it('copies prompt to clipboard', async () => {
    const user = userEvent.setup();

    // Mock clipboard using defineProperty to handle getter-only property
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<AiImportHelper />);
    await user.click(screen.getByText('Convert Data with AI'));
    await user.click(screen.getByText('Copy Prompt'));

    expect(writeTextMock).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('copies schema to clipboard', async () => {
    const user = userEvent.setup();

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<AiImportHelper />);
    await user.click(screen.getByText('Convert Data with AI'));

    // Open schema details
    const summary = screen.getByText('Schema reference');
    await user.click(summary);

    await user.click(screen.getByText('Copy Schema'));
    expect(writeTextMock).toHaveBeenCalled();
  });

  it('handles clipboard failure gracefully', async () => {
    const user = userEvent.setup();

    const writeTextMock = vi.fn().mockRejectedValue(new Error('Not allowed'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    render(<AiImportHelper />);
    await user.click(screen.getByText('Convert Data with AI'));
    await user.click(screen.getByText('Copy Prompt'));

    // Should not crash - the error is caught silently
    expect(writeTextMock).toHaveBeenCalled();
  });

  it('collapses when clicked again', async () => {
    const user = userEvent.setup();
    render(<AiImportHelper />);

    await user.click(screen.getByText('Convert Data with AI'));
    expect(screen.getByText('Copy Prompt')).toBeInTheDocument();

    await user.click(screen.getByText('Convert Data with AI'));
    expect(screen.queryByText('Copy Prompt')).not.toBeInTheDocument();
  });
});

// ── PortfolioCharts tests ──────────────────────────────────────

describe('PortfolioCharts', () => {
  it('returns null with fewer than 2 stock prices', () => {
    const portfolio: Portfolio = {
      ...createEmptyPortfolio(),
      stockPrices: [{ date: '2025-01-01', pricePerShare: 20 }],
    };
    const { container } = render(<PortfolioCharts portfolio={portfolio} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders stock price chart with 2+ prices', () => {
    const portfolio: Portfolio = {
      ...createEmptyPortfolio(),
      stockPrices: [
        { date: '2024-01-01', pricePerShare: 10 },
        { date: '2025-01-01', pricePerShare: 20 },
      ],
    };
    render(<PortfolioCharts portfolio={portfolio} />);
    expect(screen.getByText('Stock Price History')).toBeInTheDocument();
  });

  it('renders net value chart when grants and loans present', () => {
    const portfolio: Portfolio = {
      ...createEmptyPortfolio(),
      grants: [sampleGrant],
      loans: [sampleLoan],
      stockPrices: [
        { date: '2024-01-01', pricePerShare: 10 },
        { date: '2025-01-01', pricePerShare: 20 },
      ],
    };
    render(<PortfolioCharts portfolio={portfolio} />);
    expect(screen.getByText('Stock Price History')).toBeInTheDocument();
    expect(screen.getByText('Net Value Over Time')).toBeInTheDocument();
  });

  it('does not render net value chart without grants/loans', () => {
    const portfolio: Portfolio = {
      ...createEmptyPortfolio(),
      stockPrices: [
        { date: '2024-01-01', pricePerShare: 10 },
        { date: '2025-01-01', pricePerShare: 20 },
      ],
    };
    render(<PortfolioCharts portfolio={portfolio} />);
    expect(screen.getByText('Stock Price History')).toBeInTheDocument();
    expect(screen.queryByText('Net Value Over Time')).not.toBeInTheDocument();
  });

  it('sorts stock prices by date', () => {
    const portfolio: Portfolio = {
      ...createEmptyPortfolio(),
      stockPrices: [
        { date: '2025-01-01', pricePerShare: 20 },
        { date: '2024-01-01', pricePerShare: 10 },
        { date: '2024-06-01', pricePerShare: 15 },
      ],
    };
    render(<PortfolioCharts portfolio={portfolio} />);
    expect(screen.getByText('Stock Price History')).toBeInTheDocument();
  });
});
