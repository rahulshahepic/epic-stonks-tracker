import { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { createShareExchange, validateShareExchange, GRANT_TYPE_LABELS } from '../models';
import type { ShareExchange } from '../models';

function emptyForm(): Omit<ShareExchange, 'id'> {
  return {
    date: '',
    sourceGrantId: '',
    targetGrantId: '',
    sharesExchanged: 0,
    pricePerShareAtExchange: 0,
    valueAtExchange: 0,
    notes: '',
  };
}

export function ShareExchangesPage() {
  const { portfolio, dispatch, loading } = usePortfolio();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState<string[]>([]);

  if (loading) return <p>Loading...</p>;

  function handleEdit(exchange: ShareExchange) {
    setEditingId(exchange.id);
    setForm({
      date: exchange.date,
      sourceGrantId: exchange.sourceGrantId,
      targetGrantId: exchange.targetGrantId,
      sharesExchanged: exchange.sharesExchanged,
      pricePerShareAtExchange: exchange.pricePerShareAtExchange,
      valueAtExchange: exchange.valueAtExchange,
      notes: exchange.notes ?? '',
    });
    setShowForm(true);
    setErrors([]);
  }

  function handleDelete(id: string) {
    dispatch({ type: 'DELETE_SHARE_EXCHANGE', exchangeId: id });
  }

  function updateSharesOrPrice(
    shares: number,
    price: number
  ): Omit<ShareExchange, 'id'> {
    return {
      ...form,
      sharesExchanged: shares,
      pricePerShareAtExchange: price,
      valueAtExchange: shares * price,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      ...form,
      valueAtExchange: form.sharesExchanged * form.pricePerShareAtExchange,
      notes: form.notes || undefined,
    };
    const validationErrors = validateShareExchange(data);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (editingId) {
      dispatch({
        type: 'UPDATE_SHARE_EXCHANGE',
        exchange: { id: editingId, ...data } as ShareExchange,
      });
    } else {
      dispatch({
        type: 'ADD_SHARE_EXCHANGE',
        exchange: createShareExchange(data as Omit<ShareExchange, 'id'>),
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

  function grantLabel(id: string): string {
    const g = portfolio.grants.find((gr) => gr.id === id);
    if (!g) return id.slice(0, 8);
    return `${GRANT_TYPE_LABELS[g.type]} (${g.grantDate})`;
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Share Exchanges</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            Add Exchange
          </button>
        )}
      </div>

      <p className="note" style={{ marginBottom: '1rem' }}>
        Share exchanges let you use vested shares as a down payment for new
        purchases. This is not a sale — no taxable event occurs.
      </p>

      {showForm && (
        <form onSubmit={handleSubmit} className="card form">
          <h3>{editingId ? 'Edit Exchange' : 'New Exchange'}</h3>

          {errors.length > 0 && (
            <div className="error-list">
              {errors.map((err, i) => (
                <p key={i} className="error">{err}</p>
              ))}
            </div>
          )}

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="exDate">Date</label>
              <input
                id="exDate"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="exSource">Source Grant (shares from)</label>
              <select
                id="exSource"
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
              <label htmlFor="exTarget">Target Grant (down payment for)</label>
              <select
                id="exTarget"
                value={form.targetGrantId}
                onChange={(e) =>
                  setForm({ ...form, targetGrantId: e.target.value })
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
              <label htmlFor="exShares">Shares Exchanged</label>
              <input
                id="exShares"
                type="number"
                min="0"
                step="1"
                value={form.sharesExchanged || ''}
                onChange={(e) => {
                  const f = updateSharesOrPrice(
                    Number(e.target.value),
                    form.pricePerShareAtExchange
                  );
                  setForm(f);
                }}
              />
            </div>
            <div className="form-field">
              <label htmlFor="exPrice">Price/Share at Exchange ($)</label>
              <input
                id="exPrice"
                type="number"
                min="0"
                step="0.01"
                value={form.pricePerShareAtExchange || ''}
                onChange={(e) => {
                  const f = updateSharesOrPrice(
                    form.sharesExchanged,
                    Number(e.target.value)
                  );
                  setForm(f);
                }}
              />
            </div>
            <div className="form-field">
              <label>Total Value</label>
              <input
                type="text"
                value={`$${(form.sharesExchanged * form.pricePerShareAtExchange).toLocaleString()}`}
                readOnly
                className="input-readonly"
              />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="exNotes">Notes</label>
              <input
                id="exNotes"
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Update' : 'Add Exchange'}
            </button>
            <button type="button" onClick={resetForm} className="btn">
              Cancel
            </button>
          </div>
        </form>
      )}

      {portfolio.shareExchanges.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#8644;</div>
          <p>No share exchanges recorded yet.</p>
        </div>
      ) : (
        <div className="card-list">
          {portfolio.shareExchanges.map((ex) => (
            <div key={ex.id} className="card">
              <div className="card-header">
                <strong>Share Exchange</strong>
                <span className="card-date">{ex.date}</span>
              </div>
              <div className="card-body">
                <p>
                  {ex.sharesExchanged} shares @ ${ex.pricePerShareAtExchange.toFixed(2)}
                  {' = '}${ex.valueAtExchange.toLocaleString()}
                </p>
                <p className="text-muted">
                  From: {grantLabel(ex.sourceGrantId)} &rarr; To:{' '}
                  {grantLabel(ex.targetGrantId)}
                </p>
                {ex.notes && <p className="note">{ex.notes}</p>}
              </div>
              <div className="card-actions">
                <button
                  onClick={() => handleEdit(ex)}
                  className="btn btn-small"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(ex.id)}
                  className="btn btn-small btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
