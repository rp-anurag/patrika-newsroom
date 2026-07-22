/**
 * Digital Tracker — UV / PV / Story count performance dashboard.
 *
 * Roles:
 *   digital_admin   → sees all users, all teams, settings tab (upload Excel)
 *   team_lead       → sees their team members + themselves
 *   individual      → sees only their own data
 *   Admin (newsroom)→ sees all users, all teams, settings tab
 */
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  Zap, Users, Target, TrendingUp, Upload, Plus, Edit2, Trash2, X, Save,
  ChevronDown, ChevronUp, Search, RefreshCw, FileSpreadsheet, Eye, EyeOff,
  Award, AlertCircle, CheckCircle, Newspaper, Clock, Globe, ExternalLink,
  CalendarDays, ArrowRight, Timer, LayoutList, Users2, Settings, BarChart3,
  Radio, Activity, SlidersHorizontal,
  Brain, TrendingDown, Gauge, Flame, Lightbulb, Star, ShieldAlert, Bolt,
  Play, ThumbsUp, MessageSquare, Video, Youtube,
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/client.js';
import { SectionCard } from '../components/UI.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtNum = (n) => (n === null || n === undefined) ? '—' : Number(n).toLocaleString('en-IN');
const pctColor = (p) => {
  if (p === null || p === undefined) return 'var(--muted)';
  if (p >= 90) return '#16a34a';
  if (p >= 60) return '#ca8a04';
  return '#dc2626';
};

