import { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import {
  createProgramConfig,
  defaultProgramConfig,
  validateProgramConfig,
} from '../models';
import type { ProgramConfig, GrantType } from '../models';

const GRANT_TYPE_NAMES: Record<GrantType, string> = {
  purchase: 'Purchase',
  free: 'Free',
  catch_up: 'Catch-up',
  bonus: 'Bonus',
};

function emptyForm(): Omit<ProgramConfig, 'id'> {
  return defaultProgramConfig(new Date().getFullYear());
}

export function ProgramConfigPage() {
  const { portfolio, dispatch, loading } = usePortfolio();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState<string[]>([]);

  if (loading) return <p>Loading...</p>;

  function handleEdit(config: ProgramConfig) {
    setEditingId(config.id);
    setForm({ ...config });
    setShowForm(true);
    setErrors([]);
  }

  function handleDelete(id: string) {
    dispatch({ type: 'DELETE_PROGRAM_CONFIG', configId: id });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validateProgramConfig(form);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (editingId) {
      dispatch({
        type: 'UPDATE_PROGRAM_CONFIG',
        config: { id: editingId, ...form },
      });
    } else {
      dispatch({
        type: 'ADD_PROGRAM_CONFIG',
        config: createProgramConfig(form),
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

  return (
    <div className="page">
      <div className="page-header">
        <h2>Program Config</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            Add Program
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card form">
          <h3>{editingId ? 'Edit Program' : 'New Program'}</h3>

          {errors.length > 0 && (
            <div className="error-list">
              {errors.map((err, i) => (
                <p key={i} className="error">{err}</p>
              ))}
            </div>
          )}

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="pcName">Program Name</label>
              <input
                id="pcName"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="pcYear">Program Year</label>
              <input
                id="pcYear"
                type="number"
                min="2000"
                value={form.programYear || ''}
                onChange={(e) =>
                  setForm({ ...form, programYear: Number(e.target.value) })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="pcRate">Interest Rate (decimal)</label>
              <input
                id="pcRate"
                type="number"
                min="0"
                max="1"
                step="0.001"
                value={form.standardInterestRate || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    standardInterestRate: Number(e.target.value),
                  })
                }
                placeholder="e.g. 0.04 for 4%"
              />
            </div>
            <div className="form-field">
              <label htmlFor="pcTerm">Loan Term (years)</label>
              <input
                id="pcTerm"
                type="number"
                min="1"
                value={form.standardLoanTermYears || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    standardLoanTermYears: Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="form-field">
              <label htmlFor="pcDown">Down Payment %</label>
              <input
                id="pcDown"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={form.downPaymentPercent || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    downPaymentPercent: Number(e.target.value),
                  })
                }
                placeholder="e.g. 0.10 for 10%"
              />
            </div>
            <div className="form-field">
              <label htmlFor="pcExchange">Share Exchange Available</label>
              <select
                id="pcExchange"
                value={form.shareExchangeAvailable ? 'yes' : 'no'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    shareExchangeAvailable: e.target.value === 'yes',
                  })
                }
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="pcFreeRatio">Free Share Ratio</label>
              <input
                id="pcFreeRatio"
                type="number"
                min="0"
                step="0.1"
                value={form.freeShareRatio ?? ''}
                onChange={(e) =>
                  setForm({ ...form, freeShareRatio: Number(e.target.value) })
                }
                placeholder="e.g. 0.5 = 1 free per 2 purchased"
              />
            </div>
            <div className="form-field">
              <label htmlFor="pcCatchUpRatio">Catch-up Share Ratio</label>
              <input
                id="pcCatchUpRatio"
                type="number"
                min="0"
                step="0.1"
                value={form.catchUpShareRatio ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    catchUpShareRatio: Number(e.target.value),
                  })
                }
                placeholder="e.g. 0.5"
              />
            </div>
            <div className="form-field form-field--full">
              <label htmlFor="pcNotes">Notes</label>
              <input
                id="pcNotes"
                type="text"
                value={form.notes ?? ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          {/* Vesting templates summary */}
          {form.grantTemplates && (
            <div className="grant-templates-summary">
              <h4>Vesting Templates</h4>
              {(
                Object.entries(form.grantTemplates) as [
                  GrantType,
                  { vestingYears: number; vestingTemplate: { yearOffset: number; shareFraction: number; taxTreatment: string }[] },
                ][]
              ).map(([gtype, tmpl]) => (
                <div key={gtype} className="template-row">
                  <strong>{GRANT_TYPE_NAMES[gtype]}</strong>
                  <span className="text-muted">
                    {tmpl.vestingYears}yr &mdash;{' '}
                    {tmpl.vestingTemplate
                      .map(
                        (t) =>
                          `Y+${t.yearOffset}: ${Math.round(t.shareFraction * 100)}%`
                      )
                      .join(', ')}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Update' : 'Add Program'}
            </button>
            <button type="button" onClick={resetForm} className="btn">
              Cancel
            </button>
          </div>
        </form>
      )}

      {portfolio.programConfigs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#9881;</div>
          <p>No program configs yet. Add one to define program structure.</p>
        </div>
      ) : (
        <div className="card-list">
          {portfolio.programConfigs.map((config) => (
            <div key={config.id} className="card">
              <div className="card-header">
                <strong>{config.name}</strong>
                <span className="card-date">{config.programYear}</span>
              </div>
              <div className="card-body">
                <p>
                  Rate: {(config.standardInterestRate * 100).toFixed(1)}% &middot;{' '}
                  Term: {config.standardLoanTermYears}yr &middot;{' '}
                  Down: {(config.downPaymentPercent * 100).toFixed(0)}%
                </p>
                <p>
                  Free ratio: {config.freeShareRatio} &middot;{' '}
                  Catch-up ratio: {config.catchUpShareRatio} &middot;{' '}
                  Exchange: {config.shareExchangeAvailable ? 'Yes' : 'No'}
                </p>
                {config.notes && <p className="note">{config.notes}</p>}
              </div>
              <div className="card-actions">
                <button
                  onClick={() => handleEdit(config)}
                  className="btn btn-small"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(config.id)}
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
