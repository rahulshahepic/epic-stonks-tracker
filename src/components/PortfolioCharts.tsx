import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart,
} from 'recharts';
import type { Portfolio } from '../models';
import { calculateNetValue } from '../services/calculation';

interface Props {
  portfolio: Portfolio;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function shortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${m}/${d}`;
}

export function PortfolioCharts({ portfolio }: Props) {
  const { stockPrices, grants, loans } = portfolio;

  if (stockPrices.length < 2) return null;

  const sorted = [...stockPrices].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );

  const priceData = sorted.map((sp) => ({
    date: sp.date,
    label: shortDate(sp.date),
    price: sp.pricePerShare,
  }));

  const hasPositions = grants.length > 0 || loans.length > 0;

  const netValueData = hasPositions
    ? sorted.map((sp) => {
        const report = calculateNetValue(portfolio, sp.date);
        return {
          date: sp.date,
          label: shortDate(sp.date),
          netValue: report.netValue,
          grossValue: report.grossShareValue,
        };
      })
    : [];

  const gridStroke = 'rgba(255,255,255,0.06)';
  const axisColor = '#7c8494';

  return (
    <div className="chart-section">
      <section className="card">
        <h3>Stock Price History</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={priceData}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: axisColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: axisColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  background: '#1c1c22',
                  border: '1px solid #2a2a35',
                  borderRadius: 8,
                  fontSize: 13,
                }}
                labelFormatter={(_label, payload) =>
                  payload?.[0]?.payload?.date ?? _label
                }
                formatter={(value: number | undefined) => [
                  value != null ? `$${value.toFixed(2)}` : '',
                  'Price',
                ]}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#818cf8"
                strokeWidth={2}
                dot={{ r: 3, fill: '#818cf8' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {netValueData.length > 0 && (
        <section className="card">
          <h3>Net Value Over Time</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={netValueData}>
                <defs>
                  <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: axisColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCurrency(v)}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1c1c22',
                    border: '1px solid #2a2a35',
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                  labelFormatter={(_label, payload) =>
                    payload?.[0]?.payload?.date ?? _label
                  }
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
                  fill="url(#netGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
