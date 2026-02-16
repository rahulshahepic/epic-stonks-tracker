import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PortfolioProvider } from '../context/PortfolioContext';
import { createEmptyPortfolio } from '../models/portfolio';
import type { Portfolio } from '../models/portfolio';
import type { StorageProvider } from '../storage/storage-provider';
import type { StockGrant } from '../models/grant';
import type { Loan } from '../models/loan';

import { Layout } from '../components/Layout';
import { Dashboard } from '../components/Dashboard';
import { GrantsPage } from '../components/GrantsPage';
import { LoansPage } from '../components/LoansPage';
import { ConfigPage } from '../components/ConfigPage';
import App from '../App';

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
    <PortfolioProvider storage={storage}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </PortfolioProvider>
  );
}

// ── Sample data ────────────────────────────────────────────────

function samplePortfolio(): Portfolio {
  return {
    grants: [
      {
        id: 'g1',
        type: 'purchase',
        grantDate: '2024-01-01',
        totalShares: 100,
        pricePerShareAtGrant: 10,
        vestingSchedule: [
          {
            id: 't1',
            vestDate: '2024-06-01',
            numberOfShares: 50,
            taxTreatment: 'income',
          },
          {
            id: 't2',
            vestDate: '2025-06-01',
            numberOfShares: 50,
            taxTreatment: 'capital_gains',
          },
        ],
        notes: 'First grant',
      } as StockGrant,
    ],
    loans: [
      {
        id: 'l1',
        type: 'purchase',
        principalAmount: 1000,
        annualInterestRate: 0.04,
        originationDate: '2024-01-01',
        maturityDate: '2034-01-01',
        status: 'active',
        notes: 'First loan',
      } as Loan,
    ],
    stockPrices: [
      { date: '2024-01-01', pricePerShare: 10 },
      { date: '2025-01-01', pricePerShare: 20 },
    ],
  };
}

// ── Layout tests ───────────────────────────────────────────────

describe('Layout', () => {
  it('renders the app title', () => {
    renderWithProviders(
      <Layout />
    );
    expect(screen.getByText('Epic Stonks Tracker')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    renderWithProviders(
      <Layout />
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Grants')).toBeInTheDocument();
    expect(screen.getByText('Loans')).toBeInTheDocument();
    expect(screen.getByText('Config')).toBeInTheDocument();
  });

  it('navigation links are <a> elements', () => {
    renderWithProviders(
      <Layout />
    );
    const dashLink = screen.getByText('Dashboard');
    expect(dashLink.tagName).toBe('A');
  });
});

// ── Dashboard tests ────────────────────────────────────────────

describe('Dashboard', () => {
  it('shows loading state initially', () => {
    // Don't await; the provider hasn't resolved yet
    const storage = new MockStorageProvider();
    // Delay load to keep loading state
    storage.load = () => new Promise(() => {}); // never resolves
    render(
      <PortfolioProvider storage={storage}>
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      </PortfolioProvider>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders empty state when no data', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/No data yet/)).toBeInTheDocument();
    });
  });

  it('renders dashboard with data', async () => {
    renderWithProviders(<Dashboard />, { data: samplePortfolio() });

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Net Value Summary')).toBeInTheDocument();
    });

    // Should display stock price, vested shares, etc.
    expect(screen.getByText('Stock Price')).toBeInTheDocument();
    expect(screen.getByText('Vested Shares')).toBeInTheDocument();
    expect(screen.getByText('Unvested Shares')).toBeInTheDocument();
    expect(screen.getByText('Gross Share Value')).toBeInTheDocument();
  });

  it('renders grants breakdown table', async () => {
    renderWithProviders(<Dashboard />, { data: samplePortfolio() });

    await waitFor(() => {
      expect(screen.getByText('Grants Breakdown')).toBeInTheDocument();
    });
  });

  it('renders active loans table', async () => {
    renderWithProviders(<Dashboard />, { data: samplePortfolio() });

    await waitFor(() => {
      expect(screen.getByText('Active Loans')).toBeInTheDocument();
    });
  });

  it('allows changing as-of date', async () => {
    renderWithProviders(<Dashboard />, { data: samplePortfolio() });

    await waitFor(() => {
      expect(screen.getByLabelText('As of date:')).toBeInTheDocument();
    });

    const dateInput = screen.getByLabelText('As of date:');
    fireEvent.change(dateInput, { target: { value: '2024-07-01' } });
    // No error should occur
    expect(dateInput).toHaveValue('2024-07-01');
  });

  it('shows taxable events when present', async () => {
    const data = samplePortfolio();
    renderWithProviders(<Dashboard />, { data });

    await waitFor(() => {
      // The income event from t1 vesting at 2024-06-01 should show up
      expect(screen.getByText(/Taxable Events/)).toBeInTheDocument();
    });
  });
});

