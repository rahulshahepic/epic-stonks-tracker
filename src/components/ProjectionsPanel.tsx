import { useState } from 'react';
import type { Portfolio } from '../models';
import { projectFutureValue } from '../services/calculation';
import type { YearProjection } from '../services/calculation';
import { getYear } from '../utils/date';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface Props {
  portfolio: Portfolio;
  asOfDate: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ProjectionsPanel({ portfolio, asOfDate }: Props) {
  const [growthRate, setGrowthRate] = useState(0.08);
  const [yearsAhead, setYearsAhead] = useState(10);
  const [expanded, setExpanded] = useState(false);

  const currentYear = getYear(asOfDate);
  const projections = projectFutureValue(
    portfolio,
    growthRate,
    currentYear,
    currentYear + yearsAhead
  );

  if (portfolio.stockPrices.length === 0) return null;

  const chartData = projections.map((p) => ({
    year: p.year,
    netValue: p.netValue,
    grossValue: p.grossValue,
    price: p.projectedStockPrice,
  }));

  const gridStroke = 'rgba(255,255,255,0.06)';
  const axisColor = '#7c8494';

  return (
    <section className="card">
      <div
        className="ai-helper-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <h3>Future Projections</h3>
        <span className="ai-helper-toggle">{expanded ? '−' : '+'}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: '0.75rem' }}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="growthRate">Annual Growth Rate</label>
              <select
                id="growthRate"
                value={growthRate}
                onChange={(e) => setGrowthRate(Number(e.target.value))}
              >
                <option value={0.04}>4% (Conservative)</option>
                <option value={0.08}>8% (Moderate)</option>
                <option value={0.12}>12% (Optimistic)</option>
                <option value={0.15}>15% (Aggressive)</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="yearsAhead">Years Ahead</label>
              <select
                id="yearsAhead"
                value={yearsAhead}
                onChange={(e) => setYearsAhead(Number(e.target.value))}
              >
                <option value={5}>5 years</option>
                <option value={10}>10 years</option>
                <option value={15}>15 years</option>
                <option value={20}>20 years</option>
              </select>
            </div>
          </div>

          {/* Projection chart */}
          {chartData.length > 1 && (
            <div className="chart-container" style={{ marginTop: '1rem' }}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="projNetGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis
                    dataKey="year"
                    tick={{ fill: axisColor, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: axisColor, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCurrency(v)}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#1c1c22',
                      border: '1px solid #2a2a35',
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                    formatter={(value: number | undefined, name: string | undefined) => [
                      value != null ? formatCurrency(value) : '',
                      name === 'netValue' ? 'Net Value' : 'Gross Value',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="grossValue"
                    stroke="#818cf8"
                    strokeWidth={1.5}
                    fill="none"
                    strokeDasharray="4 3"
                  />
                  <Area
                    type="monotone"
                    dataKey="netValue"
                    stroke="#34d399"
                    strokeWidth={2}
                    fill="url(#projNetGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Year-by-year table */}
          <table style={{ marginTop: '1rem' }}>
            <thead>
              <tr>
                <th>Year</th>
                <th>Price</th>
                <th>Held</th>
                <th>Loans</th>
                <th>Net Value</th>
                <th>Events</th>
              </tr>
            </thead>
            <tbody>
              {projections.map((p: YearProjection) => (
                <tr key={p.year}>
                  <td>{p.year}</td>
                  <td>${p.projectedStockPrice.toFixed(2)}</td>
                  <td>{p.heldShares.toLocaleString()}</td>
                  <td>{formatCurrency(p.loansOutstanding)}</td>
                  <td
                    className={p.netValue >= 0 ? 'positive' : 'negative'}
                  >
                    {formatCurrency(p.netValue)}
                  </td>
                  <td>
                    {p.events.length > 0
                      ? p.events.map((ev) => ev.description).join('; ')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