function PctBar({ pct }) {
  const p = Math.min(pct || 0, 100);
  return (
    <div className="mt-1 h-1.5 w-full rounded-full" style={{ background: 'var(--border)' }}>
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${p}%`, background: pctColor(pct) }} />
    </div>
  );
}

function MetricCell({ label, target, ach, pct }) {
  return (
    <div className="text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="text-sm font-bold" style={{ color: pctColor(pct) }}>{fmtNum(ach)}</div>
      <div className="text-[10px]" style={{ color: 'var(--muted)' }}>/ {fmtNum(target)}</div>
      {pct !== null && <div className="text-[10px] font-semibold" style={{ color: pctColor(pct) }}>{pct}%</div>}
      <PctBar pct={pct} />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="surface rounded-xl p-4 border flex items-center gap-4" style={{ borderColor: 'var(--border)' }}>
      <div className="rounded-lg p-2.5" style={{ background: `${color}18` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm font-medium">{label}</div>
        {sub && <div className="text-xs" style={{ color: 'var(--muted)' }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Month picker ───────────────────────────────────────────────────────────────
function monthStr(d) { return d.toISOString().slice(0, 7); }
function prevMonth(m) { const d = new Date(m + '-01'); d.setMonth(d.getMonth() - 1); return monthStr(d); }
function nextMonth(m) { const d = new Date(m + '-01'); d.setMonth(d.getMonth() + 1); return monthStr(d); }
const today = monthStr(new Date());

// ── Tab definitions ────────────────────────────────────────────────────────────
const TABS = [
  {
    key:   'dashboard',
    label: 'Dashboard',
    desc:  'Hourly publishing & editor activity',
    icon:  Activity,
    color: '#2563eb',
    grad:  'linear-gradient(135deg,#2563eb,#1d4ed8)',
    lightBg: '#dbeafe',
    lightFg: '#1d4ed8',
    activeColor: '#60a5fa',
    activeBg: 'rgba(37,99,235,0.25)',
  },
  {
    key:   'breaking',
    label: 'Breaking News',
    desc:  'Live multi-source news feed',
    icon:  Radio,
    color: '#dc2626',
    grad:  'linear-gradient(135deg,#dc2626,#b91c1c)',
    lightBg: '#fee2e2',
    lightFg: '#b91c1c',
    activeColor: '#f87171',
    activeBg: 'rgba(239,68,68,0.25)',
  },
  {
    key:   'alert',
    label: 'Alerts',
    desc:  'Digital team performance alerts & warnings',
    icon:  ShieldAlert,
    color: '#ea580c',
    grad:  'linear-gradient(135deg,#ea580c,#c2410c)',
    lightBg: '#ffedd5',
    lightFg: '#c2410c',
    activeColor: '#fb923c',
    activeBg: 'rgba(234,88,12,0.25)',
  },
  {
    key:   'team-leader',
    label: 'Team Leader',
    desc:  'Team-wise hourly publish monitor',
    icon:  Users2,
    color: '#059669',
    grad:  'linear-gradient(135deg,#059669,#047857)',
    lightBg: '#d1fae5',
    lightFg: '#047857',
    activeColor: '#34d399',
    activeBg: 'rgba(5,150,105,0.25)',
    teamLeadOk: true,
    adminOnly: false,
  },
  {
    key:   'performance',
    label: 'Performance',
    desc:  'Team/person — stories & UV from Chartbeat',
    icon:  BarChart3,
    color: '#0891b2',
    grad:  'linear-gradient(135deg,#0891b2,#0e7490)',
    lightBg: '#e0f2fe',
    lightFg: '#0369a1',
    activeColor: '#38bdf8',
    activeBg: 'rgba(8,145,178,0.25)',
  },
  {
    key:   'ai-insights',
    label: 'AI Insights',
    desc:  'Auto-computed editorial intelligence from your data',
    icon:  Brain,
    color: '#d97706',
    grad:  'linear-gradient(135deg,#d97706,#b45309)',
    lightBg: '#fef3c7',
    lightFg: '#b45309',
    activeColor: '#fbbf24',
    activeBg: 'rgba(217,119,6,0.25)',
  },
  {
    key:   'youtube',
    label: 'YouTube',
    desc:  'Rajasthan Patrika TV channel analytics',
    icon:  Play,
    color: '#ef4444',
    grad:  'linear-gradient(135deg,#ef4444,#dc2626)',
    lightBg: '#fee2e2',
    lightFg: '#dc2626',
    activeColor: '#f87171',
    activeBg: 'rgba(239,68,68,0.25)',
  },
  {
    key:   'settings',
    label: 'Settings',
    desc:  'Users, targets & upload',
    icon:  Settings,
    color: '#7c3aed',
    grad:  'linear-gradient(135deg,#7c3aed,#6d28d9)',
    lightBg: '#ede9fe',
    lightFg: '#6d28d9',
    activeColor: '#a78bfa',
    activeBg: 'rgba(124,58,237,0.25)',
    adminOnly: true,
  },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function DigitalTracker() {
  const { user, isAdmin, isDigitalAdmin } = useApp();
  const canAdmin   = isAdmin() || isDigitalAdmin();
  const isTeamLead = user?.digital_role === 'team_lead';
  const [tab, setTab] = useState('dashboard');

  const visibleTabs = TABS.filter(t => {
    if (t.adminOnly)   return canAdmin;
    if (t.teamLeadOk)  return canAdmin || isTeamLead;
    return true;
  });
  const activeTab   = visibleTabs.find(t => t.key === tab) || visibleTabs[0];

  // Role badge
  const roleLabel = user?.digital_role === 'digital_admin' ? 'Digital Admin'
    : user?.digital_role === 'team_lead' ? 'Team Lead'
    : user?.digital_role === 'individual' ? 'Editor'
    : user?.role || '';

  return (
    <div className="space-y-5">

      {/* ── Hero header ────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#1e40af 100%)' }}>
        <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Logo mark */}
            <div className="rounded-xl p-3 flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
              <Activity size={26} style={{ color: '#60a5fa' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">Digital Tracker</h1>
              <p className="text-sm mt-0.5" style={{ color: '#93c5fd' }}>
                patrika.com · real-time publishing monitor
              </p>
            </div>
          </div>
          {/* User badge */}
          <div className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)' }}>
              {(user?.name || 'U')[0].toUpperCase()}
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white truncate" style={{ maxWidth: 130 }}>
                {user?.name || 'User'}
              </div>
              <div className="text-xs" style={{ color: '#93c5fd' }}>{roleLabel}</div>
            </div>
          </div>
        </div>

        {/* ── Tab strip ──────────────────────────────────────────────── */}
        <div className="flex gap-1 px-4 pb-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {visibleTabs.map(t => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="relative flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-all"
                style={{
                  color:          active ? '#fff' : 'rgba(255,255,255,0.55)',
                  borderBottom:   active ? `2.5px solid ${t.activeColor || '#60a5fa'}` : '2.5px solid transparent',
                  marginBottom:   '-1px',
                }}>
                <span className="rounded-md p-1 transition-all"
                  style={{
                    background: active ? (t.activeBg || 'rgba(37,99,235,0.25)') : 'transparent',
                  }}>
                  <t.icon size={14} style={{ color: active ? (t.activeColor || '#60a5fa') : 'rgba(255,255,255,0.5)' }} />
                </span>
                {t.label}
                {active && t.key === 'breaking' && (
                  <span className="rounded-full text-[10px] font-bold px-1.5 py-0.5"
                    style={{ background: 'rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                    LIVE
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Active tab description pill ─────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="rounded-lg p-1.5" style={{ background: activeTab.lightBg }}>
          <activeTab.icon size={14} style={{ color: activeTab.lightFg }} />
        </div>
        <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
          {activeTab.desc}
        </span>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {tab === 'dashboard' && (
        <PatrikaStoriesTab user={user} canAdmin={canAdmin} />
      )}
      {tab === 'breaking' && (
        <BreakingNewsTab user={user} canAdmin={canAdmin} />
      )}
      {tab === 'alert' && (
        <AlertTab user={user} canAdmin={canAdmin} />
      )}
      {tab === 'team-leader' && (canAdmin || isTeamLead) && (
        <TeamLeaderTab user={user} canAdmin={canAdmin} />
      )}
      {tab === 'performance' && (
        <PerformanceTab user={user} canAdmin={canAdmin} />
      )}
      {tab === 'ai-insights' && (
        <AiInsightsTab user={user} canAdmin={canAdmin} />
      )}
      {tab === 'youtube' && (
        <YouTubeTab user={user} canAdmin={canAdmin} />
      )}
      {tab === 'settings' && canAdmin && (
        <SettingsTab month={today} onRefresh={() => {}} />
      )}
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab({ loading, data, users, search, setSearch,
  totalUVAch, totalUVTgt, totalPVAch, totalPVTgt, totalStAch, totalStTgt, overallPct }) {

  if (loading) return <div className="text-center py-12" style={{ color: 'var(--muted)' }}>Loading…</div>;
  if (!data)   return null;

  const uvPct = totalUVTgt ? Math.round((totalUVAch / totalUVTgt) * 100) : null;
  const pvPct = totalPVTgt ? Math.round((totalPVAch / totalPVTgt) * 100) : null;
  const stPct = totalStTgt ? Math.round((totalStAch / totalStTgt) * 100) : null;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={Users}    label="Active Members" value={data.users.length} color="#2563eb" />
        <SummaryCard icon={TrendingUp} label="UV Achievement" value={`${uvPct ?? '—'}%`}
          sub={`${fmtNum(totalUVAch)} / ${fmtNum(totalUVTgt)}`} color={pctColor(uvPct)} />
        <SummaryCard icon={Target} label="PV Achievement" value={`${pvPct ?? '—'}%`}
          sub={`${fmtNum(totalPVAch)} / ${fmtNum(totalPVTgt)}`} color={pctColor(pvPct)} />
        <SummaryCard icon={Award} label="Story Achievement" value={`${stPct ?? '—'}%`}
          sub={`${fmtNum(totalStAch)} / ${fmtNum(totalStTgt)}`} color={pctColor(stPct)} />
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-2.5" style={{ color: 'var(--muted)' }} />
          <input className="input pl-8 py-2 text-sm" placeholder="Search name / team…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {data.wp_enabled && (
          <span className="text-xs px-2 py-1 rounded" style={{ background: '#dbeafe', color: '#1e40af' }}>
            WordPress connected
          </span>
        )}
      </div>

      {/* User table */}
      <SectionCard title={`Individual Performance (${users.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 800 }}>
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">Team</th>
                <th className="pb-2 pr-3 font-medium text-center">UV</th>
                <th className="pb-2 pr-3 font-medium text-center">PV</th>
                <th className="pb-2 pr-3 font-medium text-center">Stories</th>
                <th className="pb-2 font-medium text-center">Avg Time</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ '--tw-divide-opacity': 1 }}>
              {users.map(u => (
                <tr key={u.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                  <td className="py-2.5 pr-4">
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>{u.mail_id}</div>
                  </td>
                  <td className="py-2.5 pr-4 text-xs">
                    <div>{u.team || '—'}</div>
                    {u.incharge && <div style={{ color: 'var(--muted)' }}>{u.incharge}</div>}
                  </td>
                  <td className="py-2.5 pr-3">
                    <MetricCell label="UV" target={u.uv_target} ach={u.uv_ach} pct={u.uv_pct} />
                  </td>
                  <td className="py-2.5 pr-3">
                    <MetricCell label="PV" target={u.pv_target} ach={u.pv_ach} pct={u.pv_pct} />
                  </td>
                  <td className="py-2.5 pr-3">
                    <MetricCell label="Stories" target={u.story_target} ach={u.story_ach} pct={u.story_pct} />
                  </td>
                  <td className="py-2.5 text-center">
                    <div className="text-sm font-bold">{u.avg_ach ? `${u.avg_ach}s` : '—'}</div>
                    <div className="text-[10px]" style={{ color: 'var(--muted)' }}>
                      {u.avg_tgt ? `/ ${u.avg_tgt}s` : ''}
                    </div>
                  </td>
                </tr>
              ))}
              {!users.length && (
                <tr><td colSpan={6} className="py-8 text-center" style={{ color: 'var(--muted)' }}>No data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ── Team Tab ──────────────────────────────────────────────────────────────────
function TeamTab({ loading, data }) {
  if (loading) return <div className="text-center py-12" style={{ color: 'var(--muted)' }}>Loading…</div>;
  if (!data)   return null;

  const teams = data.teams || [];

  return (
    <div className="space-y-4">
      {teams.map(team => (
        <SectionCard key={team.team} title={team.team || 'Ungrouped'}>
          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <div className="text-center">
              <div className="text-xs font-semibold uppercase" style={{ color: 'var(--muted)' }}>UV</div>
              <div className="text-2xl font-bold" style={{ color: pctColor(team.uv_pct) }}>{team.uv_pct ?? '—'}%</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>{fmtNum(team.uv_ach)} / {fmtNum(team.uv_target)}</div>
              <PctBar pct={team.uv_pct} />
            </div>
            <div className="text-center">
              <div className="text-xs font-semibold uppercase" style={{ color: 'var(--muted)' }}>PV</div>
              <div className="text-2xl font-bold" style={{ color: pctColor(team.pv_pct) }}>{team.pv_pct ?? '—'}%</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>{fmtNum(team.pv_ach)} / {fmtNum(team.pv_target)}</div>
              <PctBar pct={team.pv_pct} />
            </div>
            <div className="text-center">
              <div className="text-xs font-semibold uppercase" style={{ color: 'var(--muted)' }}>Stories</div>
              <div className="text-2xl font-bold" style={{ color: pctColor(team.story_pct) }}>{team.story_pct ?? '—'}%</div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>{fmtNum(team.story_ach)} / {fmtNum(team.story_target)}</div>
              <PctBar pct={team.story_pct} />
            </div>
          </div>

          <div className="text-xs" style={{ color: 'var(--muted)' }}>
            Members: {team.members.join(', ')}
          </div>
        </SectionCard>
      ))}
      {!teams.length && <div className="text-center py-8" style={{ color: 'var(--muted)' }}>No team data for this month</div>}
    </div>
  );
}

// ── Performance Tab (Chartbeat) ───────────────────────────────────────────────
const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'Last 7 Days' },
  { key: 'month', label: 'Last 30 Days' },
];

function PerformanceTab({ user, canAdmin }) {
  const isTeamLead = user?.digital_role === 'team_lead';
  const myTeam     = user?.team || '';

  const TODAY_STR = new Date().toISOString().slice(0, 10);

  const [period,    setPeriod]    = useState('today');
  const [fromDate,  setFromDate]  = useState(TODAY_STR);
  const [toDate,    setToDate]    = useState(TODAY_STR);
  const [articles,  setArticles]  = useState([]);
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [fetchedAt, setFetchedAt] = useState('');
  const [expanded,  setExpanded]  = useState({});
  const [sortKey,   setSortKey]   = useState('uv');

  const load = useCallback(async (p, fr, to) => {
    setLoading(true);
    try {
      const [cb, ul] = await Promise.all([
        // Use from/to for custom ranges; period for presets
        (fr && to && (fr !== to || p === 'custom'))
          ? api.chartbeat({ from: fr, to })
          : api.chartbeat({ period: p }),
        api.digitalUsers(),
      ]);
      setArticles(cb.articles || []);
      setUsers(ul.users || []);
      setFetchedAt(cb.fetched_at ? new Date(cb.fetched_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '');
    } catch (e) {
      console.error('[chartbeat]', e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(period, fromDate, toDate); }, [load, period, fromDate, toDate]); // eslint-disable-line

  const applyPeriod = (p) => {
    const now  = new Date();
    const to   = now.toISOString().slice(0, 10);
    let from = to;
    if (p === 'week')  { const s = new Date(now); s.setDate(s.getDate()-6);  from = s.toISOString().slice(0,10); }
    if (p === 'month') { const s = new Date(now); s.setDate(s.getDate()-29); from = s.toISOString().slice(0,10); }
    setPeriod(p);
    setFromDate(from);
    setToDate(to);
    setExpanded({});
  };

  const changePeriod = (p) => applyPeriod(p);

  // Seed ALL users from settings with 0, then overlay Chartbeat data
  const authorStats = useMemo(() => {
    const stats = {};
    users.forEach(u => {
      const key = (u.name || '').toLowerCase().trim();
      if (!key) return;
      stats[key] = { authorKey: key, name: u.name, team: u.team || '—', role: u.role || '', stories: 0, uv: 0, topStory: null, inSettings: true };
    });
    articles.forEach(art => {
      const key = (art.author || '').toLowerCase().trim();
      if (!key) return;
      if (!stats[key]) {
        stats[key] = { authorKey: key, name: art.author, team: '—', role: '', stories: 0, uv: 0, topStory: null, inSettings: false };
      }
      // Backend aggregates per-author: use stories count directly if provided
      stats[key].stories += art.stories || 1;
      stats[key].uv      += art.page_uniques || 0;
      if (!stats[key].topStory || (art.page_uniques || 0) > (stats[key].topStory.page_uniques || 0)) {
        stats[key].topStory = art;
      }
    });
    return Object.values(stats).sort((a, b) => b[sortKey] - a[sortKey]);
  }, [articles, users, sortKey]);

  // Unmatched = in Chartbeat but not in Settings user table
  const unmatchedStats = useMemo(() =>
    authorStats.filter(s => !s.inSettings && s.stories > 0),
  [authorStats]);

  const unmatchedTotals = useMemo(() => ({
    stories: unmatchedStats.reduce((s, a) => s + a.stories, 0),
    uv:      unmatchedStats.reduce((s, a) => s + a.uv, 0),
    count:   unmatchedStats.length,
  }), [unmatchedStats]);

  // Group only Settings users by team
  const teamGroups = useMemo(() => {
    const groups = {};
    authorStats.filter(s => s.inSettings).forEach(s => {
      const t = s.team;
      if (!groups[t]) groups[t] = { team: t, stories: 0, uv: 0, members: [] };
      groups[t].stories += s.stories;
      groups[t].uv      += s.uv;
      groups[t].members.push(s);
    });
    const sorted = Object.values(groups).sort((a, b) => b[sortKey] - a[sortKey]);
    return (isTeamLead && !canAdmin && myTeam)
      ? sorted.filter(g => g.team === myTeam)
      : sorted;
  }, [authorStats, sortKey, isTeamLead, canAdmin, myTeam]);

  const activeAuthors = authorStats.filter(a => a.inSettings && a.stories > 0);
  const totalStories  = activeAuthors.reduce((s, a) => s + a.stories, 0);
  const totalUV       = activeAuthors.reduce((s, a) => s + a.uv, 0);
  const topAuthor     = activeAuthors[0] || null;
  const maxUV         = topAuthor?.uv || 1;
  const periodLabel   = PERIODS.find(p => p.key === period)?.label || '';

  const toggleTeam = (t) => setExpanded(p => ({ ...p, [t]: !p[t] }));

  function UVBar({ value }) {
    const pct = Math.round((value / maxUV) * 100);
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 rounded-full flex-1 min-w-[60px]" style={{ background: 'var(--border)' }}>
          <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: value > 0 ? '#0891b2' : 'transparent' }} />
        </div>
        <span className="text-xs font-semibold tabular-nums" style={{ color: value > 0 ? '#0891b2' : 'var(--muted)', minWidth: 52, textAlign: 'right' }}>
          {value > 0 ? value.toLocaleString('en-IN') : '—'}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Period shortcuts + custom date range */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--border)' }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => changePeriod(p.key)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: period === p.key ? '#0891b2' : 'transparent', color: period === p.key ? '#fff' : 'var(--muted)' }}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarDays size={14} style={{ color: 'var(--muted)' }} />
          <input type="date" className="input py-1 text-sm" value={fromDate} max={toDate}
            onChange={e => { setFromDate(e.target.value); setPeriod('custom'); }} />
          <span className="text-xs" style={{ color: 'var(--muted)' }}>to</span>
          <input type="date" className="input py-1 text-sm" value={toDate} min={fromDate} max={TODAY_STR}
            onChange={e => { setToDate(e.target.value); setPeriod('custom'); }} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="card h-14 animate-pulse" />)}
        </div>
      ) : (<>

        {/* Summary cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard icon={Newspaper}  label={`Stories · ${periodLabel}`}  value={totalStories.toLocaleString('en-IN')} color="#0891b2" />
          <SummaryCard icon={Globe}      label={`Total UV · ${periodLabel}`} value={totalUV >= 1000 ? `${(totalUV/1000).toFixed(1)}K` : totalUV} color="#0891b2" />
          <SummaryCard icon={Users}      label="Total Authors"               value={users.length} color="#0891b2" />
          <SummaryCard icon={TrendingUp} label={`Top Author UV · ${periodLabel}`}
            value={topAuthor ? (topAuthor.uv >= 1000 ? `${(topAuthor.uv/1000).toFixed(1)}K` : topAuthor.uv) : '—'}
            sub={topAuthor?.name || 'No data'}
            color="#0891b2" />
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
            <RefreshCw size={12} />
            <span>Chartbeat · updated {fetchedAt || '—'} · {activeAuthors.length} active of {users.length} authors</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Sort by:</span>
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
              {[['uv','UV'],['stories','Stories']].map(([k,l]) => (
                <button key={k} onClick={() => setSortKey(k)}
                  className="px-3 py-1 text-xs font-semibold transition-colors"
                  style={{ background: sortKey === k ? '#0891b2' : 'transparent', color: sortKey === k ? '#fff' : 'var(--muted)' }}>
                  {l}
                </button>
              ))}
            </div>
            <button onClick={() => load(period)} className="btn-ghost p-1.5" title="Refresh">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Team-grouped table */}
        <div className="space-y-2">
          {teamGroups.map(grp => {
            const open = expanded[grp.team] !== false;
            return (
              <div key={grp.team} className="card overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  onClick={() => toggleTeam(grp.team)}>
                  <div className="flex items-center gap-3">
                    {open ? <ChevronUp size={15} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={15} style={{ color: 'var(--muted)' }} />}
                    <div className="rounded-md p-1.5" style={{ background: '#e0f2fe' }}>
                      <Users2 size={14} style={{ color: '#0369a1' }} />
                    </div>
                    <span className="font-bold text-sm">{grp.team}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                      {grp.members.length} members
                    </span>
                    {grp.members.filter(m => m.stories > 0).length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#dcfce7', color: '#15803d' }}>
                        {grp.members.filter(m => m.stories > 0).length} active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <div className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>STORIES</div>
                      <div className="font-bold">{grp.stories || '—'}</div>
                    </div>
                    <div className="text-right" style={{ minWidth: 90 }}>
                      <div className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>UV</div>
                      <div className="font-bold" style={{ color: grp.uv > 0 ? '#0891b2' : 'var(--muted)' }}>
                        {grp.uv > 0 ? (grp.uv >= 1000 ? `${(grp.uv/1000).toFixed(1)}K` : grp.uv.toLocaleString('en-IN')) : '—'}
                      </div>
                    </div>
                  </div>
                </button>

                {open && (
                  <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: 'var(--surface-alt,#f9fafb)', borderBottom: '1px solid var(--border)' }}>
                          <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: 'var(--muted)', paddingLeft: 48 }}>Author</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold" style={{ color: 'var(--muted)', width: 80 }}>Stories</th>
                          <th className="px-4 py-2 text-xs font-semibold" style={{ color: 'var(--muted)', minWidth: 180 }}>UV</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold" style={{ color: 'var(--muted)' }}>Top Story</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grp.members.map((m, idx) => (
                          <tr key={m.authorKey}
                            className="border-t hover:bg-black/5 dark:hover:bg-white/5"
                            style={{ borderColor: 'var(--border)', opacity: m.stories === 0 ? 0.55 : 1 }}>
                            <td className="px-4 py-2.5" style={{ paddingLeft: 48 }}>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                                  style={{ background: m.stories > 0 ? `hsl(${(idx * 47 + 200) % 360},60%,45%)` : '#9ca3af' }}>
                                  {(m.name[0] || '?').toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-sm leading-tight">{m.name}</div>
                                  <div className="text-[10px]" style={{ color: 'var(--muted)' }}>{m.role}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-center font-bold" style={{ color: m.stories > 0 ? 'var(--text)' : 'var(--muted)' }}>
                              {m.stories > 0 ? m.stories : '—'}
                            </td>
                            <td className="px-4 py-2.5" style={{ minWidth: 180 }}>
                              <UVBar value={m.uv} />
                            </td>
                            <td className="px-4 py-2.5" style={{ maxWidth: 300 }}>
                              {m.topStory ? (
                                <div>
                                  <div className="text-xs leading-snug line-clamp-2" style={{ color: 'var(--text)' }}>{m.topStory.title}</div>
                                  <div className="text-[10px] mt-0.5 font-semibold" style={{ color: '#0891b2' }}>
                                    {(m.topStory.page_uniques || 0).toLocaleString('en-IN')} UV
                                  </div>
                                </div>
                              ) : <span style={{ color: 'var(--muted)', fontSize: 11 }}>No stories {periodLabel.toLowerCase()}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Other authors (in Chartbeat but not in Settings) — totals only */}
        {unmatchedTotals.count > 0 && (
          <div className="card px-4 py-3 flex items-center justify-between" style={{ borderLeft: '3px solid #94a3b8' }}>
            <div className="flex items-center gap-3">
              <div className="rounded-md p-1.5" style={{ background: '#f1f5f9' }}>
                <Users size={14} style={{ color: '#64748b' }} />
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Other Authors</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>{unmatchedTotals.count} authors in Chartbeat not added to Settings</div>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-right">
                <div className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>STORIES</div>
                <div className="font-bold text-sm">{unmatchedTotals.stories}</div>
              </div>
              <div className="text-right" style={{ minWidth: 80 }}>
                <div className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>UV</div>
                <div className="font-bold text-sm" style={{ color: '#64748b' }}>
                  {unmatchedTotals.uv >= 1000 ? `${(unmatchedTotals.uv/1000).toFixed(1)}K` : unmatchedTotals.uv.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        )}
      </>)}
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────
function SettingsTab({ month, onRefresh }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <ExcelUploadCard
          title="Upload Digital Users"
          icon={Users}
          description="Excel columns: Name, Email, Team, Team Lead, Role (digital_admin/team_lead/individual), CMS ID, Password"
          onUpload={api.uploadDigitalUsers}
          onDone={onRefresh}
          color="#2563eb"
        />
        <ExcelUploadCard
          title="Upload UV Targets"
          icon={Target}
          description={`Excel columns: Email, Month (${month}), UV Target, PV Target, Story Target, Avg Time`}
          onUpload={(f) => api.uploadDigitalTargets(f)}
          onDone={onRefresh}
          color="#7c3aed"
        />
      </div>
      <UserManagementCard />
    </div>
  );
}

function ExcelUploadCard({ title, icon: Icon, description, onUpload, onDone, color }) {
  const ref  = useRef();
  const [busy, setBusy]   = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr]     = useState('');

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setResult(null); setErr('');
    try {
      const r = await onUpload(file);
      setResult(r);
      onDone?.();
    } catch (ex) { setErr(ex.message); }
    finally { setBusy(false); if (ref.current) ref.current.value = ''; }
  };

  return (
    <SectionCard title={title}>
      <div className="flex items-start gap-3 mb-4">
        <div className="rounded-lg p-2" style={{ background: `${color}18` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{description}</p>
      </div>

      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={upload} />
      <button
        className="btn-ghost flex items-center gap-2 text-sm"
        style={{ color }}
        onClick={() => ref.current?.click()}
        disabled={busy}>
        <Upload size={16} /> {busy ? 'Uploading…' : 'Choose Excel File'}
      </button>

      {err && (
        <div className="mt-2 flex items-center gap-1.5 text-sm" style={{ color: '#dc2626' }}>
          <AlertCircle size={14} /> {err}
        </div>
      )}
      {result && (
        <div className="mt-2 flex items-center gap-1.5 text-sm" style={{ color: '#16a34a' }}>
          <CheckCircle size={14} />
          {result.created !== undefined
            ? `Created: ${result.created} · Updated: ${result.updated} · Skipped: ${result.skipped}`
            : `Upserted: ${result.upserted} · Skipped: ${result.skipped}`}
        </div>
      )}
    </SectionCard>
  );
}

const EMPTY_USER = { name: '', mail_id: '', team: '', role: 'individual', incharge: '', cms_id: '', password: '' };

function UserManagementCard() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const [editing, setEditing] = useState(null);
  const [search, setSearch]   = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_USER);
  const [addErr, setAddErr]   = useState('');
  const [addBusy, setAddBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const d = await api.digitalUsers(); setUsers(d.users || []); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const del = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try { await api.deleteDigitalUser(id); load(); }
    catch (e) { alert(e.message); }
  };

  const save = async (id, data) => {
    try { await api.updateDigitalUser(id, data); setEditing(null); load(); }
    catch (e) { alert(e.message); }
  };

  const addUser = async () => {
    if (!addForm.name.trim())    return setAddErr('Name is required');
    if (!addForm.mail_id.trim()) return setAddErr('Email is required');
    if (!addForm.team.trim())    return setAddErr('Team is required');
    if (!addForm.password.trim()) return setAddErr('Password is required');
    setAddErr(''); setAddBusy(true);
    try {
      await api.createDigitalUser(addForm);
      setShowAdd(false);
      setAddForm(EMPTY_USER);
      load();
    } catch (e) { setAddErr(e.message); }
    finally { setAddBusy(false); }
  };

  const setAdd = (k, v) => setAddForm(f => ({ ...f, [k]: v }));

  const filtered = users.filter(u =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.mail_id?.toLowerCase().includes(search.toLowerCase())
  );

  // Unique teams for datalist
  const teamOptions = [...new Set(users.map(u => u.team).filter(Boolean))].sort();
  const leadOptions = users.filter(u => u.role === 'team_lead').map(u => u.name);

  return (
    <SectionCard title={`Digital Users (${users.length})`}>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-2.5" style={{ color: 'var(--muted)' }} />
          <input className="input pl-8 py-2 text-sm" placeholder="Search…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn-ghost px-2.5 py-2" onClick={load}><RefreshCw size={14} /></button>
        <button
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: showAdd ? '#fee2e2' : '#dbeafe', color: showAdd ? '#b91c1c' : '#1d4ed8' }}
          onClick={() => { setShowAdd(s => !s); setAddErr(''); setAddForm(EMPTY_USER); }}>
          {showAdd ? <><X size={14} /> Cancel</> : <><Plus size={14} /> Add User</>}
        </button>
      </div>

      {/* ── Add User Form ──────────────────────────────────────────────── */}
      {showAdd && (
        <div className="mb-4 rounded-xl border p-4 space-y-3"
          style={{ borderColor: '#93c5fd', background: '#eff6ff' }}>
          <div className="text-sm font-semibold" style={{ color: '#1d4ed8' }}>New User</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label text-xs">Full Name *</label>
              <input className="input py-1.5 text-sm" placeholder="Rahul Sharma"
                value={addForm.name} onChange={e => setAdd('name', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Email *</label>
              <input className="input py-1.5 text-sm" type="email" placeholder="rahul.sharma@in.patrika.com"
                value={addForm.mail_id} onChange={e => setAdd('mail_id', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Password *</label>
              <input className="input py-1.5 text-sm" type="password" placeholder="Patrika@2026"
                value={addForm.password} onChange={e => setAdd('password', e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Team *</label>
              <input className="input py-1.5 text-sm" placeholder="Madhya Pradesh" list="tl-teams"
                value={addForm.team} onChange={e => setAdd('team', e.target.value)} />
              <datalist id="tl-teams">{teamOptions.map(t => <option key={t} value={t} />)}</datalist>
            </div>
            <div>
              <label className="label text-xs">Role</label>
              <select className="input py-1.5 text-sm" value={addForm.role} onChange={e => setAdd('role', e.target.value)}>
                <option value="individual">individual</option>
                <option value="team_lead">team_lead</option>
                <option value="digital_admin">digital_admin</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">Team Lead (incharge)</label>
              <input className="input py-1.5 text-sm" placeholder="Manish Geete" list="tl-leads"
                value={addForm.incharge} onChange={e => setAdd('incharge', e.target.value)} />
              <datalist id="tl-leads">{leadOptions.map(l => <option key={l} value={l} />)}</datalist>
            </div>
            <div>
              <label className="label text-xs">CMS ID</label>
              <input className="input py-1.5 text-sm" placeholder="12345"
                value={addForm.cms_id} onChange={e => setAdd('cms_id', e.target.value)} />
            </div>
          </div>
          {addErr && <div className="text-xs" style={{ color: '#dc2626' }}>{addErr}</div>}
          <div className="flex gap-2">
            <button
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity"
              style={{ background: '#2563eb', opacity: addBusy ? 0.6 : 1 }}
              onClick={addUser} disabled={addBusy}>
              {addBusy ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
              {addBusy ? 'Saving…' : 'Save User'}
            </button>
            <button className="btn-ghost px-3 py-2 text-sm"
              onClick={() => { setShowAdd(false); setAddForm(EMPTY_USER); setAddErr(''); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {err && <div className="text-sm mb-2" style={{ color: '#dc2626' }}>{err}</div>}

      {loading ? (
        <div className="text-center py-8" style={{ color: 'var(--muted)' }}>Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 700 }}>
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                <th className="pb-2 pr-3 font-medium">Name</th>
                <th className="pb-2 pr-3 font-medium">Email</th>
                <th className="pb-2 pr-3 font-medium">Team</th>
                <th className="pb-2 pr-3 font-medium">Role</th>
                <th className="pb-2 pr-3 font-medium">CMS ID</th>
                <th className="pb-2 pr-3 font-medium">Pwd</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {filtered.map(u => (
                editing?.id === u.id
                  ? <EditRow key={u.id} user={u} onSave={save} onCancel={() => setEditing(null)} />
                  : (
                    <tr key={u.id}>
                      <td className="py-2 pr-3 font-medium">{u.name}</td>
                      <td className="py-2 pr-3 text-xs" style={{ color: 'var(--muted)' }}>{u.mail_id}</td>
                      <td className="py-2 pr-3 text-xs">{u.team || '—'}</td>
                      <td className="py-2 pr-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: u.role === 'digital_admin' ? '#dbeafe' : u.role === 'team_lead' ? '#fef9c3' : '#f3f4f6', color: '#374151' }}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-xs">{u.cms_id || '—'}</td>
                      <td className="py-2 pr-3 text-xs">{u.has_password ? '✓' : '✗'}</td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <button className="btn-ghost px-1.5 py-1" onClick={() => setEditing(u)} title="Edit"><Edit2 size={13} /></button>
                          <button className="btn-ghost px-1.5 py-1" onClick={() => del(u.id)} title="Delete" style={{ color: '#dc2626' }}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  )
              ))}
              {!filtered.length && (
                <tr><td colSpan={7} className="py-6 text-center" style={{ color: 'var(--muted)' }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function EditRow({ user, onSave, onCancel }) {
  const [form, setForm] = useState({
    name:     user.name || '',
    team:     user.team || '',
    role:     user.role || 'individual',
    incharge: user.incharge || '',
    cms_id:   user.cms_id || '',
    password: '',
    is_emp_working: user.is_emp_working ?? 1,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <tr style={{ background: 'var(--bg-alt, var(--bg))' }}>
      <td className="py-2 pr-2"><input className="input py-1 text-xs w-full" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Name" /></td>
      <td className="py-2 pr-2 text-xs" style={{ color: 'var(--muted)' }}>{user.mail_id}</td>
      <td className="py-2 pr-2"><input className="input py-1 text-xs w-full" value={form.team} onChange={e => set('team', e.target.value)} placeholder="Team" /></td>
      <td className="py-2 pr-2">
        <select className="input py-1 text-xs" value={form.role} onChange={e => set('role', e.target.value)}>
          <option value="individual">individual</option>
          <option value="team_lead">team_lead</option>
          <option value="digital_admin">digital_admin</option>
        </select>
      </td>
      <td className="py-2 pr-2"><input className="input py-1 text-xs w-full" value={form.cms_id} onChange={e => set('cms_id', e.target.value)} placeholder="CMS ID" /></td>
      <td className="py-2 pr-2"><input className="input py-1 text-xs w-full" value={form.password} onChange={e => set('password', e.target.value)} placeholder="New pwd (optional)" type="password" /></td>
      <td className="py-2">
        <div className="flex gap-1">
          <button className="btn-ghost px-1.5 py-1" style={{ color: '#16a34a' }} onClick={() => onSave(user.id, form)}><Save size={13} /></button>
          <button className="btn-ghost px-1.5 py-1" onClick={onCancel}><X size={13} /></button>
        </div>
      </td>
    </tr>
  );
}

// ── Patrika Stories Tab ───────────────────────────────────────────────────────
const TODAY = new Date().toISOString().slice(0, 10);
const STORY_PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'Last 7 Days' },
  { key: 'month', label: 'Last 30 Days' },
];

const PATRIKA_CATEGORIES = [
  { value: 'all',             label: 'All Categories' },
  { value: 'breaking-news',   label: 'Breaking News' },
  { value: 'national',        label: 'National' },
  { value: 'crime-news',      label: 'Crime' },
  { value: 'sports-news',     label: 'Sports' },
  { value: 'entertainment',   label: 'Entertainment' },
  { value: 'business',        label: 'Business' },
  { value: 'education-news',  label: 'Education' },
  { value: 'health',          label: 'Health' },
  { value: 'exclusive',       label: 'Exclusive' },
];

// Categories fetched when "All" is selected
const ALL_FETCH_CATS = ['breaking-news', 'national', 'crime-news', 'sports-news', 'entertainment'];

// Searchable combobox — type to filter options, click to select
function SearchSelect({ value, onChange, options, placeholder = 'Search…', allLabel = 'All' }) {
  const [text, setText]       = useState('');
  const [open, setOpen]       = useState(false);
  const ref                   = useRef(null);

  // Derive display text from current value
  const displayLabel = value === 'all' ? '' : (options.find(o => o.value === value)?.label ?? value);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(text.toLowerCase()) ||
    (o.value !== 'all' && o.value.toLowerCase().includes(text.toLowerCase()))
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (val) => {
    onChange(val);
    setText('');
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 180 }}>
      <div className="input flex items-center gap-1.5 py-1.5 cursor-text"
        style={{ paddingRight: 28 }}
        onClick={() => setOpen(true)}>
        {!open && value !== 'all'
          ? <span className="text-sm truncate flex-1">{displayLabel}</span>
          : <input
              autoFocus={open}
              className="flex-1 bg-transparent outline-none text-sm"
              placeholder={open ? placeholder : (value === 'all' ? allLabel : displayLabel)}
              value={text}
              onChange={e => { setText(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
            />
        }
        {value !== 'all' && (
          <button onMouseDown={e => { e.stopPropagation(); select('all'); }}
            style={{ color: 'var(--muted)', flexShrink: 0 }}>
            <X size={12} />
          </button>
        )}
      </div>
      {open && (
        <div className="card" style={{
          position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 200,
          maxHeight: 220, overflowY: 'auto', padding: '4px 0',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}>
          <div onMouseDown={() => select('all')}
            className="px-3 py-1.5 text-sm cursor-pointer"
            style={{ color: value === 'all' ? '#0891b2' : 'var(--muted)', fontWeight: value === 'all' ? 600 : 400 }}>
            {allLabel}
          </div>
          {filtered.filter(o => o.value !== 'all').map(o => (
            <div key={o.value} onMouseDown={() => select(o.value)}
              className="px-3 py-1.5 text-sm cursor-pointer"
              style={{ background: value === o.value ? '#e0f2fe' : 'transparent', color: value === o.value ? '#0891b2' : 'inherit', fontWeight: value === o.value ? 600 : 400 }}>
              {o.label}
            </div>
          ))}
          {filtered.filter(o => o.value !== 'all').length === 0 && (
            <div className="px-3 py-2 text-xs" style={{ color: 'var(--muted)' }}>No matches</div>
          )}
        </div>
      )}
    </div>
  );
}

function PatrikaStoriesTab({ user, canAdmin }) {
  const [period,       setPeriod]       = useState('today');
  const [fromDate,     setFromDate]     = useState(TODAY);
  const [toDate,       setToDate]       = useState(TODAY);
  const [category,     setCategory]     = useState('all');
  const [editorFilter, setEditorFilter] = useState('all');
  const [liveArts,     setLiveArts]     = useState([]);
  const [saved,        setSaved]        = useState([]);
  const [fetching,     setFetching]     = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [err,          setErr]          = useState('');
  const [savedIds,     setSavedIds]     = useState(new Set());
  const [drafts,       setDrafts]       = useState({});
  const [authorMap,    setAuthorMap]    = useState({});
  const [authorsLoading, setAuthorsLoading] = useState(false);
  const [showFilters,  setShowFilters]  = useState(false);
  // Team leader mapping: editor name (lowercase) → { lead, team }
  const [tlMap, setTlMap] = useState({});

  useEffect(() => {
    api.digitalUsers()
      .then(r => {
        const map = {};
        (r.users || []).forEach(u => {
          if (u.name && u.incharge) {
            map[u.name.trim().toLowerCase()] = { lead: u.incharge, team: u.team || '' };
          }
        });
        setTlMap(map);
      })
      .catch(() => {});
  }, []);

  // Keep a single `date` alias for today-mode (used by live scrape & save form)
  const date = period === 'today' ? fromDate : toDate;
  // Human-readable label for display (range or single date)
  const dateLabel = fromDate === toDate ? fromDate : `${fromDate} to ${toDate}`;

  const setDraft = (i, k, v) =>
    setDrafts(prev => ({ ...prev, [i]: { ...(prev[i] || {}), [k]: v } }));

  // Apply period shortcut → set from/to
  const applyPeriod = (p) => {
    const now = new Date();
    const to  = TODAY;
    let from = to;
    if (p === 'week')  { const s = new Date(now); s.setDate(s.getDate()-6);  from = s.toISOString().slice(0,10); }
    if (p === 'month') { const s = new Date(now); s.setDate(s.getDate()-29); from = s.toISOString().slice(0,10); }
    setPeriod(p);
    setFromDate(from);
    setToDate(to);
    setEditorFilter('all');
  };

  const loadSaved = async (fr, to) => {
    setLoadingSaved(true);
    const f = fr ?? fromDate;
    const t = to ?? toDate;
    try {
      const params = f === t ? { date: f } : { from: f, to: t };
      const res = await api.breakingNews(params);
      setSaved(res.entries || []);
    } catch (_) {}
    finally { setLoadingSaved(false); }
  };

  // Fetch author names in chunks of 100 so progress updates live
  const fetchAuthors = async (arts) => {
    const urls = arts.map(a => a.url).filter(Boolean);
    if (!urls.length) return;
    setAuthorsLoading(true);
    setAuthorMap({});
    const CHUNK = 100;
    try {
      for (let i = 0; i < urls.length; i += CHUNK) {
        const chunk = urls.slice(i, i + CHUNK);
        const res = await api.batchAuthors(chunk);
        setAuthorMap(prev => ({ ...prev, ...(res.authors || {}) }));
      }
    } catch (_) {}
    finally { setAuthorsLoading(false); }
  };

  const fetchLive = async () => {
    // Sitemap only has today's articles — only fetch when viewing exactly today
    if (fromDate !== TODAY || toDate !== TODAY) {
      setLiveArts([]); setAuthorMap({}); setAuthorsLoading(false);
      return;
    }
    setFetching(true); setErr(''); setLiveArts([]); setDrafts({}); setSavedIds(new Set());
    setAuthorMap({}); setAuthorsLoading(false);
    try {
      // Always fetch today's articles; category is filtered client-side
      const res  = await api.fetchPatrikaByDate(TODAY);
      const arts = res.articles || [];
      setLiveArts(arts);
      if (!arts.length) setErr(`No articles found in sitemap for ${TODAY}.`);
      else fetchAuthors(arts);
    } catch (e) { setErr('Fetch: ' + e.message); }
    finally { setFetching(false); }
  };

  // Auto-load when date range changes (category is now client-side only)
  useEffect(() => {
    setEditorFilter('all');
    setCategory('all');
    loadSaved(fromDate, toDate);
    fetchLive();
  }, [fromDate, toDate]); // eslint-disable-line

  const saveRow = async (art, i) => {
    const d = drafts[i] || {};
    try {
      await api.addBreakingNews({
        entry_date:      art.publish_date?.slice(0, 10) || date,
        editor_name:     d.editor_name    !== undefined ? d.editor_name    : (art.author       || ''),
        article_title:   art.title  || '',
        article_url:     art.url    || '',
        time_filed:      d.time_filed     !== undefined ? d.time_filed     : (art.publish_time || ''),
        source_name:     d.source_name    || '',
        source_time:     d.source_time    || null,
        competitor_time: d.competitor_time || null,
        value_addition:  d.value_addition  || '',
        wp_publish_date: art.publish_date  || null,
      });
      setSavedIds(prev => new Set([...prev, i]));
      loadSaved(date);
    } catch (e) { alert(e.message); }
  };

  const catLabel = PATRIKA_CATEGORIES.find(c => c.value === category)?.label || category;
  const isLoading = fetching || loadingSaved;

  // Merged dataset for dashboard (deduplicate by URL)
  const seenUrls = new Set(saved.map(e => e.article_url).filter(Boolean));
  const uniqueLive = liveArts.filter(a => !a.url || !seenUrls.has(a.url));
  const allStories = [
    ...saved.map(e => ({
      name:     e.editor_name  || null,
      time:     e.time_filed?.slice(0, 5) || null,
      title:    e.article_title,
      url:      e.article_url,
      category: null,
      src:      'tracked',
    })),
    ...uniqueLive.map(a => ({
      name:     authorMap[a.url] || a.author || null,  // enriched from batch fetch
      time:     a.publish_time || null,
      title:    a.title,
      url:      a.url,
      category: a.category,
      src:      'live',
    })),
  ];

  // Editor names for dropdown
  const editorNames = useMemo(() => {
    const names = [...new Set(allStories.map(s => s.name).filter(Boolean))].sort();
    return names;
  }, [allStories]);

  // Apply category + editor filters (both client-side)
  const filteredStories = useMemo(() => {
    return allStories.filter(s => {
      if (editorFilter !== 'all' && s.name !== editorFilter) return false;
      if (category !== 'all') {
        if (!s.url) return true; // no URL — can't determine category, include
        try {
          const seg = new URL(s.url).pathname.split('/').filter(Boolean)[0] || '';
          if (seg && seg !== category) return false;
        } catch { /* malformed URL — include */ }
      }
      return true;
    });
  }, [allStories, editorFilter, category]);

  const authorsDone  = Object.keys(authorMap).length;
  const authorsTotal = liveArts.length;

  return (
    <div className="space-y-4">

      {/* ── Controls ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <CalendarDays size={14} style={{ color: 'var(--muted)' }} />
          <input type="date" className="input py-1.5 text-sm" value={fromDate} max={toDate}
            onChange={e => setFromDate(e.target.value)} />
          <span className="text-xs" style={{ color: 'var(--muted)' }}>to</span>
          <input type="date" className="input py-1.5 text-sm" value={toDate} min={fromDate} max={TODAY}
            onChange={e => setToDate(e.target.value)} />
        </div>

        {/* Filter button */}
        <button
          onClick={() => setShowFilters(f => !f)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: (category !== 'all' || editorFilter !== 'all') ? '#0891b2' : 'var(--border)',
            color:      (category !== 'all' || editorFilter !== 'all') ? '#fff' : 'var(--muted)',
          }}>
          <SlidersHorizontal size={14} />
          Filter
          {(category !== 'all' || editorFilter !== 'all') && (
            <span className="ml-0.5 text-xs font-bold">
              ({[category !== 'all' ? 1 : 0, editorFilter !== 'all' ? 1 : 0].reduce((a,b)=>a+b,0)})
            </span>
          )}
        </button>

        {/* Status */}
        {isLoading && (
          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--muted)' }}>
            <RefreshCw size={12} className="animate-spin" /> Loading…
          </span>
        )}
        {!isLoading && authorsLoading && (
          <span className="text-xs flex items-center gap-1" style={{ color: '#2563eb' }}>
            <RefreshCw size={12} className="animate-spin" />
            Loading editor names… {authorsDone}/{authorsTotal}
          </span>
        )}
        {!isLoading && !authorsLoading && authorsDone > 0 && (
          <span className="text-xs flex items-center gap-1" style={{ color: '#16a34a' }}>
            <Users2 size={12} />
            {authorsDone} editor names loaded
          </span>
        )}
        <button className="btn-ghost px-2.5 py-1.5 ml-auto"
          onClick={() => { loadSaved(fromDate, toDate); fetchLive(); }}
          title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'var(--border)' }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Filters:</span>
          <SearchSelect
            value={category}
            onChange={setCategory}
            options={PATRIKA_CATEGORIES}
            placeholder="Search category…"
            allLabel="All Categories"
          />
          <SearchSelect
            value={editorFilter}
            onChange={setEditorFilter}
            options={[{ value: 'all', label: 'All Editors' }, ...editorNames.map(n => ({ value: n, label: n }))]}
            placeholder="Search editor…"
            allLabel="All Editors"
          />
          {(category !== 'all' || editorFilter !== 'all') && (
            <button className="text-xs px-2 py-1 rounded" style={{ color: '#dc2626', background: '#fee2e2' }}
              onClick={() => { setCategory('all'); setEditorFilter('all'); }}>
              Clear all
            </button>
          )}
        </div>
      )}

      {err && (
        <div className="text-sm px-3 py-2 rounded-lg" style={{ color: '#92400e', background: '#fef3c7' }}>
          {err}
        </div>
      )}

      <StoriesDashboard
        allStories={filteredStories}
        date={dateLabel}
        loading={isLoading}
        authorsLoading={authorsLoading}
        authorsDone={authorsDone}
        authorsTotal={authorsTotal}
        authorMap={authorMap}
        tlMap={tlMap}
      />
    </div>
  );
}

// ── Stories Dashboard ─────────────────────────────────────────────────────────
function HeatCell({ count, max }) {
  if (!count) return (
    <div className="rounded flex items-center justify-center mx-auto"
      style={{ width: 34, height: 24, background: 'transparent' }} />
  );
  const r = count / Math.max(max, 1);
  const bg   = r >= 0.7 ? '#15803d' : r >= 0.35 ? '#4ade80' : '#bbf7d0';
  const fg   = r >= 0.7 ? '#fff'    : '#14532d';
  return (
    <div className="rounded flex items-center justify-center mx-auto font-bold text-xs"
      style={{ width: 34, height: 24, background: bg, color: fg }}>
      {count}
    </div>
  );
}

// ── Heatmap legend ────────────────────────────────────────────────────────────
function HeatLegend({ extra }) {
  return (
    <div className="flex items-center gap-3 mt-3 text-xs flex-wrap" style={{ color: 'var(--muted)' }}>
      <span>Stories / hour:</span>
      {[{ bg: '#bbf7d0', label: 'Low' }, { bg: '#4ade80', label: 'Mid' }, { bg: '#15803d', label: 'High' }]
        .map(item => (
          <div key={item.label} className="flex items-center gap-1">
            <div className="rounded" style={{ width: 14, height: 14, background: item.bg }} />
            <span>{item.label}</span>
          </div>
        ))}
      {extra && <span className="ml-auto">{extra}</span>}
    </div>
  );
}

// ── Category accent palette (rotates) ────────────────────────────────────────
const CAT_PALETTE = [
  '#2563eb','#7c3aed','#dc2626','#ea580c','#ca8a04',
  '#16a34a','#0891b2','#db2777','#6366f1','#14b8a6','#f59e0b','#65a30d',
];

// ── Category card ─────────────────────────────────────────────────────────────
function CatCard({ cat, total, maxTotal, color, isSelected, onClick }) {
  const pct = Math.round(total / Math.max(maxTotal, 1) * 100);
  return (
    <button onClick={onClick}
      className="rounded-xl p-3 border flex flex-col gap-2 text-left w-full transition-all"
      style={{
        background:  isSelected ? `${color}10` : 'var(--surface)',
        borderColor: isSelected ? color : 'var(--border)',
        borderWidth: isSelected ? '2px' : '1px',
        borderStyle: 'solid',
      }}>
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-medium capitalize leading-tight" style={{ color: isSelected ? color : 'var(--muted)' }}>{cat}</p>
        <span className="text-lg font-bold leading-none flex-shrink-0" style={{ color }}>{total}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        {pct}% of peak
        <span className="ml-1.5 font-medium" style={{ color }}>
          {pct >= 80 ? '🔥 Top' : pct >= 50 ? '↑ Active' : ''}
        </span>
      </p>
    </button>
  );
}

// ── Editor card ───────────────────────────────────────────────────────────────
function EditorCard({ person, isSelected, onClick }) {
  const initials = person.name.trim().split(/\s+/).slice(0,2).map(w => w[0]?.toUpperCase() || '').join('');
  const activeHours = Object.keys(person.hourCounts).length;
  const peakHr = Object.entries(person.hourCounts).sort((a,b) => b[1]-a[1])[0];
  return (
    <button onClick={onClick}
      className="rounded-xl p-3 border text-left w-full transition-all"
      style={{
        background:   isSelected ? '#f0fdf4' : 'var(--surface)',
        borderColor:  isSelected ? '#16a34a'  : 'var(--border)',
        borderWidth:  isSelected ? '2px'      : '1px',
        borderStyle:  'solid',
      }}>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="rounded-full w-9 h-9 flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ background: isSelected ? '#dcfce7' : '#f0fdf4', color: '#15803d' }}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate leading-tight">{person.name}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {activeHours} hr{activeHours !== 1 ? 's' : ''} active
            {peakHr ? ` · peak ${peakHr[0].padStart(2,'0')}:00` : ''}
          </p>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-xl font-bold leading-none" style={{ color: '#16a34a' }}>
          {person.stories.length}
        </span>
        <span className="text-xs pb-0.5" style={{ color: 'var(--muted)' }}>stories</span>
      </div>
    </button>
  );
}

// ── Section divider header ────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, color, title, meta, right }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="flex items-center gap-2">
        <div className="rounded-lg p-1.5" style={{ background: `${color}18` }}>
          <Icon size={15} style={{ color }} />
        </div>
        <span className="font-bold text-sm">{title}</span>
        {meta && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--border)', color: 'var(--muted)' }}>{meta}</span>}
      </div>
      {right && <div className="text-xs" style={{ color: 'var(--muted)' }}>{right}</div>}
    </div>
  );
}

function StoriesDashboard({ allStories, date, loading,
  authorsLoading, authorsDone, authorsTotal, authorMap = {}, tlMap = {} }) {

  const [selectedEditor,   setSelectedEditor]   = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedLead,     setSelectedLead]     = useState(null);
  const [showCatHeat,      setShowCatHeat]      = useState(false);
  const [showEdHeat,       setShowEdHeat]       = useState(false);
  const [showTLHeat,       setShowTLHeat]       = useState(false);
  const [subTab,           setSubTab]           = useState('team-leader');

  // Normalise category: prefer s.category (already server-extracted), else derive from URL
  const getCat = (s) => {
    if (s.category) return s.category;
    if (s.url) {
      try {
        const seg = new URL(s.url).pathname.split('/').filter(Boolean)[0] || '';
        return seg.replace(/-news$/, '').replace(/-/g, ' ') || 'other';
      } catch { }
    }
    return 'other';
  };

  if (loading && !allStories.length)
    return <div className="text-center py-12" style={{ color: 'var(--muted)' }}>Loading stories from Patrika.com…</div>;

  if (!allStories.length && !loading)
    return (
      <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
        <LayoutList size={32} className="mx-auto mb-2 opacity-25" />
        <p className="text-sm">No stories found for {date}.</p>
        <p className="text-xs mt-1">Change the date or category and wait for auto-load.</p>
      </div>
    );

  // ── Hourly totals ────────────────────────────────────────────────────────
  const hourTotals = {};
  allStories.forEach(s => {
    if (!s.time) return;
    const hr = parseInt(s.time.split(':')[0], 10);
    if (!isNaN(hr)) hourTotals[hr] = (hourTotals[hr] || 0) + 1;
  });
  const activeHours  = Object.keys(hourTotals).map(Number).sort((a, b) => a - b);
  const maxHourTotal = Math.max(1, ...Object.values(hourTotals));
  const peakHr       = activeHours.reduce((best, h) =>
    (hourTotals[h] || 0) > (hourTotals[best] || 0) ? h : best, activeHours[0]);

  // ── Category breakdown ────────────────────────────────────────────────────
  const byCat = {};
  allStories.forEach(s => {
    const cat = getCat(s);
    if (!byCat[cat]) byCat[cat] = { cat, total: 0, hourCounts: {} };
    byCat[cat].total++;
    if (s.time) {
      const hr = parseInt(s.time.split(':')[0], 10);
      if (!isNaN(hr)) byCat[cat].hourCounts[hr] = (byCat[cat].hourCounts[hr] || 0) + 1;
    }
  });
  const catRows    = Object.values(byCat).sort((a, b) => b.total - a.total);
  const maxCatHour = Math.max(1, ...catRows.flatMap(c => Object.values(c.hourCounts)));
  const maxCatTotal = catRows[0]?.total || 1;

  // ── Editor-wise breakdown ─────────────────────────────────────────────────
  const byPerson = {};
  allStories.filter(s => s.name).forEach(s => {
    if (!byPerson[s.name]) byPerson[s.name] = { name: s.name, stories: [], hourCounts: {} };
    byPerson[s.name].stories.push(s);
    if (s.time) {
      const hr = parseInt(s.time.split(':')[0], 10);
      if (!isNaN(hr)) byPerson[s.name].hourCounts[hr] = (byPerson[s.name].hourCounts[hr] || 0) + 1;
    }
  });
  const persons       = Object.values(byPerson).sort((a, b) => b.stories.length - a.stories.length);
  const maxPersonHour = Math.max(1, ...persons.flatMap(p => Object.values(p.hourCounts)));
  const topEditor     = persons[0];
  const namedCount    = allStories.filter(s => s.name).length;

  const editorStories = selectedEditor
    ? allStories.filter(s => s.name === selectedEditor).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    : [];

  // ── Team-leader breakdown ─────────────────────────────────────────────────
  const hasTLMap = Object.keys(tlMap).length > 0;
  const byLead = {};
  allStories.filter(s => s.name).forEach(s => {
    const info = tlMap[s.name.trim().toLowerCase()];
    const lead = info?.lead || (hasTLMap ? '(No TL mapped)' : null);
    if (!lead) return;
    if (!byLead[lead]) byLead[lead] = { lead, team: info?.team || '', stories: [], editors: new Set(), hourCounts: {} };
    byLead[lead].stories.push(s);
    byLead[lead].editors.add(s.name);
    if (s.time) {
      const hr = parseInt(s.time.split(':')[0], 10);
      if (!isNaN(hr)) byLead[lead].hourCounts[hr] = (byLead[lead].hourCounts[hr] || 0) + 1;
    }
  });
  const leadRows    = Object.values(byLead)
    .map(l => ({ ...l, editors: [...l.editors] }))
    .sort((a, b) => b.stories.length - a.stories.length);
  const maxLeadHour = Math.max(1, ...leadRows.flatMap(l => Object.values(l.hourCounts)));

  const leadStories = selectedLead
    ? allStories.filter(s => {
        if (!s.name) return false;
        const info = tlMap[s.name.trim().toLowerCase()];
        return (info?.lead || '(No TL mapped)') === selectedLead;
      }).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    : [];

  return (
    <div className="space-y-5">

      {/* ── 4 KPI cards ──────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={Newspaper} label="Total Stories"
          value={allStories.length} sub={date} color="#2563eb" />
        <SummaryCard icon={Globe} label="Categories Active"
          value={catRows.length} sub={`Peak: ${peakHr !== undefined ? String(peakHr).padStart(2,'0')+':00' : '—'}`} color="#7c3aed" />
        <SummaryCard icon={Clock}
          label="Peak Hour"
          value={peakHr !== undefined ? `${String(peakHr).padStart(2, '0')}:00` : '—'}
          sub={peakHr !== undefined ? `${hourTotals[peakHr]} stories` : ''}
          color="#ca8a04" />
        <SummaryCard icon={Users2}
          label="Top Editor"
          value={authorsLoading && !topEditor ? '…' : (topEditor?.name || '—')}
          sub={topEditor ? `${topEditor.stories.length} stories`
            : authorsLoading ? `Loading ${authorsDone}/${authorsTotal}` : '—'}
          color="#16a34a" />
      </div>

      {/* ══ SUB-TAB STRIP ════════════════════════════════════════════════ */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {[
          { key: 'team-leader', label: 'Team Leader Activity', icon: Users2,  color: '#6366f1' },
          { key: 'editor',      label: 'Editor Activity',      icon: Users,   color: '#16a34a' },
          { key: 'category',    label: 'Category Activity',    icon: Globe,   color: '#7c3aed' },
        ].map(t => {
          const active = subTab === t.key;
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setSubTab(t.key)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-all relative"
              style={{
                color:        active ? t.color : 'var(--muted)',
                borderBottom: active ? `2px solid ${t.color}` : '2px solid transparent',
                marginBottom: '-1px',
                background:   'transparent',
              }}>
              <Icon size={14} style={{ color: active ? t.color : 'var(--muted)' }} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ══ TEAM LEADER SUB-TAB ══════════════════════════════════════════ */}
      {subTab === 'team-leader' && (
        <div className="space-y-3">
          <SectionHeader
            icon={Users2} color="#6366f1"
            title="Team Leader Activity"
            meta={leadRows.length ? `${leadRows.length} teams` : authorsLoading ? 'Loading…' : 'No data yet'}
            right={`${namedCount} attributed stories`}
          />

          {/* Team leader cards */}
          {leadRows.length > 0 && (
            <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
              {leadRows.map((l, idx) => {
                const colors = ['#6366f1','#0891b2','#d97706','#16a34a','#dc2626','#7c3aed'];
                const col = colors[idx % colors.length];
                const isSel = selectedLead === l.lead;
                const initials = l.lead.trim().split(/\s+/).slice(0,2).map(w => w[0]?.toUpperCase()||'').join('');
                const peakHr = Object.entries(l.hourCounts).sort((a,b)=>b[1]-a[1])[0];
                const activeHrs = Object.keys(l.hourCounts).length;
                return (
                  <button key={l.lead} onClick={() => setSelectedLead(isSel ? null : l.lead)}
                    className="rounded-xl p-3 border text-left w-full transition-all"
                    style={{
                      background: isSel ? `${col}10` : 'var(--surface)',
                      borderColor: isSel ? col : 'var(--border)',
                      borderWidth: isSel ? '2px' : '1px',
                    }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="rounded-full w-9 h-9 flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: `${col}18`, color: col }}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate leading-tight">{l.lead}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                          {l.editors.length} editor{l.editors.length !== 1 ? 's' : ''}
                          {peakHr ? ` · peak ${peakHr[0].padStart(2,'0')}:00` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-xl font-bold leading-none" style={{ color: col }}>{l.stories.length}</span>
                      <span className="text-xs pb-0.5" style={{ color: 'var(--muted)' }}>
                        {activeHrs} hr{activeHrs !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Team lead stories panel */}
          {selectedLead && (() => {
            const idx = leadRows.findIndex(l => l.lead === selectedLead);
            const colors = ['#6366f1','#0891b2','#d97706','#16a34a','#dc2626','#7c3aed'];
            const col = colors[idx % colors.length];
            return (
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${col}40`, background: 'var(--surface)' }}>
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ background: `linear-gradient(90deg,${col}0d,${col}1a)`, borderBottom: `1px solid ${col}30` }}>
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg p-1.5" style={{ background: `${col}22` }}>
                      <Users2 size={14} style={{ color: col }} />
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: col }}>{selectedLead}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        {leadStories.length} {leadStories.length === 1 ? 'story' : 'stories'} · {date}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedLead(null)}
                    className="rounded-full p-1 hover:bg-black/5 transition-colors" style={{ color: col }}>
                    <X size={16} />
                  </button>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {leadStories.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>No stories found</div>
                  ) : leadStories.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-black/[0.02] transition-colors">
                      <span className="text-xs font-mono mt-0.5 flex-shrink-0 tabular-nums"
                        style={{ color: 'var(--muted)', minWidth: 40 }}>{s.time || '—'}</span>
                      <div className="flex-1 min-w-0">
                        {s.url
                          ? <a href={s.url} target="_blank" rel="noopener noreferrer"
                              className="text-sm font-medium leading-snug hover:underline line-clamp-2"
                              style={{ color: 'var(--text)' }}>{s.title}</a>
                          : <p className="text-sm font-medium leading-snug line-clamp-2">{s.title}</p>
                        }
                        {s.name && (
                          <span className="text-xs mt-0.5 inline-flex items-center gap-1" style={{ color: col }}>
                            <Users2 size={10} />{s.name}
                          </span>
                        )}
                      </div>
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noopener noreferrer"
                          className="flex-shrink-0 mt-0.5 opacity-40 hover:opacity-100 transition-opacity">
                          <ExternalLink size={13} style={{ color: 'var(--muted)' }} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Toggle: team leader hourly heatmap */}
          {leadRows.length > 0 && activeHours.length > 0 && (
            <>
              <button onClick={() => setShowTLHeat(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                style={{ color: '#6366f1', background: '#6366f112', border: '1px solid #6366f130' }}>
                <BarChart3 size={12} />
                {showTLHeat ? 'Hide' : 'Show'} Hourly Heatmap
                {showTLHeat ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>

              {showTLHeat && (
                <SectionCard title={
                  <span className="flex items-center gap-2">
                    <Users2 size={14} style={{ color: '#6366f1' }} />
                    Team Leader — Hourly Submissions · {date}
                  </span>
                }>
                  <div className="overflow-x-auto">
                    <table className="text-xs" style={{ borderCollapse: 'separate', borderSpacing: '2px 3px' }}>
                      <thead>
                        <tr>
                          <th className="text-left pr-4 pb-2 font-semibold"
                            style={{ color: 'var(--muted)', minWidth: 160 }}>Team Leader</th>
                          {activeHours.map(h => (
                            <th key={h} className="pb-2 text-center font-medium"
                              style={{ color: 'var(--muted)', minWidth: 38 }}>
                              {String(h).padStart(2, '0')}
                            </th>
                          ))}
                          <th className="pb-2 pl-4 font-bold text-right" style={{ minWidth: 52 }}>Total</th>
                        </tr>
                        <tr>
                          <td className="pr-4 pb-2 font-semibold" style={{ color: '#6366f1' }}>All teams</td>
                          {activeHours.map(h => (
                            <td key={h} className="pb-2 text-center">
                              <HeatCell count={hourTotals[h] || 0} max={maxHourTotal} />
                            </td>
                          ))}
                          <td className="pb-2 pl-4 text-right font-bold" style={{ color: '#6366f1' }}>{namedCount}</td>
                        </tr>
                      </thead>
                      <tbody>
                        {leadRows.map((l, idx) => {
                          const colors = ['#6366f1','#0891b2','#d97706','#16a34a','#dc2626','#7c3aed'];
                          const col = colors[idx % colors.length];
                          const isSel = selectedLead === l.lead;
                          return (
                            <tr key={l.lead} style={{ background: isSel ? `${col}08` : 'transparent' }}>
                              <td className="pr-4 py-0.5 whitespace-nowrap">
                                <button onClick={() => setSelectedLead(isSel ? null : l.lead)}
                                  className="font-medium text-left hover:underline flex items-center gap-1"
                                  style={{ color: isSel ? col : 'inherit' }}>
                                  {l.lead}
                                  <span className="ml-1 text-[10px] font-normal" style={{ color: 'var(--muted)' }}>
                                    ({l.editors.length} ed.)
                                  </span>
                                  {isSel ? <ChevronUp size={11} /> : <ChevronDown size={11} style={{ color: 'var(--muted)' }} />}
                                </button>
                              </td>
                              {activeHours.map(h => (
                                <td key={h} className="py-0.5 text-center">
                                  <HeatCell count={l.hourCounts[h] || 0} max={maxLeadHour} />
                                </td>
                              ))}
                              <td className="py-0.5 pl-4 text-right font-bold" style={{ color: col }}>
                                {l.stories.length}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <HeatLegend extra={`${namedCount} / ${allStories.length} stories attributed`} />
                </SectionCard>
              )}
            </>
          )}
        </div>
      )}

      {/* ══ EDITOR SUB-TAB ═══════════════════════════════════════════════ */}
      {subTab === 'editor' && (
      <div className="space-y-3">
        <SectionHeader
          icon={Users2} color="#16a34a"
          title="Editor Activity"
          meta={authorsLoading
            ? `Loading… ${authorsDone}/${authorsTotal}`
            : `${persons.length} editors · ${namedCount} attributed`}
          right={authorsLoading ? (
            <span className="flex items-center gap-1">
              <RefreshCw size={11} className="animate-spin" style={{ color: '#16a34a' }} />
              {Math.round(authorsDone / Math.max(authorsTotal, 1) * 100)}%
            </span>
          ) : null}
        />

        {/* Loading progress bar */}
        {authorsLoading && (
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div className="h-1 rounded-full transition-all" style={{
              width: `${authorsTotal ? Math.round(authorsDone / authorsTotal * 100) : 0}%`,
              background: '#16a34a',
            }} />
          </div>
        )}

        {/* Editor cards grid */}
        {persons.length > 0 && (
          <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {persons.map(p => (
              <EditorCard key={p.name}
                person={p}
                isSelected={selectedEditor === p.name}
                onClick={() => setSelectedEditor(selectedEditor === p.name ? null : p.name)}
              />
            ))}
          </div>
        )}

        {!authorsLoading && persons.length === 0 && (
          <div className="rounded-xl border p-6 text-center" style={{ borderColor: 'var(--border)' }}>
            <Users2 size={26} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">No editor data yet — try refreshing.</p>
          </div>
        )}

        {/* Editor stories panel */}
        {selectedEditor && (
          <div className="rounded-xl border overflow-hidden"
            style={{ borderColor: '#16a34a40', background: 'var(--surface)' }}>
            <div className="flex items-center justify-between px-4 py-3"
              style={{ background: 'linear-gradient(90deg,#f0fdf4,#dcfce7)', borderBottom: '1px solid #bbf7d0' }}>
              <div className="flex items-center gap-2">
                <div className="rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold"
                  style={{ background: '#16a34a22', color: '#15803d' }}>
                  {selectedEditor.trim().split(/\s+/).slice(0,2).map(w => w[0]?.toUpperCase()||'').join('')}
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: '#15803d' }}>{selectedEditor}</p>
                  <p className="text-xs" style={{ color: '#16a34a' }}>
                    {editorStories.length} {editorStories.length === 1 ? 'story' : 'stories'} · {date}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedEditor(null)}
                className="rounded-full p-1 hover:bg-white transition-colors" style={{ color: '#16a34a' }}>
                <X size={16} />
              </button>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {editorStories.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
                  No stories found for this editor
                </div>
              ) : editorStories.map((s, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-green-50 transition-colors">
                  <span className="text-xs font-mono mt-0.5 flex-shrink-0 tabular-nums"
                    style={{ color: 'var(--muted)', minWidth: 40 }}>
                    {s.time || '—'}
                  </span>
                  <div className="flex-1 min-w-0">
                    {s.url
                      ? <a href={s.url} target="_blank" rel="noopener noreferrer"
                          className="text-sm font-medium leading-snug hover:underline line-clamp-2"
                          style={{ color: 'var(--text)' }}>{s.title}</a>
                      : <p className="text-sm font-medium leading-snug line-clamp-2">{s.title}</p>
                    }
                    {s.category && (
                      <span className="text-xs capitalize mt-0.5 inline-block" style={{ color: '#7c3aed' }}>
                        {s.category}
                      </span>
                    )}
                  </div>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                      className="flex-shrink-0 mt-0.5 opacity-40 hover:opacity-100 transition-opacity">
                      <ExternalLink size={13} style={{ color: 'var(--muted)' }} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Toggle: hourly heatmap */}
        {persons.length > 0 && activeHours.length > 0 && (
          <>
            <button
              onClick={() => setShowEdHeat(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: '#16a34a', background: '#16a34a12', border: '1px solid #16a34a30' }}>
              <BarChart3 size={12} />
              {showEdHeat ? 'Hide' : 'Show'} Hourly Heatmap
              {showEdHeat ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>

            {showEdHeat && (
              <SectionCard title={
                <span className="flex items-center gap-2">
                  <Users2 size={14} style={{ color: '#16a34a' }} />
                  Editor-wise Hourly Publishing · {date}
                  {authorsLoading && (
                    <span className="text-xs font-normal flex items-center gap-1" style={{ color: '#16a34a' }}>
                      <RefreshCw size={10} className="animate-spin" /> {authorsDone}/{authorsTotal}
                    </span>
                  )}
                </span>
              }>
                <div className="overflow-x-auto">
                  <table className="text-xs" style={{ borderCollapse: 'separate', borderSpacing: '2px 3px' }}>
                    <thead>
                      <tr>
                        <th className="text-left pr-4 pb-2 font-semibold"
                          style={{ color: 'var(--muted)', minWidth: 160 }}>Editor</th>
                        {activeHours.map(h => (
                          <th key={h} className="pb-2 text-center font-medium"
                            style={{ color: 'var(--muted)', minWidth: 38 }}>
                            {String(h).padStart(2, '0')}
                          </th>
                        ))}
                        <th className="pb-2 pl-4 font-bold text-right" style={{ minWidth: 52 }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {persons.map(p => {
                        const isSel = selectedEditor === p.name;
                        return (
                          <tr key={p.name} style={{ background: isSel ? '#f0fdf4' : 'transparent' }}>
                            <td className="pr-4 py-0.5 whitespace-nowrap">
                              <button onClick={() => setSelectedEditor(isSel ? null : p.name)}
                                className="font-medium text-left hover:underline flex items-center gap-1"
                                style={{ color: isSel ? '#16a34a' : 'inherit' }}>
                                {p.name}
                                {isSel ? <ChevronUp size={11} /> : <ChevronDown size={11} style={{ color: 'var(--muted)' }} />}
                              </button>
                            </td>
                            {activeHours.map(h => (
                              <td key={h} className="py-0.5 text-center">
                                <HeatCell count={p.hourCounts[h] || 0} max={maxPersonHour} />
                              </td>
                            ))}
                            <td className="py-0.5 pl-4 text-right font-bold" style={{ color: '#16a34a' }}>
                              {p.stories.length}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <HeatLegend extra={`${namedCount} / ${allStories.length} stories attributed`} />
              </SectionCard>
            )}
          </>
        )}
      </div>
      )}

      {/* ══ CATEGORY SUB-TAB ═════════════════════════════════════════════ */}
      {subTab === 'category' && (
      <div className="space-y-3">
        <SectionHeader
          icon={Globe} color="#7c3aed"
          title="Category Activity"
          meta={`${catRows.length} categories · ${allStories.length} stories`}
          right={date}
        />

        {/* Category cards grid */}
        {catRows.length > 0 && (
          <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {catRows.map((c, i) => (
              <CatCard key={c.cat}
                cat={c.cat}
                total={c.total}
                maxTotal={maxCatTotal}
                color={CAT_PALETTE[i % CAT_PALETTE.length]}
                isSelected={selectedCategory === c.cat}
                onClick={() => setSelectedCategory(selectedCategory === c.cat ? null : c.cat)}
              />
            ))}
          </div>
        )}

        {/* Category stories panel */}
        {selectedCategory && (() => {
          const catColor = CAT_PALETTE[catRows.findIndex(c => c.cat === selectedCategory) % CAT_PALETTE.length];
          const catStories = allStories
            .filter(s => getCat(s) === selectedCategory)
            .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
          return (
            <div className="rounded-xl border overflow-hidden"
              style={{ borderColor: `${catColor}40`, background: 'var(--surface)' }}>
              <div className="flex items-center justify-between px-4 py-3"
                style={{ background: `linear-gradient(90deg,${catColor}0d,${catColor}1a)`, borderBottom: `1px solid ${catColor}30` }}>
                <div className="flex items-center gap-2">
                  <div className="rounded-lg p-1.5" style={{ background: `${catColor}22` }}>
                    <Globe size={14} style={{ color: catColor }} />
                  </div>
                  <div>
                    <p className="font-bold text-sm capitalize" style={{ color: catColor }}>{selectedCategory}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {catStories.length} {catStories.length === 1 ? 'story' : 'stories'} · {date}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedCategory(null)}
                  className="rounded-full p-1 hover:bg-black/5 transition-colors" style={{ color: catColor }}>
                  <X size={16} />
                </button>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {catStories.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-black/[0.02] transition-colors">
                    <span className="text-xs font-mono mt-0.5 flex-shrink-0 tabular-nums"
                      style={{ color: 'var(--muted)', minWidth: 40 }}>
                      {s.time || '—'}
                    </span>
                    <div className="flex-1 min-w-0">
                      {s.url
                        ? <a href={s.url} target="_blank" rel="noopener noreferrer"
                            className="text-sm font-medium leading-snug hover:underline line-clamp-2"
                            style={{ color: 'var(--text)' }}>{s.title}</a>
                        : <p className="text-sm font-medium leading-snug line-clamp-2">{s.title}</p>
                      }
                      {s.name && (
                        <span className="text-xs mt-0.5 inline-flex items-center gap-1" style={{ color: '#16a34a' }}>
                          <Users2 size={10} />
                          {s.name}
                        </span>
                      )}
                    </div>
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noopener noreferrer"
                        className="flex-shrink-0 mt-0.5 opacity-40 hover:opacity-100 transition-opacity">
                        <ExternalLink size={13} style={{ color: 'var(--muted)' }} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Toggle: hourly heatmap */}
        {activeHours.length > 0 && (
          <>
            <button
              onClick={() => setShowCatHeat(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: '#7c3aed', background: '#7c3aed12', border: '1px solid #7c3aed30' }}>
              <BarChart3 size={12} />
              {showCatHeat ? 'Hide' : 'Show'} Hourly Heatmap
              {showCatHeat ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>

            {showCatHeat && (
              <SectionCard title={
                <span className="flex items-center gap-2">
                  <Globe size={14} style={{ color: '#7c3aed' }} />
                  Category-wise Hourly Publishing · {date}
                </span>
              }>
                <div className="overflow-x-auto">
                  <table className="text-xs" style={{ borderCollapse: 'separate', borderSpacing: '2px 3px' }}>
                    <thead>
                      <tr>
                        <th className="text-left pr-4 pb-2 font-semibold whitespace-nowrap"
                          style={{ color: 'var(--muted)', minWidth: 160 }}>Category</th>
                        {activeHours.map(h => (
                          <th key={h} className="pb-2 text-center font-medium"
                            style={{ color: 'var(--muted)', minWidth: 38 }}>
                            {String(h).padStart(2, '0')}
                          </th>
                        ))}
                        <th className="pb-2 pl-4 font-bold text-right" style={{ minWidth: 52 }}>Total</th>
                      </tr>
                      <tr>
                        <td className="pr-4 pb-2 font-semibold" style={{ color: '#7c3aed' }}>All categories</td>
                        {activeHours.map(h => (
                          <td key={h} className="pb-2 text-center">
                            <HeatCell count={hourTotals[h] || 0} max={maxHourTotal} />
                          </td>
                        ))}
                        <td className="pb-2 pl-4 text-right font-bold" style={{ color: '#7c3aed' }}>{allStories.length}</td>
                      </tr>
                    </thead>
                    <tbody>
                      {catRows.map((c, i) => (
                        <tr key={c.cat}>
                          <td className="pr-4 py-0.5 capitalize whitespace-nowrap flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: CAT_PALETTE[i % CAT_PALETTE.length] }} />
                            {c.cat}
                          </td>
                          {activeHours.map(h => (
                            <td key={h} className="py-0.5 text-center">
                              <HeatCell count={c.hourCounts[h] || 0} max={maxCatHour} />
                            </td>
                          ))}
                          <td className="py-0.5 pl-4 text-right font-semibold" style={{ color: '#7c3aed' }}>
                            {c.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <HeatLegend />
              </SectionCard>
            )}
          </>
        )}
      </div>
      )}
    </div>
  );
}

// ── YouTube Tab ───────────────────────────────────────────────────────────────

const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const TYPE_META   = {
  short:   { label: 'Short',   color: '#16a34a', bg: '#dcfce7', desc: '< 3 min' },
  medium:  { label: 'Medium',  color: '#2563eb', bg: '#dbeafe', desc: '3–20 min' },
  long:    { label: 'Long',    color: '#7c3aed', bg: '#ede9fe', desc: '> 20 min' },
  unknown: { label: '—',       color: '#64748b', bg: '#f1f5f9', desc: 'No duration' },
};

function YTStatCard({ icon: Icon, label, value, sub, color, accent }) {
  return (
    <div className="rounded-xl border p-4 flex items-start gap-3"
      style={{ borderColor: accent ? color + '40' : 'var(--border)', background: accent ? color + '0d' : 'var(--card)' }}>
      <div className="rounded-lg p-2 flex-shrink-0" style={{ background: color + '20' }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>{label}</div>
        <div className="text-xl font-bold leading-tight truncate" style={{ color: accent ? color : 'var(--text)' }}>{value || '—'}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</div>}
      </div>
    </div>
  );
}

function DurationBadge({ durationStr, type }) {
  const meta = TYPE_META[type] || TYPE_META.unknown;
  if (!durationStr) return null;
  return (
    <span className="absolute bottom-2 right-2 rounded px-1.5 py-0.5 text-xs font-bold"
      style={{ background: 'rgba(0,0,0,0.82)', color: meta.color }}>
      {durationStr}
    </span>
  );
}

function TypeBadge({ type, small }) {
  const meta = TYPE_META[type] || TYPE_META.unknown;
  if (type === 'unknown') return null;
  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${small ? 'px-1.5 py-0 text-xs' : 'px-2 py-0.5 text-xs'}`}
      style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}30` }}>
      {meta.label}
    </span>
  );
}

function VideoCard({ video, rank, showAge = true }) {
  const pub    = video.published ? new Date(video.published) : null;
  const age    = pub ? Math.floor((Date.now() - pub) / 86400000) : null;
  const ageStr = age === null ? (video.publishedAgo || '') : age === 0 ? 'Today' : age === 1 ? 'Yesterday' : `${age}d ago`;
  const timeStr = pub
    ? pub.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    : '';

  return (
    <a href={video.url} target="_blank" rel="noopener noreferrer"
      className="group rounded-xl border overflow-hidden flex flex-col transition-shadow hover:shadow-md"
      style={{ borderColor: 'var(--border)', background: 'var(--card)', textDecoration: 'none' }}>

      {/* Thumbnail */}
      <div className="relative overflow-hidden flex-shrink-0" style={{ paddingTop: '56.25%', background: '#111' }}>
        <img src={video.thumbnail} alt={video.title}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={e => { e.target.src = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`; }}
        />
        {rank && (
          <span className="absolute top-2 left-2 rounded px-1.5 py-0.5 text-xs font-bold text-white"
            style={{ background: 'rgba(0,0,0,0.75)' }}>#{rank}</span>
        )}
        {showAge && ageStr && ageStr !== 'Today' && (
          <span className="absolute top-2 right-2 rounded px-1.5 py-0.5 text-xs font-semibold text-white"
            style={{ background: 'rgba(0,0,0,0.65)' }}>{ageStr}</span>
        )}
        {/* Duration badge bottom-right */}
        <DurationBadge durationStr={video.durationStr} type={video.type} />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="rounded-full p-3" style={{ background: 'rgba(239,68,68,0.9)' }}>
            <Play size={20} fill="white" style={{ color: 'white' }} />
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="p-2.5 flex flex-col gap-1 flex-1">
        <p className="text-xs font-semibold leading-snug line-clamp-2" style={{ color: 'var(--text)' }}>
          {video.title}
        </p>
        <div className="flex items-center gap-2 mt-auto pt-1.5 flex-wrap">
          {video.type && video.type !== 'unknown' && <TypeBadge type={video.type} small />}
          {(video.views > 0 || video.viewsText) && (
            <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--muted)' }}>
              <Eye size={10} />{video.views > 0 ? video.views.toLocaleString('en-IN') : video.viewsText}
            </span>
          )}
          {timeStr && (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{timeStr}</span>
          )}
          {!timeStr && video.publishedAgo && (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{video.publishedAgo}</span>
          )}
        </div>
      </div>
    </a>
  );
}

function UploadChart({ byDay }) {
  const max = Math.max(...Object.values(byDay), 1);
  return (
    <div className="flex items-end gap-2 h-20">
      {DAY_NAMES.map((name, i) => {
        const val = byDay[i] || 0;
        const pct = (val / max) * 100;
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <div className="w-full rounded-t-sm transition-all"
              style={{ height: `${Math.max(pct, 4)}%`, background: pct > 50 ? '#ef4444' : '#ef444450', minHeight: 4 }} />
            <span className="text-xs" style={{ color: 'var(--muted)' }}>{name}</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{val}</span>
          </div>
        );
      })}
    </div>
  );
}

function HourUploadChart({ byHour }) {
  const hours   = Array.from({ length: 24 }, (_, i) => i);
  const counts  = hours.map(h => byHour[h] || 0);
  const max     = Math.max(...counts, 1);
  const peakH   = counts.indexOf(Math.max(...counts));
  return (
    <div>
      <div className="flex items-end gap-0.5 h-16">
        {hours.map(h => {
          const val = byHour[h] || 0;
          const pct = (val / max) * 100;
          return (
            <div key={h} title={`${String(h).padStart(2,'0')}:00 — ${val} uploads`}
              className="flex-1 rounded-t-sm transition-all cursor-default"
              style={{ height: `${Math.max(pct, 4)}%`, background: h === peakH ? '#ef4444' : '#ef444440', minHeight: 2 }} />
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        {[0, 6, 12, 18, 23].map(h => (
          <span key={h} className="text-xs" style={{ color: 'var(--muted)' }}>{String(h).padStart(2,'0')}</span>
        ))}
      </div>
      {byHour[peakH] > 0 && (
        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
          Peak upload hour: <b style={{ color: '#ef4444' }}>{String(peakH).padStart(2,'0')}:00</b> ({byHour[peakH]} videos)
        </p>
      )}
    </div>
  );
}

const TYPE_FILTERS = [
  { key: 'all',    label: 'All' },
  { key: 'short',  label: 'Short',  color: '#16a34a' },
  { key: 'medium', label: 'Medium', color: '#2563eb' },
  { key: 'long',   label: 'Long',   color: '#7c3aed' },
];

function YouTubeTab({ user }) {
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [section,    setSection]    = useState('today'); // 'today' | 'recent'
  const [typeFilter, setTypeFilter] = useState('all');
  const [sort,       setSort]       = useState('date');
  const [search,     setSearch]     = useState('');
  const [page,       setPage]       = useState(0);
  const PER_PAGE = 15;

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.digitalYoutube(refresh);
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const channel    = data?.channel     || {};
  const stats      = data?.stats       || {};
  const todayVids  = data?.today_videos || [];
  const recentVids = data?.all_videos  || data?.videos || [];

  // filtered today's videos by type
  const todayFiltered = useMemo(() => {
    if (typeFilter === 'all') return todayVids;
    return todayVids.filter(v => v.videoType === typeFilter);
  }, [todayVids, typeFilter]);

  // filtered recent videos
  const recentFiltered = useMemo(() => {
    let v = recentVids;
    if (typeFilter !== 'all') v = v.filter(x => x.videoType === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      v = v.filter(x => (x.title || '').toLowerCase().includes(q));
    }
    if (sort === 'views') v = [...v].sort((a, b) => (b.views || 0) - (a.views || 0));
    else v = [...v].sort((a, b) => new Date(b.published || 0) - new Date(a.published || 0));
    return v;
  }, [recentVids, typeFilter, sort, search]);

  const pageVids    = recentFiltered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages  = Math.ceil(recentFiltered.length / PER_PAGE);

  useEffect(() => { setPage(0); }, [sort, search, typeFilter]);

  const fetchedAt = data?.fetched_at
    ? new Date(data.fetched_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    : '';

  const byType = stats.byType || {};

  return (
    <div className="space-y-5">

      {/* ── Channel Header ── */}
      <div className="rounded-2xl overflow-hidden relative"
        style={{ background: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)' }}>

        {channel.banner && (
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: `url(${channel.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        )}

        <div className="relative px-6 py-5 flex flex-wrap items-center gap-5">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {channel.avatar
              ? <img src={channel.avatar} alt={channel.name}
                  className="w-16 h-16 rounded-full ring-2 ring-red-500 object-cover" />
              : <div className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: '#ef4444' }}>
                  <Youtube size={28} className="text-white" />
                </div>
            }
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-white font-bold text-xl">{channel.name || 'Rajasthan Patrika TV'}</h2>
              <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                style={{ background: '#ef4444' }}>YouTube</span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: '#94a3b8' }}>{channel.handle}</p>
          </div>

          {/* Quick stats */}
          <div className="flex gap-5 flex-wrap">
            {channel.subscribers && (
              <div className="text-center">
                <div className="text-white font-bold text-lg">{channel.subscribers}</div>
                <div className="text-xs" style={{ color: '#94a3b8' }}>Subscribers</div>
              </div>
            )}
            {stats.totalToday > 0 && (
              <div className="text-center">
                <div className="font-bold text-lg" style={{ color: '#f87171' }}>{stats.totalToday}</div>
                <div className="text-xs" style={{ color: '#94a3b8' }}>Today's Videos</div>
              </div>
            )}
            {stats.watchTimeStr && (
              <div className="text-center">
                <div className="font-bold text-lg" style={{ color: '#fb923c' }}>{stats.watchTimeStr}</div>
                <div className="text-xs" style={{ color: '#94a3b8' }}>Watch Time Today</div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <a href={channel.url || 'https://www.youtube.com/@rajasthanpatrikatv'}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-80"
              style={{ background: '#ef4444' }}>
              <Youtube size={13} />Visit Channel
            </a>
            <button onClick={() => load(true)} disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#cbd5e1' }}>
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              {fetchedAt ? `Updated ${fetchedAt}` : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Loading / Error ── */}
      {loading && !data && (
        <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--border)' }}>
          <RefreshCw size={28} className="animate-spin mx-auto mb-3" style={{ color: '#ef4444' }} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Fetching YouTube channel data…</p>
        </div>
      )}
      {error && !data && (
        <div className="rounded-xl border p-6 text-center" style={{ borderColor: '#ef4444', background: '#fee2e215' }}>
          <AlertCircle size={24} className="mx-auto mb-2" style={{ color: '#ef4444' }} />
          <p className="text-sm font-medium" style={{ color: '#ef4444' }}>{error}</p>
        </div>
      )}

      {data && (
        <>
          {/* ── Today's Summary stat cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <YTStatCard icon={Video}    color="#ef4444" label="Today's Videos" value={stats.totalToday || 0} accent />
            <YTStatCard icon={Clock}    color="#f97316" label="Watch Time"      value={stats.watchTimeStr || '—'} sub="today" />
            <YTStatCard icon={Play}     color={TYPE_META.short.color}  label="Short (< 3 min)"  value={byType.short  || 0} />
            <YTStatCard icon={Play}     color={TYPE_META.medium.color} label="Medium (3–20 min)" value={byType.medium || 0} />
            <YTStatCard icon={Play}     color={TYPE_META.long.color}   label="Long (> 20 min)"  value={byType.long   || 0} />
          </div>

          {/* ── Section tabs ── */}
          <div className="flex items-center gap-1 rounded-xl border p-1 w-fit"
            style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
            {[
              { k: 'today',  l: `Today's Videos (${stats.totalToday || 0})` },
              { k: 'recent', l: `Recent Videos (${recentVids.length})` },
            ].map(s => (
              <button key={s.k} onClick={() => setSection(s.k)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: section === s.k ? '#ef4444' : 'transparent',
                  color:      section === s.k ? 'white'   : 'var(--muted)',
                }}>
                {s.l}
              </button>
            ))}
          </div>

          {/* ── Type filter pills ── */}
          <div className="flex gap-2 flex-wrap">
            {TYPE_FILTERS.map(f => (
              <button key={f.key} onClick={() => setTypeFilter(f.key)}
                className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
                style={{
                  background:   typeFilter === f.key ? (f.color || '#ef4444') : 'var(--card)',
                  color:        typeFilter === f.key ? 'white' : (f.color || 'var(--muted)'),
                  borderColor:  typeFilter === f.key ? (f.color || '#ef4444') : 'var(--border)',
                }}>
                {f.label}
                {f.key !== 'all' && (
                  <span className="ml-1 opacity-75">
                    {f.key === 'short'  ? byType.short  || 0 :
                     f.key === 'medium' ? byType.medium || 0 :
                     f.key === 'long'   ? byType.long   || 0 : ''}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── TODAY'S VIDEOS ── */}
          {section === 'today' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  Today's Videos
                  <span className="ml-2 text-xs font-normal" style={{ color: 'var(--muted)' }}>
                    {todayFiltered.length} {typeFilter !== 'all' ? `${typeFilter}` : 'total'}
                  </span>
                </h3>
              </div>

              {todayFiltered.length > 0 ? (
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {todayFiltered.map((v, i) => (
                    <VideoCard key={v.id || i} video={v} rank={i + 1} />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border p-10 text-center" style={{ borderColor: 'var(--border)' }}>
                  <Video size={28} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {typeFilter !== 'all'
                      ? `No ${typeFilter} videos uploaded today.`
                      : 'No videos uploaded today yet.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── RECENT VIDEOS ── */}
          {section === 'recent' && (
            <div>
              {/* Controls */}
              <div className="flex items-center gap-3 flex-wrap mb-4">
                <h3 className="text-sm font-semibold flex-shrink-0" style={{ color: 'var(--text)' }}>
                  Recent Videos
                  <span className="ml-2 text-xs font-normal" style={{ color: 'var(--muted)' }}>
                    {recentFiltered.length} {search || typeFilter !== 'all' ? 'matching' : 'total'}
                  </span>
                </h3>
                <div className="flex-1" />
                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search videos…"
                    className="rounded-lg border pl-8 pr-3 py-1.5 text-xs w-44"
                    style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}
                  />
                </div>
                {/* Sort */}
                <div className="flex gap-1 rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                  {[{k:'date',l:'Latest'},{k:'views',l:'Top Views'}].map(s => (
                    <button key={s.k} onClick={() => setSort(s.k)}
                      className="px-3 py-1.5 text-xs font-medium transition-colors"
                      style={{
                        background: sort === s.k ? '#ef4444' : 'var(--card)',
                        color:      sort === s.k ? 'white'   : 'var(--muted)',
                      }}>
                      {s.l}
                    </button>
                  ))}
                </div>
              </div>

              {pageVids.length > 0 ? (
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                  {pageVids.map((v, i) => (
                    <VideoCard key={v.id || i} video={v}
                      rank={sort === 'views' ? page * PER_PAGE + i + 1 : null} />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border p-8 text-center" style={{ borderColor: 'var(--border)' }}>
                  <Video size={28} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {search || typeFilter !== 'all' ? 'No videos match your filters.' : 'No videos found.'}
                  </p>
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-5">
                  <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                    className="px-3 py-1.5 rounded-lg border text-xs font-medium disabled:opacity-40 transition-colors"
                    style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}>
                    ← Prev
                  </button>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    Page {page + 1} / {totalPages}
                  </span>
                  <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                    className="px-3 py-1.5 rounded-lg border text-xs font-medium disabled:opacity-40 transition-colors"
                    style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}>
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Charts row ── */}
          {(stats.byDay || stats.byHour) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats.byDay && (
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 size={14} style={{ color: '#ef4444' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Uploads by Day of Week</span>
                  </div>
                  <UploadChart byDay={stats.byDay} />
                </div>
              )}
              {stats.byHour && (
                <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Clock size={14} style={{ color: '#ef4444' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Uploads by Hour (IST)</span>
                  </div>
                  <HourUploadChart byHour={stats.byHour} />
                </div>
              )}
            </div>
          )}

          {data.stale && (
            <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
              Showing cached data — live fetch failed.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── Breaking News Tab (original manual tracker) ───────────────────────────────

function timeDiff(a, b) {
  // Returns "±HH:MM" from two "HH:MM" or "HH:MM:SS" strings
  if (!a || !b) return '—';
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const diff = toMin(a) - toMin(b);
  const sign = diff < 0 ? '-' : '+';
  const abs  = Math.abs(diff);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

function speedBadge(diff) {
  if (!diff || diff === '—') return null;
  const neg = diff.startsWith('-');
  return (
    <span className="text-xs font-bold px-1.5 py-0.5 rounded"
      style={{ background: neg ? '#dcfce7' : '#fee2e2', color: neg ? '#166534' : '#991b1b' }}>
      {diff}
    </span>
  );
}

const NEWS_CATS = [
  { key: 'all',           label: 'All',           color: '#64748b' },
  { key: 'breaking',      label: 'Breaking',      color: '#dc2626' },
  { key: 'national',      label: 'National',      color: '#2563eb' },
  { key: 'crime',         label: 'Crime',         color: '#ea580c' },
  { key: 'sports',        label: 'Sports',        color: '#16a34a' },
  { key: 'entertainment', label: 'Entertainment', color: '#7c3aed' },
  { key: 'business',      label: 'Business',      color: '#0891b2' },
  { key: 'health',        label: 'Health',        color: '#059669' },
  { key: 'education',     label: 'Education',     color: '#ca8a04' },
];

// Relative time: "just now", "5m ago", "2h ago"
function relTime(dateStr) {
  if (!dateStr) return null;
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 0)    return null;
    if (diff < 60)   return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
    return null;
  } catch { return null; }
}

const HOURS_OPTIONS = [2, 4, 6, 12, 24];

function BreakingNewsTab() {
  const [allNews,    setAllNews]    = useState([]);
  const [sources,    setSources]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [err,        setErr]        = useState('');
  const [newsSource, setNewsSource] = useState('all');
  const [hours,      setHours]      = useState(4);
  const [lastFetch,  setLastFetch]  = useState(null);
  const [tick,       setTick]       = useState(0); // forces re-render for relative times

  const load = async (h = hours) => {
    setLoading(true); setErr('');
    try {
      const res = await api.newsFeed(TODAY, { breaking: true, hours: h });
      setAllNews(res.articles || []);
      setSources(res.sources  || []);
      setLastFetch(Date.now());
    } catch (e) { setErr('Could not load breaking news: ' + e.message); }
    finally { setLoading(false); }
  };

  // Auto-refresh every 90 seconds
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(() => load(), 90 * 1000);
    return () => clearInterval(t);
  }, [hours]);

  // Tick every 30s to update relative times without refetch
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 30 * 1000);
    return () => clearInterval(t);
  }, []);

  const filtered = newsSource === 'all'
    ? allNews
    : allNews.filter(a => a.source === newsSource);

  const handleHours = (h) => { setHours(h); load(h); };

  const secsSinceFetch = lastFetch ? Math.round((Date.now() - lastFetch) / 1000) : null;

  return (
    <div className="space-y-4">
      <div className="surface rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--border)', background: 'linear-gradient(90deg,#fef2f2,#fff1f2)' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="rounded-lg p-1.5" style={{ background: '#fee2e2' }}>
              <Radio size={15} style={{ color: '#dc2626' }} />
            </div>
            <span className="font-bold text-sm">Breaking News — All Channels</span>
            {!loading && allNews.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: '#dc2626', color: '#fff' }}>
                {allNews.length} stories
              </span>
            )}
            {/* Pulse dot — live indicator */}
            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#dc2626' }}>
              <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#dc2626' }} />
              LIVE
            </span>
          </div>
          <div className="flex items-center gap-2">
            {secsSinceFetch !== null && !loading && (
              <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                refreshed {secsSinceFetch < 60 ? `${secsSinceFetch}s` : `${Math.floor(secsSinceFetch / 60)}m`} ago
              </span>
            )}
            <button className="btn-ghost p-1.5" onClick={() => load()} title="Refresh now">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── Time window + Source filters ─────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
          {/* Time window pills */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-semibold uppercase mr-1" style={{ color: 'var(--muted)' }}>Last</span>
            {HOURS_OPTIONS.map(h => (
              <button key={h}
                onClick={() => handleHours(h)}
                className="px-2 py-0.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: hours === h ? '#dc2626' : 'var(--border)',
                  color:      hours === h ? '#fff'    : 'var(--muted)',
                }}>
                {h}h
              </button>
            ))}
          </div>

          <div className="w-px h-4" style={{ background: 'var(--border)' }} />

          {/* Source filter */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setNewsSource('all')}
              className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
              style={{
                background: newsSource === 'all' ? '#374151' : 'var(--border)',
                color:      newsSource === 'all' ? '#fff'    : 'var(--muted)',
              }}>
              All ({allNews.length})
            </button>
            {sources.filter(s => s.count > 0).map(s => (
              <button key={s.key}
                onClick={() => setNewsSource(s.key)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: newsSource === s.key ? s.color : 'var(--border)',
                  color:      newsSource === s.key ? '#fff'  : 'var(--muted)',
                }}>
                {s.name} ({s.count})
              </button>
            ))}
          </div>
        </div>

        {/* ── Live ticker feed ─────────────────────────────────────────── */}
        <div className="divide-y" style={{ borderColor: 'var(--border)', maxHeight: 620, overflowY: 'auto' }}>
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--border)' }} />
              ))}
            </div>
          ) : err ? (
            <div className="p-4 text-sm" style={{ color: '#dc2626' }}>{err}</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Radio size={28} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
                No breaking news in the last {hours}h
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Try extending the time window or refresh
              </p>
            </div>
          ) : filtered.map((a, i) => {
            const rel   = relTime(a.publish_date);
            const isNew = rel === 'just now' || (rel && rel.endsWith('m ago') && parseInt(rel) <= 30);
            return (
              <div key={i}
                className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
                style={isNew ? { background: '#fef2f218' } : {}}>

                {/* LIVE / time column */}
                <div className="flex-shrink-0 text-right pt-0.5" style={{ minWidth: 52 }}>
                  {isNew ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded animate-pulse"
                      style={{ background: '#dc2626', color: '#fff' }}>LIVE</span>
                  ) : (
                    <span className="text-[10px] tabular-nums font-medium" style={{ color: 'var(--muted)' }}>
                      {rel || a.publish_time || '—'}
                    </span>
                  )}
                  {a.publish_time && !isNew && (
                    <div className="text-[9px] tabular-nums" style={{ color: 'var(--muted)', opacity: 0.7 }}>
                      {a.publish_time}
                    </div>
                  )}
                </div>

                {/* Source badge */}
                <span className="flex-shrink-0 mt-0.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md whitespace-nowrap"
                  style={{ background: `${a.source_color || '#dc2626'}20`, color: a.source_color || '#dc2626' }}>
                  {a.source_name || a.source}
                </span>

                {/* Title */}
                <div className="flex-1 min-w-0">
                  {a.url
                    ? <a href={a.url} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium leading-snug hover:underline line-clamp-2"
                        style={{ color: 'var(--text)' }}>
                        {a.title}
                      </a>
                    : <p className="text-sm font-medium leading-snug line-clamp-2">{a.title}</p>
                  }
                </div>

                {/* External link icon */}
                {a.url && (
                  <a href={a.url} target="_blank" rel="noopener noreferrer"
                    className="flex-shrink-0 mt-0.5 opacity-30 hover:opacity-80 transition-opacity">
                    <ExternalLink size={12} style={{ color: 'var(--muted)' }} />
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2 border-t flex items-center justify-between text-xs"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
            <span>{filtered.length} breaking stories · last {hours}h · auto-refreshes every 90s</span>
            <span className="flex items-center gap-1">
              {sources.filter(s => s.count > 0).map(s => (
                <span key={s.key} className="w-2 h-2 rounded-full inline-block"
                  style={{ background: s.color }} title={s.name} />
              ))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AI Insights Tab ───────────────────────────────────────────────────────────
const INSIGHT_META = {
  pace:    { icon: Gauge,       bg: '#dbeafe', fg: '#1d4ed8', label: 'Pace'       },
  uv:      { icon: TrendingUp,  bg: '#d1fae5', fg: '#047857', label: 'Traffic'    },
  editor:  { icon: AlertCircle, bg: '#fee2e2', fg: '#b91c1c', label: 'Editors'    },
  star:    { icon: Award,       bg: '#fef3c7', fg: '#b45309', label: 'Top Performer' },
  quality: { icon: Star,        bg: '#f3e8ff', fg: '#7c3aed', label: 'Quality'    },
  teams:   { icon: Users2,      bg: '#e0f2fe', fg: '#0369a1', label: 'Teams'      },
  admin:   { icon: ShieldAlert, bg: '#fef9c3', fg: '#854d0e', label: 'Admin'      },
  speed:   { icon: Flame,       bg: '#ffedd5', fg: '#c2410c', label: 'Speed'      },
  today:   { icon: Activity,    bg: '#dbeafe', fg: '#1d4ed8', label: 'Today'     },
  weekly:  { icon: BarChart3,   bg: '#d1fae5', fg: '#047857', label: 'Weekly'    },
  pattern: { icon: Lightbulb,   bg: '#fef3c7', fg: '#b45309', label: 'Pattern'   },
};

const SEV_STYLE = {
  success: { border: '#16a34a', bg: '#f0fdf4', dot: '#16a34a', label: 'Great',      icon: CheckCircle  },
  warning: { border: '#d97706', bg: '#fffbeb', dot: '#d97706', label: 'Attention',  icon: AlertCircle  },
  alert:   { border: '#dc2626', bg: '#fff5f5', dot: '#dc2626', label: 'Urgent',     icon: AlertCircle  },
  info:    { border: '#0891b2', bg: '#f0f9ff', dot: '#0891b2', label: 'Insight',    icon: Lightbulb    },
};

function InsightCard({ insight, rank }) {
  const [open, setOpen] = useState(false);
  const meta    = INSIGHT_META[insight.type] || INSIGHT_META.pace;
  const sev     = SEV_STYLE[insight.severity] || SEV_STYLE.info;
  const Icon    = meta.icon;

  const rankColors = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#8b5cf6'];
  const rankColor  = rank ? rankColors[(rank - 1) % rankColors.length] : null;

  return (
    <div className="rounded-xl border overflow-hidden surface transition-all"
      style={{ borderColor: sev.border, borderLeftWidth: 4 }}>
      {/* Card header */}
      <div className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setOpen(o => !o)}>
        {rank ? (
          <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm mt-0.5"
            style={{ background: `${rankColor}18`, color: rankColor }}>
            {rank}
          </div>
        ) : (
          <div className="flex-shrink-0 rounded-lg p-2 mt-0.5" style={{ background: meta.bg }}>
            <Icon size={16} style={{ color: meta.fg }} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: sev.bg, color: sev.dot }}>
              {sev.label}
            </span>
            {rank && (
              <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--muted)' }}>
                <Icon size={10} style={{ color: meta.fg }} /> {meta.label}
              </span>
            )}
          </div>
          <div className="font-semibold text-sm leading-snug">{insight.title}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{insight.body}</div>
        </div>
        <div className="flex-shrink-0 mt-0.5">
          {open ? <ChevronUp size={15} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={15} style={{ color: 'var(--muted)' }} />}
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border)' }}>
          {/* Action recommendation */}
          {insight.action && (
            <div className="mt-3 flex items-start gap-2 rounded-lg p-3"
              style={{ background: sev.bg }}>
              <ArrowRight size={13} style={{ color: sev.dot, marginTop: 2, flexShrink: 0 }} />
              <span className="text-xs font-medium" style={{ color: sev.dot }}>
                {insight.action}
              </span>
            </div>
          )}

          {/* Data table */}
          {Array.isArray(insight.data) && insight.data.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: 'var(--muted)' }}>
                    {Object.keys(insight.data[0]).map(k => (
                      <th key={k} className="pb-1.5 pr-4 text-left font-semibold uppercase tracking-wide text-[10px]">
                        {k.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {insight.data.map((row, i) => (
                    <tr key={i} className="hover:bg-black/5 dark:hover:bg-white/5">
                      {Object.entries(row).map(([k, v]) => {
                        const isNum  = typeof v === 'number';
                        const isPct  = k.endsWith('pct') || k.endsWith('_pct');
                        const isUv   = k.includes('uv') || k.includes('Uv') || k.includes('page_uniques') || k.includes('totalUv');
                        const color  = isPct
                          ? v >= 90 ? '#16a34a' : v >= 60 ? '#d97706' : '#dc2626'
                          : 'var(--text)';
                        return (
                          <td key={k} className="py-1.5 pr-4" style={{ color }}>
                            {isPct   ? `${v}%`
                            : isUv   ? Number(v).toLocaleString('en-IN')
                            : isNum  ? Number(v).toLocaleString('en-IN')
                            : String(v || '—')}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Single-object data (stats block) */}
          {insight.data && !Array.isArray(insight.data) && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {Object.entries(insight.data).map(([k, v]) => (
                <div key={k} className="rounded-lg p-2" style={{ background: 'var(--bg)' }}>
                  <div className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--muted)' }}>
                    {k.replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm font-bold">
                    {k.endsWith('pct') || k.endsWith('_pct') ? `${v}%`
                    : typeof v === 'number' ? v.toLocaleString('en-IN')
                    : String(v || '—')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AiInsightsTab({ user, canAdmin }) {
  const thisMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7);
  const [month,     setMonth]     = useState(thisMonth);
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState('');

  const load = async (m) => {
    setLoading(true); setErr('');
    try {
      const res = await api.digitalAiInsights(m);
      setData(res);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(month); }, [month]);

  // top5 is server-ranked by impact score; fall back to severity-sort slice if absent
  const top5 = data?.top5 || (() => {
    const sevOrder = { alert: 0, warning: 1, success: 2, info: 3 };
    return [...(data?.insights || [])]
      .sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9))
      .slice(0, 5)
      .map((ins, i) => ({ ...ins, rank: i + 1 }));
  })();

  const counts = { alert: 0, warning: 0, success: 0, info: 0 };
  top5.forEach(i => { counts[i.severity] = (counts[i.severity] || 0) + 1; });

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg p-1.5" style={{ background: '#fef3c7' }}>
            <Brain size={15} style={{ color: '#b45309' }} />
          </div>
          <div>
            <div className="text-sm font-semibold">Editorial Intelligence</div>
            {data?.computed_at && (
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                Updated {new Date(data.computed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                {data.total_editors !== undefined && ` · ${data.total_editors} editors`}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => setMonth(prevMonth(month))} className="btn-ghost px-2 py-1.5">
              <ChevronDown size={14} />
            </button>
            <span className="text-sm font-semibold tabular-nums px-2">
              {new Date(month + '-15').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
            </span>
            <button onClick={() => setMonth(nextMonth(month))} className="btn-ghost px-2 py-1.5"
              disabled={month >= thisMonth}>
              <ChevronUp size={14} />
            </button>
          </div>
          <button className="btn-ghost px-2.5 py-1.5" onClick={() => load(month)} title="Refresh">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Month progress bar */}
      {data && (
        <div className="surface rounded-xl border p-4 space-y-2" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Month Progress</span>
            <span className="font-bold tabular-nums" style={{ color: '#d97706' }}>{data.day_progress}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
            <div className="h-2 rounded-full transition-all"
              style={{ width: `${data.day_progress}%`, background: 'linear-gradient(90deg,#d97706,#f59e0b)' }} />
          </div>
          {/* Severity summary chips */}
          <div className="flex flex-wrap gap-2 pt-1">
            {Object.entries(counts).filter(([, n]) => n > 0).map(([sev, n]) => {
              const s = SEV_STYLE[sev];
              return (
                <span key={sev} className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: s.bg, color: s.dot }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                  {n} {s.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Error */}
      {err && (
        <div className="rounded-lg p-3 text-sm" style={{ color: '#dc2626', background: '#fef2f2' }}>
          {err}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'var(--border)' }} />
          ))}
        </div>
      )}

      {/* Top 5 Insight cards */}
      {!loading && top5.length === 0 && !err && (
        <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
          <Brain size={36} className="mx-auto mb-3 opacity-30" />
          <div className="font-medium">No insights available yet</div>
          <div className="text-sm mt-1">Add targets and achievement data to generate insights.</div>
        </div>
      )}

      {!loading && top5.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Star size={14} style={{ color: '#d97706' }} />
            <span className="text-sm font-semibold">Top {top5.length} Insights</span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              — ranked by impact &amp; urgency from {data?.insights?.length || top5.length} signals
            </span>
          </div>
          {top5.map(insight => (
            <InsightCard key={insight.id} insight={insight} rank={insight.rank} />
          ))}
        </div>
      )}

      {/* Footer note */}
      {!loading && top5.length > 0 && (
        <div className="text-center text-xs py-2" style={{ color: 'var(--muted)' }}>
          Scored from story targets, Chartbeat data &amp; breaking news logs · refreshes on each visit
        </div>
      )}
    </div>
  );
}

// ── Team Leader Tab ───────────────────────────────────────────────────────────
const TODAY_TL = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06–23

function TeamLeaderTab({ user, canAdmin }) {
  const [date, setDate]           = useState(TODAY_TL);
  const [users, setUsers]         = useState([]);
  const [liveArts, setLiveArts]   = useState([]);
  const [authorMap, setAuthorMap] = useState({});
  const [authorsLoading, setAuthorsLoading] = useState(false);
  const [authorsDone, setAuthorsDone]       = useState(0);
  const [fetching, setFetching]   = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null); // { name }
  const [expandedLeads, setExpandedLeads] = useState(new Set());

  // Load users once
  useEffect(() => {
    setUsersLoading(true);
    api.digitalUsers()
      .then(r => setUsers(r.users || []))
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  }, []);

  // Load articles + authors when date changes
  const loadData = async (d) => {
    setFetching(true); setLiveArts([]); setAuthorMap({}); setAuthorsDone(0); setSelectedUser(null);
    try {
      const res  = await api.fetchPatrikaByDate(d);
      const arts = res.articles || [];
      setLiveArts(arts);
      if (arts.length) {
        setAuthorsLoading(true);
        const CHUNK = 100;
        const urls  = arts.map(a => a.url).filter(Boolean);
        let map = {};
        for (let i = 0; i < urls.length; i += CHUNK) {
          const chunk = urls.slice(i, i + CHUNK);
          const r2 = await api.batchAuthors(chunk);
          map = { ...map, ...(r2.authors || {}) };
          setAuthorMap({ ...map });
          setAuthorsDone(Object.keys(map).length);
        }
        setAuthorsLoading(false);
      }
    } catch (_) {}
    finally { setFetching(false); }
  };

  useEffect(() => { loadData(date); }, [date]); // eslint-disable-line

  // Build story list enriched with author names
  const stories = liveArts.map(a => ({
    ...a,
    author: authorMap[a.url] || a.author || null,
  }));

  // Build hourly count per author name (normalised lowercase)
  const hourlyByAuthor = {};
  stories.forEach(s => {
    if (!s.author) return;
    const key = s.author.trim().toLowerCase();
    const h   = s.publish_time ? parseInt(s.publish_time.slice(0, 2), 10) : -1;
    if (!hourlyByAuthor[key]) hourlyByAuthor[key] = { total: 0, hours: {} };
    hourlyByAuthor[key].total += 1;
    if (h >= 0) hourlyByAuthor[key].hours[h] = (hourlyByAuthor[key].hours[h] || 0) + 1;
  });

  // Map user name → story key match
  const userStories = (name) => {
    const key = (name || '').trim().toLowerCase();
    return hourlyByAuthor[key] || { total: 0, hours: {} };
  };

  // Group: team → { lead, members[] }
  const teamLeads = users.filter(u => u.role === 'team_lead');
  const individuals = users.filter(u => u.role === 'individual');

  // All unique teams — team_lead sees only their own team
  const isTeamLead = user?.digital_role === 'team_lead';
  const myTeam     = isTeamLead ? users.find(u => u.name === user?.name)?.team : null;
  const allTeams   = [...new Set(users.map(u => u.team).filter(Boolean))].sort();
  const teams      = isTeamLead && myTeam ? allTeams.filter(t => t === myTeam) : allTeams;

  const toggleLead = (id) => {
    setExpandedLeads(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const heatColor = (n) => {
    if (!n) return 'transparent';
    if (n >= 5) return '#15803d';
    if (n >= 3) return '#22c55e';
    if (n >= 2) return '#86efac';
    return '#bbf7d0';
  };

  // Stories for selected user
  const selStories = selectedUser
    ? stories.filter(s => (s.author || '').trim().toLowerCase() === selectedUser.trim().toLowerCase())
        .sort((a, b) => (a.publish_time || '').localeCompare(b.publish_time || ''))
    : [];

  if (usersLoading) return (
    <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
      <RefreshCw size={20} className="animate-spin mx-auto mb-2" /> Loading team data…
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <CalendarDays size={14} style={{ color: 'var(--muted)' }} />
          <input type="date" className="input py-1.5 text-sm" value={date} max={TODAY_TL}
            onChange={e => { setDate(e.target.value); }} />
        </div>
        {(fetching || authorsLoading) && (
          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--muted)' }}>
            <RefreshCw size={12} className="animate-spin" />
            {fetching ? 'Loading stories…' : `Loading authors… ${authorsDone}/${liveArts.length}`}
          </span>
        )}
        {!fetching && !authorsLoading && liveArts.length > 0 && (
          <span className="text-xs" style={{ color: '#16a34a' }}>
            {liveArts.length} stories · {authorsDone} authors loaded
          </span>
        )}
        <button className="btn-ghost px-2.5 py-1.5 ml-auto" onClick={() => loadData(date)} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
        <span>Stories/hour:</span>
        {[1, 2, 3, 5].map(n => (
          <span key={n} className="flex items-center gap-1">
            <span className="inline-block w-4 h-4 rounded" style={{ background: heatColor(n) }} />
            {n === 5 ? '5+' : n}
          </span>
        ))}
      </div>

      {/* Story detail panel */}
      {selectedUser && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#059669' }}>
          <div className="flex items-center justify-between px-4 py-3"
            style={{ background: '#d1fae5' }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: '#059669' }}>
                {selectedUser[0].toUpperCase()}
              </div>
              <span className="font-semibold text-sm" style={{ color: '#065f46' }}>{selectedUser}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: '#059669', color: '#fff' }}>
                {selStories.length} stories
              </span>
            </div>
            <button onClick={() => setSelectedUser(null)} className="btn-ghost p-1">
              <X size={14} />
            </button>
          </div>
          <div className="overflow-x-auto" style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="w-full text-sm">
              <tbody>
                {selStories.map((s, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-3 py-2 w-14 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                      {s.publish_time || '—'}
                    </td>
                    <td className="px-3 py-2">
                      <a href={s.url} target="_blank" rel="noreferrer"
                        className="text-sm font-medium hover:underline line-clamp-1"
                        style={{ color: '#2563eb' }}>
                        {s.title}
                      </a>
                    </td>
                    <td className="px-3 py-2 w-28 text-xs" style={{ color: 'var(--muted)' }}>
                      {s.category || '—'}
                    </td>
                    <td className="px-3 py-2 w-8">
                      <a href={s.url} target="_blank" rel="noreferrer">
                        <ExternalLink size={12} style={{ color: 'var(--muted)' }} />
                      </a>
                    </td>
                  </tr>
                ))}
                {!selStories.length && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
                    No stories matched — author name may differ from login name
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Teams */}
      {teams.length === 0 && !usersLoading && (
        <div className="text-center py-12" style={{ color: 'var(--muted)' }}>No teams found in user settings.</div>
      )}

      {teams.map(team => {
        const lead    = teamLeads.find(u => u.team === team);
        const members = individuals.filter(u => u.team === team);
        const leadId  = lead?.id || team;
        const isOpen  = expandedLeads.has(leadId);

        // Team total
        const teamTotal = [lead, ...members].filter(Boolean).reduce((sum, u) => sum + userStories(u.name).total, 0);

        return (
          <div key={team} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {/* Team header / team lead row */}
            <button className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
              style={{ background: isOpen ? '#f0fdf4' : 'var(--surface)' }}
              onClick={() => toggleLead(leadId)}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: '#059669' }}>
                {(lead?.name || team)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{lead?.name || '(No Team Lead)'}</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>
                  {team} · Team Lead · {members.length} member{members.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold" style={{ color: '#059669' }}>
                  {teamTotal} stories
                </span>
                {isOpen ? <ChevronUp size={16} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--muted)' }} />}
              </div>
            </button>

            {/* Members table */}
            {isOpen && (
              <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" style={{ minWidth: 700 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                        <th className="text-left px-4 py-2 font-medium w-40" style={{ color: 'var(--muted)' }}>Editor</th>
                        <th className="text-center px-2 py-2 font-medium w-12" style={{ color: 'var(--muted)' }}>Total</th>
                        {HOURS.map(h => (
                          <th key={h} className="text-center px-1 py-2 font-medium w-8" style={{ color: 'var(--muted)' }}>
                            {String(h).padStart(2, '0')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(member => {
                        const stats   = userStories(member.name);
                        const isSelMember = selectedUser === member.name;
                        return (
                          <tr key={member.id}
                            className="border-b cursor-pointer transition-colors"
                            style={{
                              borderColor: 'var(--border)',
                              background: isSelMember ? '#f0fdf4' : undefined,
                            }}
                            onClick={() => setSelectedUser(isSelMember ? null : member.name)}>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                                  style={{ background: isSelMember ? '#059669' : '#94a3b8' }}>
                                  {member.name[0].toUpperCase()}
                                </div>
                                <span className="font-medium truncate" style={{ maxWidth: 110, color: isSelMember ? '#059669' : undefined }}>
                                  {member.name}
                                </span>
                              </div>
                            </td>
                            <td className="text-center px-2 py-2.5">
                              <span className="font-bold text-sm" style={{ color: stats.total ? '#059669' : 'var(--muted)' }}>
                                {stats.total || 0}
                              </span>
                            </td>
                            {HOURS.map(h => {
                              const n = stats.hours[h] || 0;
                              return (
                                <td key={h} className="text-center px-1 py-2.5">
                                  <div className="w-6 h-6 rounded mx-auto flex items-center justify-center text-[10px] font-bold"
                                    style={{
                                      background: heatColor(n),
                                      color: n >= 3 ? '#fff' : n ? '#15803d' : 'var(--muted)',
                                      border: n ? 'none' : '1px solid var(--border)',
                                    }}>
                                    {n || ''}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                      {members.length === 0 && (
                        <tr>
                          <td colSpan={2 + HOURS.length} className="px-4 py-4 text-center"
                            style={{ color: 'var(--muted)' }}>
                            No individual members in this team
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Alert Tab ─────────────────────────────────────────────────────────────────
const SEV_META = {
  critical: { label: 'Critical', bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', badge: '#dc2626', icon: Flame },
  warning:  { label: 'Warning',  bg: '#fffbeb', border: '#fcd34d', text: '#92400e', badge: '#d97706', icon: AlertCircle },
  info:     { label: 'Info',     bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', badge: '#2563eb', icon: Lightbulb },
};

function AlertTab({ canAdmin }) {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [, setTick]               = useState(0);
  const [filter, setFilter]       = useState('all');

  const now          = new Date();
  const curMonth     = monthStr(now);
  const totalDays    = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsedDays  = now.getDate();
  const monthPct     = Math.round((elapsedDays / totalDays) * 100);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const d = await api.digitalDashboard(curMonth);
      setData(d);
      setLastFetch(Date.now());
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setInterval(load, 5 * 60 * 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => setTick(v => v + 1), 30000); return () => clearInterval(t); }, []);

  const alerts = useMemo(() => {
    if (!data?.users) return [];
    const list = [];
    const pace      = monthPct;
    const minDays   = elapsedDays >= 5;

    data.users.forEach(u => {
      const hasTarget = u.uv_target > 0 || u.story_target > 0;
      if (!hasTarget) {
        list.push({ severity: 'info', user: u.name, team: u.team,
          title: 'No Targets Set',
          detail: `${u.name} has no monthly UV or story targets configured for ${curMonth}.` });
        return;
      }
      if (!minDays) return;

      if (u.uv_target > 0) {
        const gap = pace - (u.uv_pct || 0);
        if (gap >= 35)
          list.push({ severity: 'critical', user: u.name, team: u.team,
            title: 'UV Critically Behind',
            detail: `${u.name}: UV at ${u.uv_pct ?? 0}% vs ${pace}% expected pace — ${gap}pp gap.` });
        else if (gap >= 20)
          list.push({ severity: 'warning', user: u.name, team: u.team,
            title: 'UV Behind Pace',
            detail: `${u.name}: UV at ${u.uv_pct ?? 0}% vs ${pace}% expected — ${gap}pp gap.` });
      }

      if (u.story_target > 0) {
        const gap = pace - (u.story_pct || 0);
        if (gap >= 35)
          list.push({ severity: 'critical', user: u.name, team: u.team,
            title: 'Stories Critically Behind',
            detail: `${u.name}: Stories at ${u.story_pct ?? 0}% vs ${pace}% expected — ${gap}pp gap.` });
        else if (gap >= 20)
          list.push({ severity: 'warning', user: u.name, team: u.team,
            title: 'Stories Behind Pace',
            detail: `${u.name}: Stories at ${u.story_pct ?? 0}% vs ${pace}% expected — ${gap}pp gap.` });
      }

      if (u.pv_target > 0) {
        const gap = pace - (u.pv_pct || 0);
        if (gap >= 40)
          list.push({ severity: 'warning', user: u.name, team: u.team,
            title: 'Page Views Behind',
            detail: `${u.name}: PV at ${u.pv_pct ?? 0}% vs ${pace}% expected — ${gap}pp gap.` });
      }
    });

    (data.teams || []).forEach(t => {
      if (!t.uv_target || !minDays || (t.members?.length || 0) < 2) return;
      const gap = pace - (t.uv_pct || 0);
      if (gap >= 35)
        list.push({ severity: 'critical', user: null, team: t.team,
          title: 'Team UV Critical',
          detail: `Team "${t.team}" UV at ${t.uv_pct ?? 0}% vs ${pace}% expected (${t.members.length} members).` });
      else if (gap >= 20)
        list.push({ severity: 'warning', user: null, team: t.team,
          title: 'Team UV Behind',
          detail: `Team "${t.team}" UV at ${t.uv_pct ?? 0}% vs ${pace}% expected.` });
    });

    if (!minDays) {
      list.push({ severity: 'info', user: null, team: null,
        title: 'Month Just Started',
        detail: `Only ${elapsedDays} day(s) elapsed. Pace-based alerts activate from day 5.` });
    }

    const order = { critical: 0, warning: 1, info: 2 };
    return list.sort((a, b) => order[a.severity] - order[b.severity]);
  }, [data, monthPct, elapsedDays, curMonth]);

  const counts = useMemo(() => ({
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning:  alerts.filter(a => a.severity === 'warning').length,
    info:     alerts.filter(a => a.severity === 'info').length,
  }), [alerts]);

  const visible = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);

  function ago(ms) {
    if (!ms) return '';
    const diff = Math.round((Date.now() - ms) / 60000);
    return diff < 1 ? 'just now' : `${diff}m ago`;
  }

  if (loading && !data) return (
    <div className="text-center py-16" style={{ color: 'var(--muted)' }}>
      <RefreshCw size={24} className="animate-spin mx-auto mb-3" />
      <div>Loading alerts…</div>
    </div>
  );

  if (err) return (
    <div className="text-center py-12" style={{ color: '#dc2626' }}>Error: {err}</div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="surface rounded-xl p-4 border flex flex-wrap items-center justify-between gap-3"
        style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="font-bold text-base flex items-center gap-2">
            <ShieldAlert size={16} style={{ color: '#ea580c' }} />
            Alert Center
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {curMonth} · Day {elapsedDays}/{totalDays} ({monthPct}% of month elapsed)
            {lastFetch && <span> · Updated {ago(lastFetch)}</span>}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-opacity"
          style={{ background: '#ea580c', color: '#fff', opacity: loading ? 0.6 : 1 }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Severity filter pills */}
      <div className="flex flex-wrap gap-2">
        {[
          ['all',      'All',      counts.critical + counts.warning + counts.info, '#6b7280'],
          ['critical', 'Critical', counts.critical,                                '#dc2626'],
          ['warning',  'Warning',  counts.warning,                                 '#d97706'],
          ['info',     'Info',     counts.info,                                    '#2563eb'],
        ].map(([key, label, count, color]) => (
          <button key={key} onClick={() => setFilter(key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
            style={{
              background:  filter === key ? color : 'transparent',
              color:       filter === key ? '#fff' : color,
              borderColor: color,
            }}>
            {label}
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: filter === key ? 'rgba(255,255,255,0.25)' : `${color}22` }}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Alert list */}
      {visible.length === 0 ? (
        <div className="surface rounded-xl p-12 border text-center" style={{ borderColor: 'var(--border)' }}>
          <CheckCircle size={40} className="mx-auto mb-3" style={{ color: '#16a34a' }} />
          <div className="font-semibold text-base">All Clear</div>
          <div className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {filter === 'all' ? 'No alerts for this month so far.' : `No ${filter} alerts.`}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((a, i) => {
            const meta = SEV_META[a.severity];
            const Icon = meta.icon;
            return (
              <div key={i} className="rounded-xl p-4 flex items-start gap-3"
                style={{ background: meta.bg, border: `1px solid ${meta.border}`, borderLeft: `4px solid ${meta.badge}` }}>
                <div className="rounded-lg p-1.5 flex-shrink-0 mt-0.5"
                  style={{ background: `${meta.badge}18` }}>
                  <Icon size={15} style={{ color: meta.badge }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm" style={{ color: meta.text }}>{a.title}</span>
                    {a.user && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: `${meta.badge}18`, color: meta.text }}>
                        {a.user}
                      </span>
                    )}
                    {a.team && (
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(0,0,0,0.06)', color: 'var(--muted)' }}>
                        {a.team}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: meta.text, opacity: 0.8 }}>{a.detail}</p>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{ background: meta.badge, color: '#fff' }}>
                  {meta.label.toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
