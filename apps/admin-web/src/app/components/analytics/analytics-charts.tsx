'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../ui';
import type { AnalyticsData, DailyActivity, DistributionItem } from './types';

const axis = { fontSize: 11, fill: '#647084' };

function ChartCard({ title, description, label, children }: {
  title: string;
  description: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div role="img" aria-label={label} className="mt-5 h-72 min-w-0">
        {children}
      </div>
    </Card>
  );
}

function AcquisitionChart({ data, dataKey, name, color }: {
  data: DailyActivity[];
  dataKey: 'newUsers' | 'newWallets';
  name: string;
  color: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ left: -20, right: 8 }}>
        <CartesianGrid stroke="#E7EBF0" strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={axis} minTickGap={24} />
        <YAxis allowDecimals={false} tick={axis} />
        <Tooltip />
        <Line type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function DistributionChart({ data }: { data: DistributionItem[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 22, right: 12 }}>
        <CartesianGrid stroke="#E7EBF0" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={axis} />
        <YAxis type="category" dataKey="name" width={112} tick={axis} />
        <Tooltip />
        <Bar dataKey="value" name="Transactions" fill="#2563EB" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AnalyticsCharts({ data }: { data: AnalyticsData }) {
  return (
    <section aria-label="Analytics charts" className="grid min-w-0 gap-4 xl:grid-cols-2">
      <ChartCard title="Transaction activity" description="Daily transaction counts by type." label="Daily deposits, withdrawals and transfers chart. A table equivalent follows below.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.dailyActivity} margin={{ left: -20, right: 8 }}>
            <CartesianGrid stroke="#E7EBF0" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={axis} minTickGap={24} />
            <YAxis allowDecimals={false} tick={axis} />
            <Tooltip />
            <Legend />
            <Bar dataKey="deposits" name="Deposits" fill="#168A5B" />
            <Bar dataKey="withdrawals" name="Withdrawals" fill="#C9363E" />
            <Bar dataKey="transfers" name="Transfers" fill="#2563EB" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="User acquisition" description="New user registrations per day." label="Daily new users chart. A table equivalent follows below.">
        <AcquisitionChart data={data.dailyActivity} dataKey="newUsers" name="New users" color="#2563EB" />
      </ChartCard>
      <ChartCard title="Wallet acquisition" description="New wallets created per day." label="Daily new wallets chart. A table equivalent follows below.">
        <AcquisitionChart data={data.dailyActivity} dataKey="newWallets" name="New wallets" color="#168A5B" />
      </ChartCard>
      <ChartCard title="Transaction types" description="Count distribution for supported transaction types." label="Transaction type distribution chart. Counts are also available in the accessible summary below.">
        <DistributionChart data={data.transactionTypes} />
      </ChartCard>
      <ChartCard title="Transaction statuses" description="Pending includes transactions currently processing." label="Transaction status distribution chart. Counts are also available in the accessible summary below.">
        <DistributionChart data={data.transactionStatuses} />
      </ChartCard>
    </section>
  );
}