// ── GrantsPage tests ───────────────────────────────────────────

describe('GrantsPage', () => {
  it('shows loading state', () => {
    const storage = new MockStorageProvider();
    storage.load = () => new Promise(() => {});
    render(
      <PortfolioProvider storage={storage}>
        <MemoryRouter>
          <GrantsPage />
        </MemoryRouter>
      </PortfolioProvider>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    renderWithProviders(<GrantsPage />);
    await waitFor(() => {
      expect(screen.getByText('No grants added yet.')).toBeInTheDocument();
    });
  });

  it('renders grants list with data', async () => {
    renderWithProviders(<GrantsPage />, { data: samplePortfolio() });
    await waitFor(() => {
      expect(screen.getByText('Purchase')).toBeInTheDocument();
      expect(screen.getByText(/100 shares/)).toBeInTheDocument();
      expect(screen.getByText('First grant')).toBeInTheDocument();
    });
  });

  it('shows the Add Grant button', async () => {
    renderWithProviders(<GrantsPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Grant')).toBeInTheDocument();
    });
  });

  it('shows the grant form when Add Grant is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GrantsPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Grant')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Grant'));
    expect(screen.getByText('New Grant')).toBeInTheDocument();
    expect(screen.getByLabelText('Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Grant Date')).toBeInTheDocument();
    expect(screen.getByLabelText('Total Shares')).toBeInTheDocument();
  });

  it('can cancel the grant form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GrantsPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Grant')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Grant'));
    expect(screen.getByText('New Grant')).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByText('New Grant')).not.toBeInTheDocument();
  });

  it('shows validation errors on invalid submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GrantsPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Grant')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Grant'));

    // Submit without filling in anything (totalShares is 0, grantDate is empty, tranche has invalid data)
    // Note: there are two "Add Grant" - the page button and the form submit.
    // After clicking "Add Grant" button the first time, the form submit should be present.
    // Let's find the submit button specifically
    const formSubmit = screen.getAllByText('Add Grant').find(
      (el) => el.tagName === 'BUTTON' && el.closest('form')
    );
    expect(formSubmit).toBeDefined();
    await user.click(formSubmit!);

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/Grant date is required/)).toBeInTheDocument();
    });
  });

  it('can add a tranche and remove it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GrantsPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Grant')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Add Grant'));

    // Initially 1 tranche row
    expect(screen.getAllByLabelText(/Tranche \d+ vest date/)).toHaveLength(1);

    // Add another tranche
    await user.click(screen.getByText('Add Tranche'));
    expect(screen.getAllByLabelText(/Tranche \d+ vest date/)).toHaveLength(2);

    // Remove the first tranche
    const removeButtons = screen.getAllByText('Remove');
    await user.click(removeButtons[0]);
    expect(screen.getAllByLabelText(/Tranche \d+ vest date/)).toHaveLength(1);
  });

  it('can submit a valid grant and see it in the list', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GrantsPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Grant')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Add Grant'));

    // Fill in the form
    await user.selectOptions(screen.getByLabelText('Type'), 'purchase');
    fireEvent.change(screen.getByLabelText('Grant Date'), {
      target: { value: '2024-01-01' },
    });
    await user.type(screen.getByLabelText('Total Shares'), '100');
    await user.type(screen.getByLabelText('Price/Share at Grant ($)'), '10');

    // Fill in the tranche (use fireEvent for date inputs)
    fireEvent.change(screen.getByLabelText('Tranche 1 vest date'), {
      target: { value: '2025-01-01' },
    });
    await user.type(screen.getByLabelText('Tranche 1 shares'), '100');

    // Submit
    const formSubmit = screen.getAllByText('Add Grant').find(
      (el) => el.tagName === 'BUTTON' && el.closest('form')
    );
    await user.click(formSubmit!);

    // Form should close and grant should appear
    await waitFor(() => {
      expect(screen.queryByText('New Grant')).not.toBeInTheDocument();
      expect(screen.getByText('Purchase')).toBeInTheDocument();
      expect(screen.getByText(/100 shares/)).toBeInTheDocument();
    });
  });

  it('can edit a grant', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GrantsPage />, { data: samplePortfolio() });

    await waitFor(() => {
      expect(screen.getByText('Purchase')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Edit'));
    expect(screen.getByText('Edit Grant')).toBeInTheDocument();
    // Verify form is pre-filled
    expect(screen.getByLabelText('Grant Date')).toHaveValue('2024-01-01');
  });

  it('can submit an edited grant', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GrantsPage />, { data: samplePortfolio() });

    await waitFor(() => {
      expect(screen.getByText('Purchase')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Edit'));
    expect(screen.getByText('Edit Grant')).toBeInTheDocument();

    // Fill related grant id and notes
    await user.clear(screen.getByLabelText('Related Grant ID (optional)'));
    await user.type(screen.getByLabelText('Related Grant ID (optional)'), 'related-g');
    await user.clear(screen.getByLabelText('Notes'));
    await user.type(screen.getByLabelText('Notes'), 'Updated note');

    // Change tax treatment on first tranche
    const taxSelects = screen.getAllByLabelText(/Tranche \d+ tax treatment/);
    await user.selectOptions(taxSelects[0], 'capital_gains');

    // Submit
    const updateButton = screen.getByText('Update Grant');
    await user.click(updateButton);

    await waitFor(() => {
      expect(screen.queryByText('Edit Grant')).not.toBeInTheDocument();
      expect(screen.getByText('Updated note')).toBeInTheDocument();
    });
  });

  it('can delete a grant', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GrantsPage />, { data: samplePortfolio() });

    await waitFor(() => {
      expect(screen.getByText('Purchase')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Delete'));
    await waitFor(() => {
      expect(screen.getByText('No grants added yet.')).toBeInTheDocument();
    });
  });
});

// ── LoansPage tests ────────────────────────────────────────────

describe('LoansPage', () => {
  it('shows loading state', () => {
    const storage = new MockStorageProvider();
    storage.load = () => new Promise(() => {});
    render(
      <PortfolioProvider storage={storage}>
        <MemoryRouter>
          <LoansPage />
        </MemoryRouter>
      </PortfolioProvider>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    renderWithProviders(<LoansPage />);
    await waitFor(() => {
      expect(screen.getByText('No loans added yet.')).toBeInTheDocument();
    });
  });

  it('renders loans list with data', async () => {
    renderWithProviders(<LoansPage />, { data: samplePortfolio() });
    await waitFor(() => {
      expect(screen.getByText('Purchase')).toBeInTheDocument();
      expect(screen.getByText(/\$1,000/)).toBeInTheDocument();
      expect(screen.getByText('First loan')).toBeInTheDocument();
    });
  });

  it('shows the Add Loan button', async () => {
    renderWithProviders(<LoansPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Loan')).toBeInTheDocument();
    });
  });

  it('shows the loan form when Add Loan is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoansPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Loan')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Loan'));
    expect(screen.getByText('New Loan')).toBeInTheDocument();
    expect(screen.getByLabelText('Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Principal ($)')).toBeInTheDocument();
  });

  it('can cancel the loan form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoansPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Loan')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Loan'));
    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByText('New Loan')).not.toBeInTheDocument();
  });

  it('shows validation errors on invalid submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoansPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Loan')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Loan'));

    const formSubmit = screen.getAllByText('Add Loan').find(
      (el) => el.tagName === 'BUTTON' && el.closest('form')
    );
    await user.click(formSubmit!);

    await waitFor(() => {
      expect(screen.getByText(/Principal amount must be a positive number/)).toBeInTheDocument();
    });
  });

  it('can submit a valid loan and see it in the list', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoansPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Loan')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Add Loan'));

    await user.selectOptions(screen.getByLabelText('Type'), 'purchase');
    // Use fireEvent.change for number/date inputs to avoid controlled input reset issues
    fireEvent.change(screen.getByLabelText('Principal ($)'), {
      target: { value: '5000' },
    });
    fireEvent.change(screen.getByLabelText('Annual Interest Rate (decimal)'), {
      target: { value: '0.04' },
    });
    fireEvent.change(screen.getByLabelText('Origination Date'), {
      target: { value: '2024-01-01' },
    });
    fireEvent.change(screen.getByLabelText('Maturity Date'), {
      target: { value: '2034-01-01' },
    });

    const formSubmit = screen.getAllByText('Add Loan').find(
      (el) => el.tagName === 'BUTTON' && el.closest('form')
    );
    await user.click(formSubmit!);

    await waitFor(() => {
      expect(screen.queryByText('New Loan')).not.toBeInTheDocument();
      expect(screen.getByText('Purchase')).toBeInTheDocument();
      expect(screen.getByText(/\$5,000/)).toBeInTheDocument();
    });
  });

  it('can edit a loan', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoansPage />, { data: samplePortfolio() });

    await waitFor(() => {
      expect(screen.getByText('Purchase')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Edit'));
    expect(screen.getByText('Edit Loan')).toBeInTheDocument();
    expect(screen.getByLabelText('Principal ($)')).toHaveValue(1000);
  });

  it('can submit an edited loan', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoansPage />, { data: samplePortfolio() });

    await waitFor(() => {
      expect(screen.getByText('Purchase')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Edit'));
    expect(screen.getByText('Edit Loan')).toBeInTheDocument();

    // Change principal
    fireEvent.change(screen.getByLabelText('Principal ($)'), {
      target: { value: '2000' },
    });
    // Fill in optional fields to cover more code
    await user.type(screen.getByLabelText('Related Grant ID'), 'g1');
    await user.type(screen.getByLabelText('Parent Loan ID'), 'parent-loan');
    await user.type(screen.getByLabelText('Refinanced From ID'), 'old-loan');
    // Clear existing notes then type new ones
    await user.clear(screen.getByLabelText('Notes'));
    await user.type(screen.getByLabelText('Notes'), 'Updated loan');

    const updateButton = screen.getByText('Update Loan');
    await user.click(updateButton);

    await waitFor(() => {
      expect(screen.queryByText('Edit Loan')).not.toBeInTheDocument();
      expect(screen.getByText(/\$2,000/)).toBeInTheDocument();
      expect(screen.getByText('Updated loan')).toBeInTheDocument();
    });
  });

  it('can delete a loan', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoansPage />, { data: samplePortfolio() });

    await waitFor(() => {
      expect(screen.getByText('Purchase')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Delete'));
    await waitFor(() => {
      expect(screen.getByText('No loans added yet.')).toBeInTheDocument();
    });
  });
});

// ── ConfigPage tests ───────────────────────────────────────────

describe('ConfigPage', () => {
  it('shows loading state', () => {
    const storage = new MockStorageProvider();
    storage.load = () => new Promise(() => {});
    render(
      <PortfolioProvider storage={storage}>
        <MemoryRouter>
          <ConfigPage />
        </MemoryRouter>
      </PortfolioProvider>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders stock prices section', async () => {
    renderWithProviders(<ConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Stock Prices')).toBeInTheDocument();
    });
  });

  it('renders import/export section', async () => {
    renderWithProviders(<ConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Import / Export')).toBeInTheDocument();
    });
  });

  it('renders empty stock prices state', async () => {
    renderWithProviders(<ConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('No stock prices entered.')).toBeInTheDocument();
    });
  });

  it('renders stock prices table with data', async () => {
    renderWithProviders(<ConfigPage />, { data: samplePortfolio() });
    await waitFor(() => {
      expect(screen.getByText('2024-01-01')).toBeInTheDocument();
      expect(screen.getByText('$10.00')).toBeInTheDocument();
      expect(screen.getByText('2025-01-01')).toBeInTheDocument();
      expect(screen.getByText('$20.00')).toBeInTheDocument();
    });
  });

  it('can add a new stock price', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Stock Prices')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Stock price date'), {
      target: { value: '2025-06-01' },
    });
    await user.type(screen.getByLabelText('Price per share'), '30');
    await user.click(screen.getByText('Add / Update'));

    await waitFor(() => {
      expect(screen.getByText('2025-06-01')).toBeInTheDocument();
      expect(screen.getByText('$30.00')).toBeInTheDocument();
    });
  });

  it('shows validation errors for invalid stock price', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Stock Prices')).toBeInTheDocument();
    });

    // Submit without filling fields
    await user.click(screen.getByText('Add / Update'));

    await waitFor(() => {
      expect(screen.getByText(/Date is required/)).toBeInTheDocument();
    });
  });

  it('can update an existing stock price for same date', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfigPage />, { data: samplePortfolio() });
    await waitFor(() => {
      expect(screen.getByText('$10.00')).toBeInTheDocument();
    });

    // Add a price with the same date to trigger update
    fireEvent.change(screen.getByLabelText('Stock price date'), {
      target: { value: '2024-01-01' },
    });
    await user.type(screen.getByLabelText('Price per share'), '99');
    await user.click(screen.getByText('Add / Update'));

    await waitFor(() => {
      expect(screen.getByText('$99.00')).toBeInTheDocument();
      // Should still have 2 prices (not 3)
    });
  });

  it('can delete a stock price', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfigPage />, { data: samplePortfolio() });
    await waitFor(() => {
      expect(screen.getByText('2024-01-01')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText('$10.00')).not.toBeInTheDocument();
    });
  });

  it('has export button', async () => {
    renderWithProviders(<ConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Export JSON')).toBeInTheDocument();
    });
  });

  it('has import button', async () => {
    renderWithProviders(<ConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Import JSON')).toBeInTheDocument();
    });
  });

  it('has clear all data button', async () => {
    renderWithProviders(<ConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Clear All Data')).toBeInTheDocument();
    });
  });

  it('clear all data asks for confirmation', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderWithProviders(<ConfigPage />, { data: samplePortfolio() });
    await waitFor(() => {
      expect(screen.getByText('Clear All Data')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clear All Data'));
    expect(confirmSpy).toHaveBeenCalledWith('Clear all data? This cannot be undone.');

    confirmSpy.mockRestore();
  });

  it('clear all data works when confirmed', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithProviders(<ConfigPage />, { data: samplePortfolio() });
    await waitFor(() => {
      expect(screen.getByText('2024-01-01')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Clear All Data'));

    await waitFor(() => {
      expect(screen.getByText('No stock prices entered.')).toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it('has hidden file input for import', async () => {
    renderWithProviders(<ConfigPage />);
    await waitFor(() => {
      expect(screen.getByLabelText('Import file input')).toBeInTheDocument();
    });
    const fileInput = screen.getByLabelText('Import file input');
    expect(fileInput).toHaveStyle({ display: 'none' });
  });

  it('export button triggers download', async () => {
    const user = userEvent.setup();
    // Mock URL.createObjectURL and URL.revokeObjectURL
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
    URL.revokeObjectURL = vi.fn();

    renderWithProviders(<ConfigPage />, { data: samplePortfolio() });
    await waitFor(() => {
      expect(screen.getByText('Export JSON')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export JSON'));

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();

    // Restore
    URL.createObjectURL = origCreateObjectURL;
    URL.revokeObjectURL = origRevokeObjectURL;
  });

  it('import button triggers file input click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Import JSON')).toBeInTheDocument();
    });

    const fileInput = screen.getByLabelText('Import file input') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');

    await user.click(screen.getByText('Import JSON'));
    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
  });

  it('handles file import with valid JSON', async () => {
    renderWithProviders(<ConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Stock Prices')).toBeInTheDocument();
    });

    const validPortfolio = {
      grants: [],
      loans: [],
      stockPrices: [{ date: '2025-03-01', pricePerShare: 42 }],
    };
    const file = new File([JSON.stringify(validPortfolio)], 'test.json', {
      type: 'application/json',
    });

    const fileInput = screen.getByLabelText('Import file input');
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      // Wait for FileReader to complete
      await new Promise((r) => setTimeout(r, 100));
    });

    await waitFor(() => {
      expect(screen.getByText('Portfolio imported successfully.')).toBeInTheDocument();
    });
  });

  it('handles file import with invalid JSON', async () => {
    renderWithProviders(<ConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Stock Prices')).toBeInTheDocument();
    });

    const file = new File(['{bad json!!!'], 'test.json', {
      type: 'application/json',
    });

    const fileInput = screen.getByLabelText('Import file input');
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      await new Promise((r) => setTimeout(r, 100));
    });

    await waitFor(() => {
      expect(screen.getByText(/Invalid JSON/)).toBeInTheDocument();
    });
  });

  it('handles file import with validation warnings', async () => {
    renderWithProviders(<ConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Stock Prices')).toBeInTheDocument();
    });

    const dataWithWarnings = {
      grants: [{ id: 'bad', totalShares: -1 }], // invalid grant
      loans: [],
      stockPrices: [{ date: '2025-06-01', pricePerShare: 50 }],
    };
    const file = new File([JSON.stringify(dataWithWarnings)], 'test.json', {
      type: 'application/json',
    });

    const fileInput = screen.getByLabelText('Import file input');
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
      await new Promise((r) => setTimeout(r, 100));
    });

    await waitFor(() => {
      expect(screen.getByText(/Imported with warnings/)).toBeInTheDocument();
    });
  });

  it('handles file import with no file selected', async () => {
    renderWithProviders(<ConfigPage />);
    await waitFor(() => {
      expect(screen.getByText('Stock Prices')).toBeInTheDocument();
    });

    const fileInput = screen.getByLabelText('Import file input');
    // Fire change with no files - should not crash
    fireEvent.change(fileInput, { target: { files: [] } });
    // No error message should appear
    expect(screen.queryByText(/Invalid JSON/)).not.toBeInTheDocument();
  });
});

// ── App tests ──────────────────────────────────────────────────

describe('App', () => {
  it('renders the full application', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Epic Stonks Tracker')).toBeInTheDocument();
    });
  });

  it('renders dashboard by default', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });
});
