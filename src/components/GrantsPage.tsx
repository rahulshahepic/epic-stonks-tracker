import { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import {
  createGrant,
  createVestingTranche,
  validateGrant,
  GRANT_TYPES,
  GRANT_TYPE_LABELS,
  TAX_TREATMENT_LABELS,
} from '../models';
import type {
  StockGrant,
  VestingTranche,
  GrantType,
  TaxTreatment,
} from '../models';

const EMPTY_TRANCHE = {
  vestDate: '',
  numberOfShares: 0,
  taxTreatment: 'none' as TaxTreatment,
};

function emptyFormState(): Omit<StockGrant, 'id'> {
  return {
    type: 'purchase',
    grantDate: '',
    totalShares: 0,
    pricePerShareAtGrant: 0,
    vestingSchedule: [],
    relatedGrantId: '',
    notes: '',
  };
}

export function GrantsPage() {
  const { portfolio, dispatch, loading } = usePortfolio();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyFormState());
  const [tranches, setTranches] = useState<Omit<VestingTranche, 'id'>[]>([
    { ...EMPTY_TRANCHE },
  ]);
  const [errors, setErrors] = useState<string[]>([]);

  if (loading) return <p>Loading...</p>;

  function handleEdit(grant: StockGrant) {
    setEditingId(grant.id);
    setForm({
      type: grant.type,
      grantDate: grant.grantDate,
      totalShares: grant.totalShares,
      pricePerShareAtGrant: grant.pricePerShareAtGrant,
      vestingSchedule: grant.vestingSchedule,
      relatedGrantId: grant.relatedGrantId ?? '',
      notes: grant.notes ?? '',
    });
    setTranches(
      grant.vestingSchedule.map((t) => ({
        vestDate: t.vestDate,
        numberOfShares: t.numberOfShares,
        taxTreatment: t.taxTreatment,
      }))
    );
    setShowForm(true);
    setErrors([]);
  }

  function handleDelete(grantId: string) {
    dispatch({ type: 'DELETE_GRANT', grantId });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const vestingSchedule = tranches.map((t) =>
      createVestingTranche({
        vestDate: t.vestDate,
        numberOfShares: t.numberOfShares,
        taxTreatment: t.taxTreatment,
      })
    );

    const grantData = {
      ...form,
      vestingSchedule,
      relatedGrantId: form.relatedGrantId || undefined,
      notes: form.notes || undefined,
    };

    const validationErrors = validateGrant(grantData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (editingId) {
      dispatch({
        type: 'UPDATE_GRANT',
        grant: { id: editingId, ...grantData },
      });
    } else {
      dispatch({ type: 'ADD_GRANT', grant: createGrant(grantData) });
    }

    resetForm();
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyFormState());
    setTranches([{ ...EMPTY_TRANCHE }]);
    setErrors([]);
  }

  function addTranche() {
    setTranches([...tranches, { ...EMPTY_TRANCHE }]);
  }

  function removeTranche(idx: number) {
    setTranches(tranches.filter((_, i) => i !== idx));
  }

  function updateTranche(idx: number, field: string, value: string | number) {
    setTranches(
      tranches.map((t, i) => (i === idx ? { ...t, [field]: value } : t))
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Stock Grants</h2>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            Add Grant
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card form">
          <h3>{editingId ? 'Edit Grant' : 'New Grant'}</h3>

          {errors.length > 0 && (
            <div className="error-list">
              {errors.map((err, i) => (
                <p key={i} className="error">{err}</p>
              ))}
            </div>
          )}

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="grantType">Type</label>
              <select
                id="grantType"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as GrantType })
                }
              >
                {GRANT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {GRANT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="grantDate">Grant Date</label>
              <input
                id="grantDate"
                type="date"
                value={form.grantDate}
                onChange={(e) => setForm({ ...form, grantDate: e.target.value })}
              />
            </div>

            <div className="form-field">
              <label htmlFor="totalShares">Total Shares</label>
              <input
                id="totalShares"
                type="number"
                min="0"
                step="1"
                value={form.totalShares || ''}
                onChange={(e) =>
                  setForm({ ...form, totalShares: Number(e.target.value) })
                }
              />
            </div>

            <div className="form-field">
              <label htmlFor="priceAtGrant">Price/Share at Grant ($)</label>
              <input
                id="priceAtGrant"
                type="number"
                min="0"
                step="0.01"
                value={form.pricePerShareAtGrant || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    pricePerShareAtGrant: Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="form-field">
              <label htmlFor="relatedGrantId">Related Grant ID (optional)</label>
              <input
                id="relatedGrantId"
                type="text"
                value={form.relatedGrantId}
                onChange={(e) =>
                  setForm({ ...form, relatedGrantId: e.target.value })
                }
                placeholder="For free/catch-up grants"
              />
            </div>

            <div className="form-field">
              <label htmlFor="grantNotes">Notes</label>
              <input
                id="grantNotes"
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          {/* Vesting Schedule */}
          <h4>Vesting Schedule</h4>
          <table className="tranche-table">
            <thead>
              <tr>
                <th>Vest Date</th>
                <th>Shares</th>
                <th>Tax Treatment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tranches.map((t, idx) => (
                <tr key={idx}>
                  <td>
                    <input
                      type="date"
                      value={t.vestDate}
                      onChange={(e) =>
                        updateTranche(idx, 'vestDate', e.target.value)
                      }
                      aria-label={`Tranche ${idx + 1} vest date`}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={t.numberOfShares || ''}
                      onChange={(e) =>
                        updateTranche(
                          idx,
                          'numberOfShares',
                          Number(e.target.value)
                        )
                      }
                      aria-label={`Tranche ${idx + 1} shares`}
                    />
                  </td>
                  <td>
                    <select
                      value={t.taxTreatment}
                      onChange={(e) =>
                        updateTranche(idx, 'taxTreatment', e.target.value)
                      }
                      aria-label={`Tranche ${idx + 1} tax treatment`}
                    >
                      {(
                        Object.entries(TAX_TREATMENT_LABELS) as [
                          TaxTreatment,
                          string,
                        ][]
                      ).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => removeTranche(idx)}
                      className="btn btn-small btn-danger"
                      aria-label={`Remove tranche ${idx + 1}`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={addTranche} className="btn btn-small">
            Add Tranche
          </button>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Update Grant' : 'Add Grant'}
            </button>
            <button type="button" onClick={resetForm} className="btn">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Grants List */}
      {portfolio.grants.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">◆</div>
          <p>No grants added yet. Tap "Add Grant" to get started.</p>
        </div>
      ) : (
        <div className="card-list">
          {portfolio.grants.map((grant) => (
            <div key={grant.id} className="card">
              <div className="card-header">
                <strong>{GRANT_TYPE_LABELS[grant.type]}</strong>
                <span className="card-date">{grant.grantDate}</span>
              </div>
              <div className="card-body">
                <p>
                  {grant.totalShares.toLocaleString()} shares @{' '}
                  ${grant.pricePerShareAtGrant.toFixed(2)}/share
                </p>
                <p>
                  {grant.vestingSchedule.length} vesting{' '}
                  {grant.vestingSchedule.length === 1 ? 'tranche' : 'tranches'}
                </p>
                {grant.notes && <p className="note">{grant.notes}</p>}
              </div>
              <div className="card-actions">
                <button
                  onClick={() => handleEdit(grant)}
                  className="btn btn-small"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(grant.id)}
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
