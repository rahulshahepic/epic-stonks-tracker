import { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import {
  createLoan,
  validateLoan,
  LOAN_TYPES,
  LOAN_TYPE_LABELS,
  LOAN_STATUS_LABELS,
} from '../models';
import type { Loan, LoanType, LoanStatus } from '../models';

function emptyFormState(): Omit<Loan, 'id'> {
  return {
    type: 'purchase',
    principalAmount: 0,
    annualInterestRate: 0,
    originationDate: '',
    maturityDate: '',
    relatedGrantId: '',
    parentLoanId: '',
    refinancedFromId: '',
    status: 'active',
    notes: '',
  };
}

export function LoansPage() {
  const { portfolio, dispatch, loading } = usePortfolio();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyFormState());
  const [errors, setErrors] = useState<string[]>([]);

  if (loading) return <p>Loading...</p>;

  function handleEdit(loan: Loan) {
    setEditingId(loan.id);
    setForm({
      type: loan.type,
      principalAmount: loan.principalAmount,
      annualInterestRate: loan.annualInterestRate,
      originationDate: loan.originationDate,
      maturityDate: loan.maturityDate,
      relatedGrantId: loan.relatedGrantId ?? '',
      parentLoanId: loan.parentLoanId ?? '',
      refinancedFromId: loan.refinancedFromId ?? '',
      status: loan.status,
      notes: loan.notes ?? '',
    });
    setShowForm(true);
    setErrors([]);
  }

  function handleDelete(loanId: string) {
    dispatch({ type: 'DELETE_LOAN', loanId });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const loanData = {
      ...form,
      relatedGrantId: form.relatedGrantId || undefined,
      parentLoanId: form.parentLoanId || undefined,
      refinancedFromId: form.refinancedFromId || undefined,
      notes: form.notes || undefined,
    };

    const validationErrors = validateLoan(loanData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (editingId) {
      dispatch({
        type: 'UPDATE_LOAN',
        loan: { id: editingId, ...loanData },
      });
    } else {
      dispatch({ type: 'ADD_LOAN', loan: createLoan(loanData) });
    }

    resetForm();
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyFormState());
    setErrors([]);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Loans</h2>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            Add Loan
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card form">
          <h3>{editingId ? 'Edit Loan' : 'New Loan'}</h3>

          {errors.length > 0 && (
            <div className="error-list">
              {errors.map((err, i) => (
                <p key={i} className="error">{err}</p>
              ))}
            </div>
          )}

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="loanType">Type</label>
              <select
                id="loanType"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as LoanType })
                }
              >
                {LOAN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {LOAN_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="principalAmount">Principal ($)</label>
              <input
                id="principalAmount"
                type="number"
                min="0"
                step="0.01"
                value={form.principalAmount || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    principalAmount: Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="form-field">
              <label htmlFor="interestRate">Annual Interest Rate (decimal)</label>
              <input
                id="interestRate"
                type="number"
                min="0"
                max="1"
                step="0.001"
                value={form.annualInterestRate || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    annualInterestRate: Number(e.target.value),
                  })
                }
                placeholder="e.g., 0.04 for 4%"
              />
            </div>

            <div className="form-field">
              <label htmlFor="originationDate">Origination Date</label>
              <input
                id="originationDate"
                type="date"
                value={form.originationDate}
                onChange={(e) =>
                  setForm({ ...form, originationDate: e.target.value })
                }
              />
            </div>

            <div className="form-field">
              <label htmlFor="maturityDate">Maturity Date</label>
              <input
                id="maturityDate"
                type="date"
                value={form.maturityDate}
                onChange={(e) =>
                  setForm({ ...form, maturityDate: e.target.value })
                }
              />
            </div>

            <div className="form-field">
              <label htmlFor="loanStatus">Status</label>
              <select
                id="loanStatus"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as LoanStatus })
                }
              >
                {(
                  Object.entries(LOAN_STATUS_LABELS) as [LoanStatus, string][]
                ).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="relatedGrantIdLoan">Related Grant ID</label>
              <input
                id="relatedGrantIdLoan"
                type="text"
                value={form.relatedGrantId}
                onChange={(e) =>
                  setForm({ ...form, relatedGrantId: e.target.value })
                }
                placeholder="Optional"
              />
            </div>

            <div className="form-field">
              <label htmlFor="parentLoanId">Parent Loan ID</label>
              <input
                id="parentLoanId"
                type="text"
                value={form.parentLoanId}
                onChange={(e) =>
                  setForm({ ...form, parentLoanId: e.target.value })
                }
                placeholder="For interest/tax loans"
              />
            </div>

            <div className="form-field">
              <label htmlFor="refinancedFromId">Refinanced From ID</label>
              <input
                id="refinancedFromId"
                type="text"
                value={form.refinancedFromId}
                onChange={(e) =>
                  setForm({ ...form, refinancedFromId: e.target.value })
                }
                placeholder="If refinancing another loan"
              />
            </div>

            <div className="form-field form-field--full">
              <label htmlFor="loanNotes">Notes</label>
              <input
                id="loanNotes"
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Update Loan' : 'Add Loan'}
            </button>
            <button type="button" onClick={resetForm} className="btn">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Loans List */}
      {portfolio.loans.length === 0 ? (
        <p className="empty-state">No loans added yet.</p>
      ) : (
        <div className="card-list">
          {portfolio.loans.map((loan) => (
            <div key={loan.id} className="card">
              <div className="card-header">
                <strong>{LOAN_TYPE_LABELS[loan.type]}</strong>
                <span
                  className={`badge badge--${loan.status}`}
                >
                  {LOAN_STATUS_LABELS[loan.status]}
                </span>
              </div>
              <div className="card-body">
                <p>
                  ${loan.principalAmount.toLocaleString()} @{' '}
                  {(loan.annualInterestRate * 100).toFixed(2)}%
                </p>
                <p>
                  {loan.originationDate} &rarr; {loan.maturityDate}
                </p>
                {loan.notes && <p className="note">{loan.notes}</p>}
              </div>
              <div className="card-actions">
                <button
                  onClick={() => handleEdit(loan)}
                  className="btn btn-small"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(loan.id)}
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
