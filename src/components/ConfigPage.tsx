import { useState, useRef } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { validateStockPrice } from '../models';
import type { StockPrice } from '../models';
import {
  importPortfolioFromJson,
  exportPortfolioToJson,
  mergePortfolios,
} from '../services/import-export';

export function ConfigPage() {
  const { loading } = usePortfolio();

  if (loading) return <p>Loading...</p>;

  return (
    <div className="page">
      <h2>Configuration</h2>
      <StockPriceManager />
      <hr />
      <ImportExport />
    </div>
  );
}

// ── Stock Price Manager ─────────────────────────────────────────

function StockPriceManager() {
  const { portfolio, dispatch } = usePortfolio();
  const [date, setDate] = useState('');
  const [price, setPrice] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const priceEntry: StockPrice = {
      date,
      pricePerShare: Number(price),
    };
    const validationErrors = validateStockPrice(priceEntry);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Check if date already exists
    const existing = portfolio.stockPrices.find((p) => p.date === date);
    if (existing) {
      dispatch({
        type: 'UPDATE_STOCK_PRICE',
        oldDate: date,
        price: priceEntry,
      });
    } else {
      dispatch({ type: 'ADD_STOCK_PRICE', price: priceEntry });
    }

    setDate('');
    setPrice('');
    setErrors([]);
  }

  function handleDelete(d: string) {
    dispatch({ type: 'DELETE_STOCK_PRICE', date: d });
  }

  return (
    <section className="card">
      <h3>Stock Prices</h3>
      <p className="note">
        Enter historical stock prices. The most recent price on or before a date
        is used for calculations.
      </p>

      <form onSubmit={handleAdd} className="inline-form">
        {errors.length > 0 && (
          <div className="error-list">
            {errors.map((err, i) => (
              <p key={i} className="error">{err}</p>
            ))}
          </div>
        )}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Stock price date"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price per share"
          aria-label="Price per share"
        />
        <button type="submit" className="btn btn-primary btn-small">
          Add / Update
        </button>
      </form>

      {portfolio.stockPrices.length === 0 ? (
        <p className="empty-state">No stock prices entered.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Price/Share</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {portfolio.stockPrices.map((sp) => (
              <tr key={sp.date}>
                <td>{sp.date}</td>
                <td>${sp.pricePerShare.toFixed(2)}</td>
                <td>
                  <button
                    onClick={() => handleDelete(sp.date)}
                    className="btn btn-small btn-danger"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ── Import / Export ─────────────────────────────────────────────

function ImportExport() {
  const { portfolio, dispatch } = usePortfolio();
  const [importMsg, setImportMsg] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const json = exportPortfolioToJson(portfolio);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'epic-stonks-portfolio.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const json = evt.target?.result as string;
      const result = importPortfolioFromJson(json);

      if (result.errors.length > 0) {
        setImportMsg({ type: 'error', text: result.errors.join('\n') });
        return;
      }

      const merged = mergePortfolios(portfolio, result.portfolio);
      dispatch({ type: 'SET_PORTFOLIO', portfolio: merged });

      if (result.warnings.length > 0) {
        setImportMsg({
          type: 'warning',
          text: `Imported with warnings:\n${result.warnings.join('\n')}`,
        });
      } else {
        setImportMsg({ type: 'success', text: 'Portfolio imported successfully.' });
      }
    };
    reader.readAsText(file);

    // Reset file input so same file can be re-imported
    e.target.value = '';
  }

  function handleClearAll() {
    if (window.confirm('Clear all data? This cannot be undone.')) {
      dispatch({ type: 'CLEAR_ALL' });
    }
  }

  return (
    <section className="card">
      <h3>Import / Export</h3>
      <p className="note">
        Export your data as JSON to back it up, or import a JSON file
        (e.g., from the internal network config). Imported data merges
        with existing data.
      </p>

      <div className="button-row">
        <button onClick={handleExport} className="btn btn-primary">
          Export JSON
        </button>
        <button onClick={handleImport} className="btn">
          Import JSON
        </button>
        <button onClick={handleClearAll} className="btn btn-danger">
          Clear All Data
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        aria-label="Import file input"
      />

      {importMsg && (
        <div className={`message message--${importMsg.type}`}>
          <pre>{importMsg.text}</pre>
        </div>
      )}
    </section>
  );
}
