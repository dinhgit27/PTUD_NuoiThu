import React, { useEffect, useState } from 'react';
import { Activity, Clock3, TrendingUp } from 'lucide-react';
import { api } from '../services/api';

type AnalyticsDay = {
  date: string;
  activeUsers: number;
  averageFocusMinutes: number;
  newUsers: number;
  totalUsers: number;
};

type Metric = {
  title: string;
  icon: React.ReactNode;
  color: string;
  chart: 'bar' | 'line';
  value: (day: AnalyticsDay) => number;
  summary: string;
};

const chartWidth = 640;
const chartHeight = 190;
const padding = { top: 14, right: 18, bottom: 30, left: 38 };

const metrics: Metric[] = [
  {
    title: 'Người dùng hoạt động mỗi ngày',
    icon: <Activity size={17} />,
    color: '#5f8b66',
    chart: 'bar',
    value: day => day.activeUsers,
    summary: 'Tài khoản có phiên làm việc'
  },
  {
    title: 'Thời gian tập trung trung bình',
    icon: <Clock3 size={17} />,
    color: '#cf7954',
    chart: 'line',
    value: day => day.averageFocusMinutes,
    summary: 'Phút / phiên hoàn thành'
  },
  {
    title: 'Tăng trưởng nền tảng',
    icon: <TrendingUp size={17} />,
    color: '#6670b4',
    chart: 'line',
    value: day => day.totalUsers,
    summary: 'Tổng tài khoản tích lũy'
  }
];

function formatDate(date: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`));
}

function LineChart({ metric, days }: { metric: Metric; days: AnalyticsDay[] }) {
  if (!days.length) return <p className="py-10 text-center text-sm text-gray-500">Chưa có dữ liệu trong khoảng thời gian này.</p>;
  const values = days.map(metric.value);
  const maximum = Math.max(1, ...values);
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const points = values.map((value, index) => {
    const x = padding.left + (index / Math.max(1, values.length - 1)) * plotWidth;
    const y = padding.top + plotHeight - (value / maximum) * plotHeight;
    return `${x},${y}`;
  }).join(' ');
  const labels = [0, 7, 14, 21, 29].filter(index => index < days.length);

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" role="img" aria-label={`${metric.title} trong 30 ngày`}>
        {[0, 0.5, 1].map(ratio => {
          const y = padding.top + plotHeight * ratio;
          const value = Math.round(maximum * (1 - ratio));
          return (
            <g key={ratio}>
              <line x1={padding.left} x2={chartWidth - padding.right} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray="3 4" />
              <text x={padding.left - 7} y={y + 4} textAnchor="end" fontSize="10" fill="#6b7280">{value}</text>
            </g>
          );
        })}
        {metric.chart === 'bar' ? values.map((value, index) => {
          const slotWidth = plotWidth / values.length;
          const barWidth = Math.max(2, slotWidth * 0.62);
          const barHeight = (value / maximum) * plotHeight;
          return (
            <rect
              key={days[index].date}
              x={padding.left + index * slotWidth + (slotWidth - barWidth) / 2}
              y={padding.top + plotHeight - barHeight}
              width={barWidth}
              height={barHeight}
              rx="2"
              fill={metric.color}
              opacity="0.85"
            />
          );
        }) : (
          <>
            {values.length > 1 && <polyline points={points} fill="none" stroke={metric.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
            {values.length === 1 && <circle cx={padding.left} cy={padding.top + plotHeight - (values[0] / maximum) * plotHeight} r="4" fill={metric.color} />}
          </>
        )}
        {labels.map(index => {
          const x = padding.left + (index / Math.max(1, values.length - 1)) * plotWidth;
          return <text key={days[index].date} x={x} y={chartHeight - 7} textAnchor="middle" fontSize="10" fill="#6b7280">{formatDate(days[index].date)}</text>;
        })}
      </svg>
    </div>
  );
}

export const AdminAnalytics: React.FC = () => {
  const [days, setDays] = useState<AnalyticsDay[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.getAdminAnalytics()
      .then(response => {
        if (active) setDays(response.data.days);
      })
      .catch(() => {
        if (active) setError('Không thể tải dữ liệu phân tích. Vui lòng thử tải lại trang.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const latest = days[days.length - 1];
  const averageActiveUsers = days.length
    ? Math.round(days.reduce((total, day) => total + day.activeUsers, 0) / days.length)
    : 0;
  const averageFocus = days.length
    ? Math.round(days.reduce((total, day) => total + day.averageFocusMinutes, 0) / Math.max(1, days.filter(day => day.averageFocusMinutes > 0).length))
    : 0;

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-pixel text-lg text-slate-900">Tổng quan nền tảng</h2>
          <p className="mt-1 text-sm text-gray-600">Số liệu hoạt động và tăng trưởng trong 30 ngày gần nhất.</p>
        </div>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-[#1b365d]">30 ngày gần nhất</span>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Đang tải số liệu...</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500">{metrics[0].icon}{metrics[0].title}</div>
              <div className="mt-3 text-2xl font-extrabold text-slate-900">{averageActiveUsers}</div>
              <p className="mt-1 text-xs text-gray-500">Trung bình mỗi ngày</p>
            </article>
            <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500">{metrics[1].icon}{metrics[1].title}</div>
              <div className="mt-3 text-2xl font-extrabold text-slate-900">{averageFocus} <span className="text-sm font-medium">phút</span></div>
              <p className="mt-1 text-xs text-gray-500">Tính trên phiên đã hoàn thành</p>
            </article>
            <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500">{metrics[2].icon}{metrics[2].title}</div>
              <div className="mt-3 text-2xl font-extrabold text-slate-900">{latest?.totalUsers || 0}</div>
              <p className="mt-1 text-xs text-gray-500">Tổng tài khoản đến hôm nay</p>
            </article>
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            {metrics.map(metric => (
              <article key={metric.title} className="min-w-0 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">{metric.icon}{metric.title}</div>
                <p className="mt-1 text-xs text-gray-500">{metric.summary}</p>
                <LineChart metric={metric} days={days} />
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
};
