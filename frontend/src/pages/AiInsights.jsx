import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Sparkles, Send, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle, RefreshCw, Brain,
  Users, FileText, Camera, AlignLeft, AlertCircle, Search,
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { api }   from '../api/client.js';
import { PageHeader, SectionCard } from '../components/UI.jsx';

const INITIAL_CHIPS = [
  'Kal sabse zyada stories kisne file ki?',
  'Is hafte kaunsi state mein QC mistakes zyada hue?',
  'Zero stories reporters yesterday',
  'Top 5 reporters last 7 days',
  'Field visits count this week',
  'Most active branch this month',
];

export default function AiInsights() {
  const { t, state, branch } = useApp();

  // Insights data
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Reporter trend table controls
  const [search,  setSearch]  = useState('');
  const [sortKey, setSortKey] = useState('stories7d');
  const [sortAsc, setSortAsc] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Chat
  const [msgs,  setMsgs]  = useState([{
    role: 'ai',
    text: 'Namaste! Main Patrika ka AI assistant hoon. Reporters, editions, QC, field visits — kuch bhi poochh sakte hain.',
  }]);
  const [input, setInput] = useState('');
  const [busy,  setBusy]  = useState(false);
  const [chips, setChips] = useState(INITIAL_CHIPS);
  const chatEnd = useRef(null);

  // ── Load insights ───────────────────────────────────────────────────────────
  const load = useCallback((bust = false) => {
    if (bust) setRefreshing(true); else setLoading(true);
    api.aiInsights(state, branch, bust)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [state, branch]);

  useEffect(() => { load(); }, [load]);

  // ── Auto-scroll chat ────────────────────────────────────────────────────────
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  // ── Chat send ───────────────────────────────────────────────────────────────
  const ask = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setMsgs(m => [...m, { role: 'user', text: q }]);
    setInput('');
    setBusy(true);
    try {
      const r = await api.aiAssistant(q);
      setMsgs(m => [...m, { role: 'ai', text: r.answer }]);
      if (r.suggestions?.length) setChips(r.suggestions);
    } catch {
      setMsgs(m => [...m, { role: 'ai', text: 'Sorry, kuch error hua. Please try again.' }]);
    } finally {
      setBusy(false);
    }
  };

  // ── Sort / filter reporter trends ───────────────────────────────────────────
  const trends = useMemo(() => {
    const list = data?.reporterTrends ?? [];
    const filtered = search
      ? list.filter(r =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.branch.toLowerCase().includes(search.toLowerCase()))
      : list;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? (av || 0) - (bv || 0) : (bv || 0) - (av || 0);
    });
  }, [data, search, sortKey, sortAsc]);

  const visibleTrends = showAll ? trends : trends.slice(0, 20);

  const colSort = (key) => () => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };
  const sortMark = (key) => sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : '';

  const subtitle = [state !== 'All' ? state : null, branch !== 'All' ? branch : null]
    .filter(Boolean).join(' › ') || 'All States';

  if (loading) return <Skel />;

  const stats    = data?.briefingStats || {};
  const gaps     = data?.contentGaps   || [];
  const hotspots = data?.qcHotspots    || [];

  return (
    <div>
      <PageHeader title={t('nav.ai') || 'AI Insights'} subtitle={subtitle} />

      {/* ── Morning Briefing ───────────────────────────────────────────────── */}
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <Brain size={15} className="text-patrika-gold" />
            Morning Briefing — {stats.date || 'Yesterday'}
          </span>
        }
        action={
          <button
            className="btn-ghost flex items-center gap-1 text-xs"
            onClick={() => load(true)}
            disabled={refreshing}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      >
        {/* KPI strip */}
        <div className="mb-3 flex flex-wrap gap-2">
          {[
            { label: 'Stories',    value: stats.stories,    color: '#d71920', Icon: FileText   },
            { label: 'Reporters',  value: stats.reporters,  color: '#C9A227', Icon: Users      },
            { label: 'Photos',     value: stats.photos,     color: '#3b82f6', Icon: Camera     },
            { label: 'Words',      value: stats.words ? `${Math.round(stats.words / 1000)}K` : 0, color: '#16a34a', Icon: AlignLeft },
            { label: 'Zero-story', value: stats.zeroReporters, color: (stats.zeroReporters || 0) > 0 ? '#ef4444' : '#16a34a', Icon: AlertCircle },
          ].map(({ label, value, color, Icon }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{ background: color + '18', color }}
            >
              <Icon size={12} />
              <span className="font-bold">{value ?? '—'}</span>
              <span className="opacity-70">{label}</span>
            </div>
          ))}
        </div>

        {/* Briefing text */}
        <div
          className="rounded-xl p-4 text-sm leading-relaxed"
          style={{ background: 'var(--bg)', borderLeft: '3px solid var(--brand)' }}
        >
          {data?.briefing
            ? data.briefing
            : stats.stories
              ? buildStaticBriefing(stats)
              : <span style={{ color: 'var(--muted)' }}>
                  No data for yesterday. Add <code>OPENAI_API_KEY</code> in <code>.env</code> for AI-generated briefings.
                </span>
          }
        </div>

        {data?.generatedAt && (
          <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
            {data.briefing ? '✦ AI-generated (GPT-4o-mini)' : '✦ From database'} · {fmtAgo(data.generatedAt)}
          </p>
        )}
      </SectionCard>

      {/* ── Reporter Trends + Gaps ─────────────────────────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">

        {/* Reporter performance table */}
        <SectionCard
          className="lg:col-span-2"
          title="Reporter Performance — 7-Day vs 30-Day Avg"
          action={
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }} />
              <input
                className="input py-1 pl-6 text-xs w-44"
                placeholder="Search name / branch…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                  {[
                    { key: 'name',      label: 'Reporter'    },
                    { key: 'branch',    label: 'Branch'      },
                    { key: 'stories7d', label: '7-Day'       },
                    { key: 'avg7d',     label: '30d Avg/wk'  },
                    { key: 'active7d',  label: 'Active Days' },
                    { key: 'trend',     label: 'Trend'       },
                  ].map(col => (
                    <th
                      key={col.key}
                      className="cursor-pointer select-none pb-2 pt-1 pr-3 text-left font-semibold hover:opacity-80"
                      onClick={colSort(col.key)}
                    >
                      {col.label}{sortMark(col.key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleTrends.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center" style={{ color: 'var(--muted)' }}>
                      {search ? 'No reporters match your search.' : 'No data available.'}
                    </td>
                  </tr>
                )}
                {visibleTrends.map((r, i) => (
                  <tr
                    key={i}
                    style={{ borderBottom: '1px solid var(--border)' }}
                    className="transition-colors hover:bg-[var(--bg)]"
                  >
                    <td className="py-2 pr-3 font-medium">{r.name}</td>
                    <td className="py-2 pr-3" style={{ color: 'var(--muted)' }}>{r.branch}</td>
                    <td className="py-2 pr-3 font-bold">{r.stories7d}</td>
                    <td className="py-2 pr-3" style={{ color: 'var(--muted)' }}>{r.avg7d.toFixed(1)}</td>
                    <td className="py-2 pr-3">
                      <span style={{ color: r.active7d >= 5 ? '#16a34a' : r.active7d >= 3 ? '#C9A227' : '#d71920' }}>
                        {r.active7d}
                      </span>
                      <span style={{ color: 'var(--muted)' }}>/7</span>
                    </td>
                    <td className="py-2">
                      <TrendBadge trend={r.trend} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {trends.length > 20 && (
            <button
              className="btn-ghost mt-2 w-full text-xs"
              onClick={() => setShowAll(s => !s)}
            >
              {showAll ? 'Show less' : `Show all ${trends.length} reporters ↓`}
            </button>
          )}
        </SectionCard>

        {/* Coverage gaps + QC hotspots */}
        <div className="space-y-4">
          <SectionCard title="Coverage Gaps — Last 3 Days">
            {gaps.length === 0 ? (
              <p className="py-6 text-center text-xs" style={{ color: 'var(--muted)' }}>No gap data</p>
            ) : (
              <div className="space-y-1.5">
                {gaps.slice(0, 12).map(g => (
                  <div
                    key={g.beat}
                    className="flex items-center justify-between rounded-lg px-3 py-2"
                    style={{ background: 'var(--bg)' }}
                  >
                    <div className="flex items-center gap-1.5">
                      {g.severity === 'critical'
                        ? <AlertTriangle size={12} color="#d71920" />
                        : g.severity === 'warn'
                          ? <AlertCircle size={12} color="#C9A227" />
                          : <CheckCircle size={12} color="#16a34a" />
                      }
                      <span className="text-xs font-medium">{g.beat}</span>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>({g.reporters})</span>
                    </div>
                    <span
                      className="text-xs font-bold rounded-full px-2 py-0.5"
                      style={{
                        background: g.severity === 'critical' ? '#d7192018' : g.severity === 'warn' ? '#C9A22718' : '#16a34a18',
                        color:      g.severity === 'critical' ? '#d71920'   : g.severity === 'warn' ? '#C9A227'   : '#16a34a',
                      }}
                    >
                      {g.stories3d}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {hotspots.length > 0 && (
            <SectionCard title="QC Hotspots — 7 Days">
              <div className="space-y-1.5">
                {hotspots.slice(0, 6).map((h, i) => (
                  <div
                    key={h.state + i}
                    className="flex items-center justify-between rounded-lg px-3 py-2"
                    style={{ background: 'var(--bg)' }}
                  >
                    <span className="text-xs font-medium">{h.state}</span>
                    <span className="text-xs">
                      <span className="font-bold" style={{ color: '#d71920' }}>{h.mistakes7d}</span>
                      <span style={{ color: 'var(--muted)' }}> mistakes</span>
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      </div>

      {/* ── AI Chat ────────────────────────────────────────────────────────── */}
      <div className="mt-4">
        <SectionCard
          title={
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-patrika-gold" />
              AI Newsroom Chat
            </span>
          }
        >
          <div className="flex flex-col" style={{ height: 380 }}>
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[80%] rounded-2xl px-3.5 py-2 text-sm"
                    style={m.role === 'user'
                      ? { background: 'var(--brand)', color: '#fff' }
                      : { background: 'var(--bg)',    color: 'var(--text)' }}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-3.5 py-2 text-xs" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
                    Soch raha hoon…
                  </div>
                </div>
              )}
              <div ref={chatEnd} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {chips.slice(0, 4).map(c => (
                <button
                  key={c}
                  className="pill text-xs"
                  style={{ background: 'var(--bg)', color: 'var(--text)' }}
                  onClick={() => ask(c)}
                  disabled={busy}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                className="input"
                placeholder="Kuch bhi poochh — reporters, editions, QC…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && ask()}
                disabled={busy}
              />
              <button className="btn-primary" onClick={() => ask()} disabled={busy || !input.trim()}>
                <Send size={16} />
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function TrendBadge({ trend }) {
  if (trend === 'up')
    return <span className="flex items-center gap-0.5 text-xs font-semibold" style={{ color: '#16a34a' }}><TrendingUp size={13} /> Up</span>;
  if (trend === 'down')
    return <span className="flex items-center gap-0.5 text-xs font-semibold" style={{ color: '#d71920' }}><TrendingDown size={13} /> Down</span>;
  return <span className="flex items-center gap-0.5 text-xs" style={{ color: 'var(--muted)' }}><Minus size={13} /> Flat</span>;
}

function buildStaticBriefing(stats) {
  const parts = [];
  if (stats.stories)        parts.push(`Kal ${stats.stories} khabarein ${stats.reporters} reporters ne file ki.`);
  if (stats.photos)         parts.push(`${stats.photos} photos publish hue.`);
  if (stats.words)          parts.push(`Total ${Math.round(stats.words / 1000)}K words.`);
  if (stats.zeroReporters > 0) parts.push(`${stats.zeroReporters} reporters ne koi story submit nahi ki.`);
  if (stats.topReporters?.length) parts.push(`Top performers: ${stats.topReporters.slice(0, 3).join('; ')}.`);
  if (stats.criticalGaps?.length) parts.push(`Coverage gap: ${stats.criticalGaps.join(', ')} beats mein koi story nahi thi.`);
  return parts.join(' ') || 'Kal ka data available hai.';
}

function fmtAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function Skel() {
  return (
    <div>
      <div className="card h-40 animate-pulse" />
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2 h-80 animate-pulse" />
        <div className="space-y-4">
          <div className="card h-48 animate-pulse" />
          <div className="card h-28 animate-pulse" />
        </div>
      </div>
      <div className="mt-4 card h-96 animate-pulse" />
    </div>
  );
}
