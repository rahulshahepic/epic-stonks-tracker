import { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import {
  calculateNetValue,
  getInterestExpenseByYear,
  getIncomeTaxableEvents,
  getCapGainsTaxableEvents,
} from '../services/calculation';
import { today, getYear } from '../utils/date';
import { GRANT_TYPE_LABELS, LOAN_TYPE_LABELS } from '../models';
import type { GrantType, LoanType } from '../models';
import { PortfolioCharts } from './PortfolioCharts';
import { VestingAlerts } from './VestingAlerts';
import { ProjectionsPanel } from './ProjectionsPanel';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyDetailed(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function Dashboard() {
  const { portfolio, loading } = usePortfolio();
  const [asOfDate, setAsOfDate] = useState(today());

  if (loading) return <p>Loading...</p>;

  const report = calculateNetValue(portfolio, asOfDate);
  const currentYear = getYear(asOfDate);
  const interestByYear = getInterestExpenseByYear(
    portfolio.loans,
    currentYear - 2,
    currentYear + 2
  );
  const incomeEvents = getIncomeTaxableEvents(portfolio, asOfDate);
  const capGainsEvents = getCapGainsTaxableEvents(portfolio, asOfDate);

  const hasData =
    portfolio.grants.length > 0 ||
    portfolio.loans.length > 0 ||
    portfolio.stockPrices.length > 0;

  if (!hasData) {
    return (
      <div className="dashboard fade-in">
        <h2>Dashboard</h2>
        <div className="empty-state">
          <div className="empty-state-icon">◈</div>
          <p className="empty-state-title">Welcome to Stonks</p>
          <p>Get started by adding stock prices in Config, then create your grants and loans.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard fade-in">
      <h2>Dashboard</h2>

      <div className="form-row">
        <label htmlFor="asOfDate">As of date:</label>
        <input
          id="asOfDate"
          type="date"
          value={asOfDate}
          onChange={(e) => setAsOfDate(e.target.value)}
        />
      </div>

      <VestingAlerts portfolio={portfolio} asOfDate={asOfDate} />

      <PortfolioCharts portfolio={portfolio} />

      {/* Net Value Summary */}
      <section className="card">
        <h3>Net Value Summary</h3>
        {report.stockPrice == null && (
          <p className="warning">No stock price available for this date.</p>
        )}
        <div className="stat-grid">
          <div className="stat">
            <span className="stat-label">Stock Price</span>
            <span className="stat-value">
              {report.stockPrice != null
                ? formatCurrencyDetailed(report.stockPrice)
                : 'N/A'}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Held Shares</span>
            <span className="stat-value">{report.totalHeldShares.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Unvested Shares</span>
            <span className="stat-value">{report.totalUnvestedShares.toLocaleString()}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Gross Share Value</span>
            <span className="stat-value">{formatCurrency(report.grossShareValue)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Total Loan Principal</span>
            <span className="stat-value negative">
              {formatCurrency(report.totalLoanPrincipal)}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Accrued Interest (YTD)</span>
            <span className="stat-value negative">
              {formatCurrency(report.totalAccruedInterest)}
            </span>
          </div>
          <div className="stat stat--highlight">
            <span className="stat-label">Net Value (Vested)</span>
            <span className={`stat-value ${report.netValue >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(report.netValue)}
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Potential Net Value (All Shares)</span>
            <span className={`stat-value ${report.potentialNetValue >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(report.potentialNetValue)}
            </span>
          </div>
        </div>
      </section>

      {/* Per-Grant Breakdown */}
      {report.byGrant.length > 0 && (
        <section className="card">
          <h3>Grants Breakdown</h3>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Held</th>
                <th>Unvested</th>
                <th>Total</th>
                <th>Value (Held)</th>
              </tr>
            </thead>
            <tbody>
              {report.byGrant.map((g) => (
                <tr key={g.grantId}>
                  <td>{GRANT_TYPE_LABELS[g.grantType as GrantType]}</td>
                  <td>{g.heldShares.toLocaleString()}</td>
                  <td>{g.unvestedShares.toLocaleString()}</td>
                  <td>{g.totalShares.toLocaleString()}</td>
                  <td>{formatCurrency(g.shareValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Loan Breakdown */}
      {report.byLoan.length > 0 && (
        <section className="card">
          <h3>Active Loans</h3>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Principal</th>
                <th>Rate</th>
                <th>Annual Interest</th>
                <th>Accrued (YTD)</th>
                <th>Maturity</th>
              </tr>
            </thead>
            <tbody>
              {report.byLoan.map((l) => (
                <tr key={l.loanId}>
                  <td>{LOAN_TYPE_LABELS[l.loanType as LoanType]}</td>
                  <td>{formatCurrency(l.principal)}</td>
                  <td>
                    {(
                      (l.annualInterest / l.principal) *
                      100
                    ).toFixed(2)}
                    %
                  </td>
                  <td>{formatCurrency(l.annualInterest)}</td>
                  <td>{formatCurrencyDetailed(l.accruedInterestToDate)}</td>
                  <td>{l.maturityDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Interest Expense by Year */}
      {interestByYear.some((y) => y.totalInterest > 0) && (
        <section className="card">
          <h3>Interest Expense by Year</h3>
          <p className="note">
            Interest accrued in year Y is deductible in year Y+1.
          </p>
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Interest Accrued</th>
                <th>Deductible In</th>
              </tr>
            </thead>
            <tbody>
              {interestByYear
                .filter((y) => y.totalInterest > 0)
                .map((y) => (
                  <tr key={y.year}>
                    <td>{y.year}</td>
                    <td>{formatCurrency(y.totalInterest)}</td>
                    <td>{y.deductibleInYear}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Taxable Events */}
      {(incomeEvents.length > 0 || capGainsEvents.length > 0) && (
        <section className="card">
          <h3>Taxable Events (through {asOfDate})</h3>

          {incomeEvents.length > 0 && (
            <>
              <h4>Income Events</h4>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Grant Type</th>
                    <th>Shares</th>
                    <th>Price</th>
                    <th>Taxable Value</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeEvents.map((e, i) => (
                    <tr key={i}>
                      <td>{e.date}</td>
                      <td>{GRANT_TYPE_LABELS[e.grantType as GrantType]}</td>
                      <td>{e.shares.toLocaleString()}</td>
                      <td>{formatCurrencyDetailed(e.pricePerShare)}</td>
                      <td>{formatCurrency(e.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="subtotal">
                Total income:{' '}
                {formatCurrency(
                  incomeEvents.reduce((s, e) => s + e.totalValue, 0)
                )}
              </p>
            </>
          )}

          {capGainsEvents.length > 0 && (
            <>
              <h4>Capital Gains Events</h4>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Grant Type</th>
                    <th>Shares</th>
                    <th>Price at Vest</th>
                    <th>Taxable Gain</th>
                  </tr>
                </thead>
                <tbody>
                  {capGainsEvents.map((e, i) => (
                    <tr key={i}>
                      <td>{e.date}</td>
                      <td>{GRANT_TYPE_LABELS[e.grantType as GrantType]}</td>
                      <td>{e.shares.toLocaleString()}</td>
                      <td>{formatCurrencyDetailed(e.pricePerShare)}</td>
                      <td>{formatCurrency(e.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="subtotal">
                Total capital gains:{' '}
                {formatCurrency(
                  capGainsEvents.reduce((s, e) => s + e.totalValue, 0)
                )}
              </p>
            </>
          )}
        </section>
      )}

      <ProjectionsPanel portfolio={portfolio} asOfDate={asOfDate} />
    </div>
  );
}
