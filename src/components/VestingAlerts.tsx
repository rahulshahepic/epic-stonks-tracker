import type { Portfolio } from '../models';
import { GRANT_TYPE_LABELS } from '../models';
import type { GrantType } from '../models';
import { daysBetween } from '../utils/date';
import { getStockPriceOnDate } from '../services/calculation';

interface VestingMilestone {
  grantId: string;
  grantType: GrantType;
  vestDate: string;
  shares: number;
  daysAway: number; // negative = already vested
  estimatedValue: number | null;
}

interface Props {
  portfolio: Portfolio;
  asOfDate: string;
}

export function VestingAlerts({ portfolio, asOfDate }: Props) {
  if (portfolio.grants.length === 0) return null;

  const milestones: VestingMilestone[] = [];

  for (const grant of portfolio.grants) {
    for (const tranche of grant.vestingSchedule) {
      const daysAway = daysBetween(asOfDate, tranche.vestDate);

      // Show: vested in last 30 days, or upcoming in next 90 days
      if (daysAway >= -30 && daysAway <= 90) {
        const price = getStockPriceOnDate(portfolio.stockPrices, asOfDate);
        milestones.push({
          grantId: grant.id,
          grantType: grant.type,
          vestDate: tranche.vestDate,
          shares: tranche.numberOfShares,
          daysAway,
          estimatedValue: price != null ? tranche.numberOfShares * price : null,
        });
      }
    }
  }

  if (milestones.length === 0) return null;

  milestones.sort((a, b) => a.daysAway - b.daysAway);

  const recent = milestones.filter((m) => m.daysAway <= 0);
  const upcoming = milestones.filter((m) => m.daysAway > 0);

  return (
    <section className="card vesting-alerts">
      <h3>Vesting Milestones</h3>
      {recent.length > 0 && (
        <div className="alert-group">
          <span className="alert-group-label alert-group-label--recent">Recently Vested</span>
          {recent.map((m) => (
            <div key={`${m.grantId}-${m.vestDate}`} className="alert-item">
              <span className="alert-badge alert-badge--vested">Vested</span>
              <div className="alert-details">
                <strong>
                  {m.shares.toLocaleString()} shares
                </strong>
                <span className="alert-meta">
                  {GRANT_TYPE_LABELS[m.grantType]} &middot; {m.vestDate}
                  {m.daysAway === 0 ? ' (today)' : ` (${Math.abs(m.daysAway)}d ago)`}
                </span>
              </div>
              {m.estimatedValue != null && (
                <span className="alert-value positive">
                  ~${m.estimatedValue.toLocaleString()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="alert-group">
          <span className="alert-group-label alert-group-label--upcoming">Upcoming</span>
          {upcoming.map((m) => (
            <div key={`${m.grantId}-${m.vestDate}`} className="alert-item">
              <span className={`alert-badge ${m.daysAway <= 30 ? 'alert-badge--soon' : 'alert-badge--later'}`}>
                {m.daysAway}d
              </span>
              <div className="alert-details">
                <strong>
                  {m.shares.toLocaleString()} shares
                </strong>
                <span className="alert-meta">
                  {GRANT_TYPE_LABELS[m.grantType]} &middot; {m.vestDate}
                </span>
              </div>
              {m.estimatedValue != null && (
                <span className="alert-value">
                  ~${m.estimatedValue.toLocaleString()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
