import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, ComposedChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import {
  FileText, Clock, AlertCircle, MapPin, Scale, Users,
  Bell, Camera, Newspaper, TrendingUp, PenLine, X, Loader2, CalendarCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/client.js';
import { KPICard, SectionCard, PageHeader } from '../components/UI.jsx';

const PIE_COLORS = ['#d71920', '#C9A227', '#8c0a0e', '#e8843a', '#3b82f6', '#16a34a', '#7c3aed', '#0891b2'];

const TICKER_STYLE = `
@keyframes wire-scroll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.wire-track {
  display: flex;
  width: max-content;
  animation: wire-scroll linear infinite;
}
.wire-track:hover { animation-play-state: paused; }
`;

const WIRE_LEVELS = [
  { key: 'national', label: 'National', types: ['news', 'aggregator'], color: '#d71920' },
  { key: 'state',    label: 'State',    types: ['regional'],           color: '#e8843a' },
  { key: 'local',    label: 'Local',    types: ['local'],              color: '#16a34a' },
];

function cleanTitle(t) {
  return (t || '').replace(/\]\]>.*$/, '').replace(/<!\[CDATA\[/g, '').trim();
}

function WireTicker({ feeds, branch }) {
  const [activeTab, setActiveTab] = useState('national');
  if (!feeds.length) return null;

  const level    = WIRE_LEVELS.find(l => l.key === activeTab);
  const articles = feeds
    .filter(f => level.types.includes(f.type))
    .flatMap(f => (f.articles || []).map(a => ({ ...a, feedColor: f.color, feedLabel: f.label, title: cleanTitle(a.title) })));

  const localBranch = branch && branch !== 'All' ? branch : null;
  const items    = articles.length ? [...articles, ...articles] : [];
  const duration = Math.max(40, articles.length * 3);

  return (
    <div className="card overflow-hidden mb-4" style={{ borderLeft: `4px solid ${level.color}`, transition: 'border-color .3s' }}>
      <style>{TICKER_STYLE}</style>

      {/* ── Toggle header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs font-bold tracking-widest flex-shrink-0" style={{ color: 'var(--muted)' }}>LIVE NEWS</span>
        <div className="flex gap-1.5">
          {WIRE_LEVELS.map(({ key, label, color }) => {
            const isActive = activeTab === key;
            const pill = key === 'local' && localBranch ? `Local · ${localBranch}` : label;
            return (
              <button key={key} onClick={() => setActiveTab(key)}
                className="px-3 py-0.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: isActive ? color : 'transparent',
                  color: isActive ? '#fff' : color,
                  border: `1.5px solid ${color}`,
                  cursor: 'pointer',
                }}>
                {pill}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Ticker row ────────────────────────────────────────────────────── */}
      <div className="flex items-center" style={{ height: 36 }}>
        <div className="flex-shrink-0 flex items-center justify-center text-xs font-bold whitespace-nowrap"
          style={{ background: level.color, color: '#fff', width: 80, height: '100%', letterSpacing: '.06em', transition: 'background .3s' }}>
          {activeTab === 'local' && localBranch ? localBranch.slice(0, 9) : level.label}
        </div>
        <div className="flex-1 overflow-hidden relative" style={{ height: 36 }}>
          {articles.length === 0 ? (
            <span className="absolute inset-0 flex items-center px-4 text-xs" style={{ color: 'var(--muted)' }}>
              {activeTab === 'local'
                ? `No local feeds configured${localBranch ? ` for ${localBranch}` : ''}. Add feeds with type "local" in api/editorial/feeds.js.`
                : 'No articles available right now.'}
            </span>
          ) : (
            <div key={activeTab} className="wire-track absolute top-0 left-0 h-full items-center"
              style={{ animationDuration: `${duration}s` }}>
              {items.map((art, i) => (
                <a key={i} href={art.link || '#'} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 text-sm whitespace-nowrap hover:underline"
                  style={{ color: 'var(--text)', height: 36 }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: art.feedColor }} />
                  <span className="text-xs font-semibold" style={{ color: art.feedColor }}>{art.feedLabel}</span>
                  {art.title}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t, state, branch } = useApp();
  const navigate = useNavigate();
  const [weeklyPlans, setWeeklyPlans] = useState(null); // null = hidden (no access)

  useEffect(() => {
    api.listWeeklyReviews()
      .then(r => setWeeklyPlans(r.plans || []))
      .catch(() => setWeeklyPlans(null));
  }, []);
  const [d, setD]           = useState(null);
  const [topDelay, setTopDelay] = useState([]);
  const [feeds, setFeeds]   = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [gradingTop, setGradingTop]       = useState(null);
  const [gradingTopLoading, setGTLoading] = useState(true);
  const [detailModal, setDetailModal] = useState(null); // 'qc' | 'delays' | null
  const [qcDetail, setQcDetail]             = useState(null);
  const [qcDetailLoading, setQcDetailLoading] = useState(false);
  const [qcLightbox, setQcLightbox]           = useState(null); // photo_url string
  const [qcSevFilter, setQcSevFilter]         = useState('all');

  const openQcDetail = () => {
    setDetailModal('qc');
    if (qcDetail) return;
    setQcDetailLoading(true);
    api.dashboardQcDetail(7)
      .then(r => setQcDetail(r))
      .catch(() => setQcDetail({ items: [] }))
      .finally(() => setQcDetailLoading(false));
  };

  useEffect(() => {
    api.editorialFeeds().then(d => setFeeds(d.feeds || [])).catch(() => {});
  }, []);

  useEffect(() => {
    api.hrAdminStats(state, branch)
      .then(r => setProfiles(r?.profiles || []))
      .catch(() => setProfiles([]));
  }, [state, branch]);

  useEffect(() => {
    setGTLoading(true);
    api.hrGradingTop(state, branch)
      .then(r => { setGradingTop(r || { top3: [], worst3: [], month: '' }); setGTLoading(false); })
      .catch(() => { setGradingTop({ top3: [], worst3: [], month: '' }); setGTLoading(false); });
  }, [state, branch]);

  useEffect(() => {
    setD(null);
    setQcDetail(null);
    api.dashboard(state, branch).then(setD).catch(() => setD({}));
    api.weeklyTrend(state, branch, 7).then(r => {
      // Aggregate last 7 days: sum delay_minutes per edition, compute avg
      const map = {};
      (r.editions || []).forEach(ed => {
        const allVals  = Object.values(ed.days || {}).map(day => day.delay_minutes);
        const lateVals = allVals.filter(m => m >= 5);
        if (!lateVals.length) return;
        // avg = sum of late delays ÷ total days (on-time = 0)
        const avg = Math.round(lateVals.reduce((a, b) => a + b, 0) / allVals.length);
        const max = Math.max(...lateVals);
        map[ed.code] = {
          edition_name: ed.edition_name,
          unit:         ed.unit,
          state:        ed.state,
          delayed_days: ed.delayed_days,
          avg_delay:    avg,
          max_delay:    max,
        };
      });
      const sorted = Object.values(map)
        .filter(e => e.avg_delay > 0)
        .sort((a, b) => b.avg_delay - a.avg_delay)
        .slice(0, 10);
      setTopDelay(sorted);
    }).catch(() => {});
  }, [state, branch]);

  if (!d) return <Skel />;

  const k             = d.kpis         || {};
  const trend7days    = d.trend7days   || [];
  const profilePie    = d.profilePie   || [];
  const editionDelays = d.editionDelays|| [];
  const qcTop5        = d.qcTop5       || [];
  const top5Leaves    = d.top5Leaves   || [];

  const subtitle = [state !== 'All' ? state : null, branch !== 'All' ? branch : null]
    .filter(Boolean).join(' › ') || 'All States';

  return (
    <div>
      <WireTicker feeds={feeds} branch={branch} />
      <PageHeader title={t('nav.home')} subtitle={subtitle} />

      {/* ── KPI Grid ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <KPICard
          label="Avg Stories / Reporter"
          value={k.reporterTotal > 0 ? (k.reporterStories / k.reporterTotal).toFixed(1) : '—'}
          sub={k.reporterTotal > 0 ? `${k.reporterStories} stories · target ${k.reporterTotal * 5} · yesterday` : 'yesterday'}
          accent={(k.reporterTotal > 0 ? k.reporterStories / k.reporterTotal : 0) >= 5 ? '#16a34a' : '#d71920'}
          icon={PenLine}
        />
        <KPICard
          label="Avg Visits / Field Staff"
          value={k.fieldStaffTotal > 0 ? (k.visits / k.fieldStaffTotal).toFixed(1) : '—'}
          sub={k.fieldStaffTotal > 0 ? `${k.visits} visits · target ${k.fieldStaffTotal * 3} · yesterday` : 'yesterday'}
          accent={(k.fieldStaffTotal > 0 ? k.visits / k.fieldStaffTotal : 0) >= 3 ? '#16a34a' : '#d71920'}
          icon={MapPin}
        />
        <KPICard
          label="QC Mistakes"
          value={k.qcMistakes ?? '—'}
          sub="last 7 days · click for details"
          accent={k.qcMistakes > 0 ? '#d71920' : '#16a34a'}
          icon={AlertCircle}
          onClick={openQcDetail}
        />
        <KPICard
          label="Delayed Editions"
          value={k.delayed ?? '—'}
          sub="over schedule · click for details"
          accent={k.delayed > 0 ? '#d71920' : '#16a34a'}
          icon={Clock}
          onClick={() => setDetailModal('delays')}
        />
        {weeklyPlans !== null && (() => {
          // Active plan week: Monday of current week (or next Monday on weekends)
          const d = new Date(); const day = d.getDay();
          d.setDate(d.getDate() + (day === 0 ? 1 : day === 6 ? 2 : 1 - day));
          const weekStart = d.toISOString().slice(0, 10);
          const weekPlans = weeklyPlans.filter(p => p.week_start === weekStart);
          const graded    = weekPlans.filter(p => p.grade).length;
          return (
            <KPICard
              label="Weekly Review"
              value={weekPlans.length}
              sub={weekPlans.length
                ? `plans · ${graded} graded · click to open`
                : 'no plans yet · click to open'}
              accent={weekPlans.length === 0 ? '#f59e0b' : graded === weekPlans.length ? '#16a34a' : '#3b82f6'}
              icon={CalendarCheck}
              onClick={() => navigate('/tasks?tab=review')}
            />
          );
        })()}
      </div>

      {/* ── Row 1: Trend + Profile Pie ────────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">

        <SectionCard title="7-Day Story & QC Trend" className="lg:col-span-2">
          {trend7days.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={trend7days} margin={{ left: -10, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gStory" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d71920" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#d71920" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gPhoto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted)" fontSize={11} tick={{ dy: 4 }} />
                <YAxis yAxisId="left" stroke="var(--muted)" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--muted)" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  yAxisId="left" type="monotone" dataKey="stories" name="Stories"
                  stroke="#d71920" strokeWidth={2} fill="url(#gStory)"
                />
                <Area
                  yAxisId="left" type="monotone" dataKey="photos" name="Photos"
                  stroke="#3b82f6" strokeWidth={1.5} fill="url(#gPhoto)"
                />
                <Bar
                  yAxisId="right" dataKey="mistakes" name="QC Mistakes"
                  fill="#C9A227" radius={[4, 4, 0, 0]} barSize={10}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState msg="No trend data for the past 7 days" />
          )}
        </SectionCard>

      </div>

      {/* ── QC Top 5 Responsible — Last 7 Days ─────────────────────────────── */}
      <div className="mt-4">
        <SectionCard title="Top 5 — QC Mistakes (Last 15 Days)">
          {qcTop5.length === 0 ? (
            <p className="py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
              No responsible data recorded for the last 15 days
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {qcTop5.map((p, i) => {
                const maxM = qcTop5[0].total_mistakes || 1;
                const pct  = Math.round((p.total_mistakes / maxM) * 100);
                const rankColor = i === 0 ? '#dc2626' : i === 1 ? '#ea580c' : i === 2 ? '#ca8a04' : 'var(--muted)';
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold w-4 flex-shrink-0 text-right" style={{ color: rankColor }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-semibold truncate">{p.name}</span>
                        <span className="text-xs font-bold tabular-nums flex-shrink-0 ml-2" style={{ color: '#dc2626' }}>
                          {p.total_mistakes} mistakes
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: rankColor }} />
                        </div>
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>
                          {p.branch}{p.story_type ? ` · ${p.story_type}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Top 5 Employees on Leave — Last 7 Days ──────────────────────────── */}
      <div className="mt-4">
        <SectionCard title="Top 5 — Employees on Leave (Last 7 Days)">
          {top5Leaves.length === 0 ? (
            <p className="py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>No leave records in the last 7 days</p>
          ) : (
            <div className="flex flex-col gap-2">
              {top5Leaves.map((p, i) => {
                const maxD = top5Leaves[0].leave_days || 1;
                const pct  = Math.round((p.leave_days / maxD) * 100);
                const rankColor = i === 0 ? '#d71920' : i === 1 ? '#ea580c' : i === 2 ? '#ca8a04' : 'var(--muted)';
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold w-4 flex-shrink-0 text-right" style={{ color: rankColor }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-semibold truncate">{p.name}</span>
                        <span className="text-xs font-bold tabular-nums flex-shrink-0 ml-2" style={{ color: rankColor }}>
                          {p.leave_days}d leave
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: rankColor }} />
                        </div>
                        <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>
                          {p.branch}{p.story_type ? ` · ${p.story_type}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Top 10 Delayed Editions (Last 7 Days) ───────────────────────────── */}
      <div className="mt-4">
        <SectionCard title="Top 10 Delayed Editions — Last 7 Days">
          {topDelay.length === 0 ? (
            <EmptyState msg="No delay data for the past 7 days" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                    <th className="pb-2 pr-4 font-medium w-6">#</th>
                    <th className="pb-2 pr-4 font-medium">Edition</th>
                    <th className="pb-2 pr-4 font-medium">Unit</th>
                    <th className="pb-2 pr-4 font-medium">State</th>
                    <th className="pb-2 pr-4 font-medium text-center">Days Late</th>
                    <th className="pb-2 pr-4 font-medium text-center">Avg Delay</th>
                    <th className="pb-2 font-medium text-center">Max Delay</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {topDelay.map((e, i) => {
                    const avgH = Math.floor(e.avg_delay / 60);
                    const avgM = e.avg_delay % 60;
                    const maxH = Math.floor(e.max_delay / 60);
                    const maxM = e.max_delay % 60;
                    const fmtD = (h, m) => `+${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
                    const rankColor = i === 0 ? '#dc2626' : i === 1 ? '#ea580c' : i === 2 ? '#ca8a04' : 'var(--muted)';
                    const barPct = topDelay[0]?.avg_delay ? Math.round((e.avg_delay / topDelay[0].avg_delay) * 100) : 0;
                    return (
                      <tr key={e.edition_name} className="group">
                        <td className="py-2.5 pr-4">
                          <span className="text-xs font-bold" style={{ color: rankColor }}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 font-medium">{e.edition_name}</td>
                        <td className="py-2.5 pr-4 text-xs" style={{ color: 'var(--muted)' }}>{e.unit || '—'}</td>
                        <td className="py-2.5 pr-4 text-xs" style={{ color: 'var(--muted)' }}>{e.state || '—'}</td>
                        <td className="py-2.5 pr-4 text-center">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: '#fee2e2', color: '#b91c1c' }}>
                            {e.delayed_days}/7
                          </span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--border)', minWidth: 60 }}>
                              <div className="h-1.5 rounded-full" style={{ width: `${barPct}%`, background: '#dc2626' }} />
                            </div>
                            <span className="text-xs font-semibold tabular-nums" style={{ color: '#dc2626', minWidth: 48 }}>
                              {fmtD(avgH, avgM)}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 text-center text-xs font-semibold tabular-nums" style={{ color: '#ea580c' }}>
                          {fmtD(maxH, maxM)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Top 3 / Worst 3 Employees — Previous Month ──────────────────────── */}
      <div className="mt-4">
          <SectionCard title={`Employee Performance — ${gradingTop?.month ? new Date(gradingTop.month + '-01').toLocaleString('en-IN', { month: 'long', year: 'numeric' }) : 'Previous Month'} (PLI & Grading)`}>
            {gradingTopLoading ? (
              <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
            ) : (
            <div className="grid gap-4 sm:grid-cols-2">

              {/* Top 3 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🏆</span>
                  <span className="font-semibold text-sm" style={{ color: '#16a34a' }}>Top Performers</span>
                </div>
                {!gradingTop?.top3?.length ? (
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>No grading data for previous month</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {gradingTop.top3.map((emp, i) => {
                      const medals = ['🥇', '🥈', '🥉'];
                      const barColors = ['#16a34a', '#22c55e', '#4ade80'];
                      return (
                        <div key={emp.pan} className="flex items-center gap-3 p-2 rounded-lg"
                          style={{ background: `rgba(22,163,74,${0.08 - i * 0.02})`, border: '1px solid rgba(22,163,74,0.2)' }}>
                          <span className="text-xl flex-shrink-0">{medals[i]}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{emp.name}</div>
                            <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                              {emp.story_type} · {emp.branch}
                              {''}
                            </div>
                            <div className="mt-1 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                              <div className="h-1.5 rounded-full transition-all"
                                style={{ width: `${emp.score_pct}%`, background: barColors[i] }} />
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="text-lg font-bold tabular-nums" style={{ color: barColors[i] }}>
                              {emp.score_pct}%
                            </div>
                            <div className="text-xs" style={{ color: 'var(--muted)' }}>grade</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Worst 3 */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">⚠️</span>
                  <span className="font-semibold text-sm" style={{ color: '#dc2626' }}>Need Improvement</span>
                </div>
                {!gradingTop?.worst3?.length ? (
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>No grading data for previous month</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {gradingTop.worst3.map((emp, i) => {
                      const barColors = ['#dc2626', '#ef4444', '#f87171'];
                      return (
                        <div key={emp.pan} className="flex items-center gap-3 p-2 rounded-lg"
                          style={{ background: `rgba(220,38,38,${0.08 - i * 0.02})`, border: '1px solid rgba(220,38,38,0.2)' }}>
                          <span className="text-xl flex-shrink-0">{['🔴','🟠','🟡'][i]}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{emp.name}</div>
                            <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                              {emp.story_type} · {emp.branch}
                              {''}
                            </div>
                            <div className="mt-1 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                              <div className="h-1.5 rounded-full transition-all"
                                style={{ width: `${emp.score_pct}%`, background: barColors[i] }} />
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="text-lg font-bold tabular-nums" style={{ color: barColors[i] }}>
                              {emp.score_pct}%
                            </div>
                            <div className="text-xs" style={{ color: 'var(--muted)' }}>grade</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            )}
          </SectionCard>
        </div>

      {/* ── Profile-wise: Sanctioned vs Available ───────────────────────────── */}
      <div className="mt-4">
        <SectionCard title="Profile-wise: Sanctioned vs Available (Active Members)">
          {profiles.length === 0 ? (
            <EmptyState msg="No profile data available" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                    <th className="pb-2 pr-4 font-medium">Profile (Story Type)</th>
                    <th className="pb-2 pr-4 font-medium text-right">Available</th>
                    <th className="pb-2 pr-4 font-medium text-right">Sanctioned</th>
                    <th className="pb-2 font-medium text-right">Vacant</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {profiles.map(p => (
                    <tr key={p.profile}>
                      <td className="py-2 pr-4 font-semibold">{p.profile}</td>
                      <td className="py-2 pr-4 text-right">{p.available}</td>
                      <td className="py-2 pr-4 text-right">
                        {p.sanctionedCount != null ? p.sanctionedCount : <span style={{ color: 'var(--muted)' }}>Not set</span>}
                      </td>
                      <td className="py-2 text-right">
                        {p.vacant != null ? (
                          <span style={{ color: p.vacant > 0 ? '#d71920' : '#10b981', fontWeight: 600 }}>
                            {p.vacant > 0 ? p.vacant : 'Full'}
                          </span>
                        ) : <span style={{ color: 'var(--muted)' }}>-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── QC Mistakes detail modal ────────────────────────────────────────── */}
      {detailModal === 'qc' && (() => {
        const SEV_CFG = {
          high:    { label: 'High',    color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
          medium:  { label: 'Medium',  color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
          low:     { label: 'Low',     color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
          default: { label: '—',       color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
        };
        const allItems = qcDetail?.items || [];
        const filteredItems = qcSevFilter === 'all' ? allItems : allItems.filter(r => r.severity === qcSevFilter);
        const counts = { high: 0, medium: 0, low: 0 };
        allItems.forEach(r => { if (counts[r.severity] !== undefined) counts[r.severity]++; });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
            <div className="absolute inset-0 bg-black/60" onClick={() => setDetailModal(null)} />
            <div className="relative z-10 flex flex-col w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden"
              style={{ maxHeight: '92vh', background: 'var(--card)' }}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 shrink-0"
                style={{ background: 'linear-gradient(135deg,#7f1d1d,#dc2626)', color: '#fff' }}>
                <div>
                  <div className="flex items-center gap-2">
                    <AlertCircle size={18} />
                    <span className="font-bold text-lg">QC Mistakes — Last 7 Days</span>
                  </div>
                  {qcDetail && (
                    <p className="text-xs mt-0.5 opacity-80">{qcDetail.from} to {qcDetail.to} · {allItems.length} records</p>
                  )}
                </div>
                <button onClick={() => setDetailModal(null)}
                  className="rounded-full p-1.5 transition-opacity hover:opacity-70"
                  style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Severity filter pills */}
              {!qcDetailLoading && allItems.length > 0 && (
                <div className="flex items-center gap-2 px-5 py-3 shrink-0 flex-wrap"
                  style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                  {[
                    { key: 'all',    label: `All (${allItems.length})`, color: '#64748b' },
                    { key: 'high',   label: `High (${counts.high})`,   color: '#dc2626' },
                    { key: 'medium', label: `Medium (${counts.medium})`, color: '#d97706' },
                    { key: 'low',    label: `Low (${counts.low})`,     color: '#16a34a' },
                  ].map(f => (
                    <button key={f.key} onClick={() => setQcSevFilter(f.key)}
                      className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
                      style={{
                        background:  qcSevFilter === f.key ? f.color : 'var(--card)',
                        color:       qcSevFilter === f.key ? '#fff'  : f.color,
                        borderColor: f.color,
                      }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Body */}
              <div className="overflow-y-auto flex-1 p-4">
                {qcDetailLoading ? (
                  <div className="flex items-center justify-center py-16 gap-2" style={{ color: 'var(--muted)' }}>
                    <Loader2 size={20} className="animate-spin" /> Loading QC records…
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: 'var(--muted)' }}>
                    <AlertCircle size={32} className="opacity-20" />
                    <p className="text-sm">No QC mistakes recorded in the last 7 days</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredItems.map(item => {
                      const sev = SEV_CFG[item.severity] || SEV_CFG.default;
                      return (
                        <div key={item.id} className="rounded-xl border overflow-hidden flex flex-col"
                          style={{ borderColor: sev.border, background: 'var(--card)' }}>

                          {/* Severity strip + meta */}
                          <div className="flex items-center justify-between px-3 py-2"
                            style={{ background: sev.bg, borderBottom: `1px solid ${sev.border}` }}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ background: sev.color, color: '#fff' }}>
                                {sev.label}
                              </span>
                              {item.edition && (
                                <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
                                  {item.edition}
                                </span>
                              )}
                              {item.pullout && (
                                <span className="text-xs" style={{ color: 'var(--muted)' }}>· {item.pullout}</span>
                              )}
                            </div>
                            <span className="text-xs shrink-0" style={{ color: 'var(--muted)' }}>{item.date}</span>
                          </div>

                          <div className="p-3 flex gap-3 flex-1">
                            {/* Mistake image */}
                            {item.photo_url && (
                              <div className="shrink-0 cursor-pointer" onClick={() => setQcLightbox(item.photo_url)}>
                                <img
                                  src={item.photo_url}
                                  alt="Mistake"
                                  className="rounded-lg object-cover border"
                                  style={{ width: 90, height: 90, borderColor: 'var(--border)' }}
                                  onError={e => { e.target.style.display = 'none'; }}
                                />
                                <p className="text-xs text-center mt-1" style={{ color: '#2563eb' }}>Click to enlarge</p>
                              </div>
                            )}

                            {/* Details */}
                            <div className="flex-1 min-w-0 space-y-1.5">
                              {item.category && (
                                <span className="inline-block text-xs px-2 py-0.5 rounded font-medium"
                                  style={{ background: 'var(--border)', color: 'var(--muted)' }}>
                                  {item.category}
                                </span>
                              )}
                              <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text)' }}>
                                {item.mistake || '—'}
                              </p>
                              {item.mistakes > 1 && (
                                <p className="text-xs font-bold" style={{ color: sev.color }}>
                                  {item.mistakes} mistakes
                                </p>
                              )}
                              {item.remark && (
                                <p className="text-xs italic" style={{ color: 'var(--muted)' }}>{item.remark}</p>
                              )}
                              {(item.responsible_1 || item.responsible_2) && (
                                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                                  Responsible: {[item.responsible_1, item.responsible_2].filter(Boolean).join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── QC Image Lightbox ────────────────────────────────────────────────── */}
      {qcLightbox && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80"
          onClick={() => setQcLightbox(null)}>
          <button className="absolute top-4 right-4 rounded-full p-2"
            style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            <X size={20} />
          </button>
          <img src={qcLightbox} alt="QC Mistake"
            className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* ── Delayed Editions detail modal ───────────────────────────────────── */}
      {detailModal === 'delays' && (
        <DetailModal title="Delayed Editions — Today" onClose={() => setDetailModal(null)}>
          {editionDelays.filter(e => e.status !== 'ontime').length === 0 ? (
            <EmptyState msg="No delayed editions today" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                  <th className="pb-2 pr-4 font-medium">Edition</th>
                  <th className="pb-2 pr-4 font-medium">Unit</th>
                  <th className="pb-2 font-medium text-right">Delay</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {editionDelays.filter(e => e.status !== 'ontime').map((e, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4 font-medium">{e.edition}</td>
                    <td className="py-2 pr-4 text-xs" style={{ color: 'var(--muted)' }}>{e.unit || '—'}</td>
                    <td className="py-2 text-right font-semibold tabular-nums"
                      style={{ color: e.status === 'late' ? '#dc2626' : '#ea580c' }}>
                      {e.delay_hhmm}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DetailModal>
      )}

    </div>
  );
}

function DetailModal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="card relative z-10 w-full max-w-3xl p-5 max-h-[80vh] flex flex-col">
        <div className="mb-3 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-black/10"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function EmptyState({ msg }) {
  return (
    <p className="py-10 text-center text-sm" style={{ color: 'var(--muted)' }}>{msg}</p>
  );
}

function Skel() {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="card h-24 animate-pulse" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2 h-72 animate-pulse" />
        <div className="card h-72 animate-pulse" />
      </div>
      <div className="mt-4 card h-64 animate-pulse" />
    </div>
  );
}
