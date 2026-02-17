import { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import {
  createStockSale,
  validateStockSale,
  SALE_REASONS,
  SALE_REASON_LABELS,
  GRANT_TYPE_LABELS,
  LOAN_TYPE_LABELS,
} from '../models';
import type { StockSale, SaleReason } from '../models';

function emptyForm(): Omit<StockSale, 'id'> {
  return {
    date: '',
    sourceGrantId: '',
    sharesSold: 0,
    pricePerShare: 0,
    totalProceeds: 0,
    costBasis: 0,
    reason: 'voluntary',
    relatedLoanId: '',
    notes: '',
  };
}

export function StockSalesPage() {
  const { portfolio, dispatch, loading } = usePortfolio();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState<string[]>([]);

  if (loading) return <p>Loading...</p>;

  function handleEdit(sale: StockSale) {
    setEditingId(sale.id);
    setForm({
      date: sale.date,
      sourceGrantId: sale.sourceGrantId,
      sharesSold: sale.sharesSold,
      pricePerShare: sale.pricePerShare,
      totalProceeds: sale.totalProceeds,
      costBasis: sale.costBasis,
      reason: sale.reason,
      relatedLoanId: sale.relatedLoanId ?? '',
      notes: sale.notes ?? '',
    });
    setShowForm(true);
    setErrors([]);
  }

  function handleDelete(id: string) {
    dispatch({ type: 'DELETE_STOCK_SALE', saleId: id });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      ...form,
      totalProceeds: form.sharesSold * form.pricePerShare,
      relatedLoanId: form.relatedLoanId || undefined,
      notes: form.notes || undefined,
    };
    const validationErrors = validateStockSale(data);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (editingId) {
      dispatch({
        type: 'UPDATE_STOCK_SALE',
        sale: { id: editingId, ...data } as StockSale,
      });
    } else {
      dispatch({
        type: 'ADD_STOCK_SALE',
        sale: createStockSale(data as Omit<StockSale, 'id'>),
      });
    }
    resetForm();
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setErrors([]);
  }

  const capitalGain =
    form.sharesSold * (form.pricePerShare - form.costBasis);

  const totalSoldShares = portfolio.stockSales.reduce(
    (s, sale) => s + sale.sharesSold,
    0
  );
  const totalProceeds = portfolio.stockSales.reduce(
    (s, sale) => s + sale.totalProceeds,
    0
  );
  const totalRealizedGains = portfolio.stockSales.reduce(
    (s, sale) =>
      s + (sale.pricePerShare - sale.costBasis) * sale.sharesSold,
    0
  );

  return (
    <div className="page">
      <div className="page-header">
        <h2>Stock Sales</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            Record Sale
          </button>
        )}
      </div>

      {/* Summary stats */}
      {portfolio.stockSales.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: '1rem' }}>
          <div className="stat">
            <span className="stat-label">Shares Sold</span>
            <span className="stat-value">{totalSoldShares.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Total Proceeds</span>
            <span className="stat-value">
              ${totalProceeds.toLocaleString()}
            </span>
          </div>
          <div className="stat stat--highlight">
            <span className="stat-label">Realized Gains</span>
            <span
              className={`stat-value ${totalRealizedGains >= 0 ? 'positive' : 'negative'}`}
            >
              ${totalRealizedGains.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card form">
          <h3>{editingId ? 'Edit Sale' : 'Record Sale'}</h3>

          {errors.length > 0 && (
            <div className="error-list">
              {errors.map((err, i) => (
                <p key={i} className="error">{err}</p>
              ))}
            </div>
          )}

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="saleDate">Sale Date</label>
              <input
                id="saleDate"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="saleGrant">Source Grant</label>
              <select
                id="saleGrant"
                value={form.sourceGrantId}
                onChange={(e) =>
                  setForm({ ...form, sourceGrantId: e.target.value })
                }
              >
                <option value="">Select grant...</option>
                {portfolio.grants.map((g) => (
                  <option key={g.id} value={g.id}>
                    {GRANT_TYPE_LABELS[g.type]} — {g.grantDate} ({g.totalShares} shares)
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="saleShares">Shares Sold</label>
              <input
                id="saleShares"
                type="number"
                min="0"
                step="1"
                value={form.sharesSold || ''}
                onChange={(e) =>
                  setForm({ ...form, sharesSold: Number(e.target.value) })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="salePrice">Price/Share ($)</label>
              <input
                id="salePrice"
                type="number"
                min="0"
                step="0.01"
                value={form.pricePerShare || ''}
                onChange={(e) =>
                  setForm({ ...form, pricePerShare: Number(e.target.value) })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="saleBasis">Cost Basis/Share ($)</label>
              <input
                id="saleBasis"
                type="number"
                min="0"
                step="0.01"
                value={form.costBasis || ''}
                onChange={(e) =>
                  setForm({ ...form, costBasis: Number(e.target.value) })
                }
                placeholder="Price at grant or vest"
              />
            </div>
            <div className="form-field">
              <label htmlFor="saleReason">Reason</label>
              <select
                id="saleReason"
                value={form.reason}
                onChange={(e) =>
                  setForm({ ...form, reason: e.target.value as SaleReason })
                }
              >
                {SALE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {SALE_REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            {(form.reason === 'loan_payoff') && (
              <div className="form-field">
                <label htmlFor="saleLoan">Related Loan</label>
                <select
                  id="saleLoan"
                  value={form.relatedLoanId}
                  onChange={(e) =>
                    setForm({ ...form, relatedLoanId: e.target.value })
                  }
                >
                  <option value="">Select loan...</option>
                  {portfolio.loans.map((l) => (
                    <option key={l.id} value={l.id}>
                      {LOAN_TYPE_LABELS[l.type]} — ${l.principalAmount.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="form-field">
              <label>Capital Gain</label>
              <input
                type="text"
                value={`$${capitalGain.toLocaleString()}`}
                readOnly
                className="input-readonly"
              />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="saleNotes">Notes</label>
              <input
                id="saleNotes"
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Update' : 'Record Sale'}
            </button>
            <button type="button" onClick={resetForm} className="btn">
              Cancel
            </button>
          </div>
        </form>
      )}

      {portfolio.stockSales.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">$</div>
          <p>No stock sales recorded yet.</p>
        </div>
      ) : (
        <div className="card-list">
          {portfolio.stockSales.map((sale) => {
            const gain =
              (sale.pricePerShare - sale.costBasis) * sale.sharesSold;
            return (
              <div key={sale.id} className="card">
                <div className="card-header">
                  <strong>{SALE_REASON_LABELS[sale.reason]}</strong>
                  <span className="card-date">{sale.date}</span>
                </div>
                <div className="card-body">
                  <p>
                    {sale.sharesSold} shares @ ${sale.pricePerShare.toFixed(2)}
                    {' = '}${sale.totalProceeds.toLocaleString()}
                  </p>
                  <p>
                    Cost basis: ${sale.costBasis.toFixed(2)}/share &middot;{' '}
                    <span className={gain >= 0 ? 'positive' : 'negative'}>
                      Gain: ${gain.toLocaleString()}
                    </span>
                  </p>
                  {sale.notes && <p className="note">{sale.notes}</p>}
                </div>
                <div className="card-actions">
                  <button
                    onClick={() => handleEdit(sale)}
                    className="btn btn-small"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(sale.id)}
                    className="btn btn-small btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
