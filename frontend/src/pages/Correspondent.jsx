import { useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/client.js';
import {
  Users, FileText, Image, IndianRupee, TrendingUp,
  Search, ChevronUp, ChevronDown, ChevronsUpDown,
  Calendar, MapPin, Phone, Mail, Loader2, Send, ClipboardList,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className="rounded-xl p-2.5 shrink-0" style={{ background: color + '20' }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium truncate" style={{ color: 'var(--muted)' }}>{label}</p>
        <p className="text-xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Sort helpers ──────────────────────────────────────────────────────────────
function SortIcon({ col, sort }) {
  if (sort.col !== col) return <ChevronsUpDown size={13} className="opacity-30" />;
  return sort.dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />;
}

function useSort(data, defaultCol = 'name') {
  const [sort, setSort] = useState({ col: defaultCol, dir: 'asc' });
  const toggle = (col) => setSort(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }));
  const sorted = useMemo(() => {
    const d = [...data];
    d.sort((a, b) => {
      let va = a[sort.col] ?? 0, vb = b[sort.col] ?? 0;
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sort.dir === 'asc' ? -1 : 1;
      if (va > vb) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return d;
  }, [data, sort]);
  return { sort, toggle, sorted };
}

function fmt(n) { return Number(n || 0).toLocaleString('en-IN'); }
function fmtAmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 }); }

const BRANCH_COLORS = ['#059669','#2563eb','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#65a30d'];

export default function Correspondent() {
  const { branch, state: globalState, isAdmin } = useApp();

  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [search,       setSearch]       = useState('');
  const [expanded,     setExpanded]     = useState(null);
  const [alertSending, setAlertSending] = useState(false);
  const [alertMsg,     setAlertMsg]     = useState('');
  const [alertLogs,    setAlertLogs]    = useState(null);
  const [logsLoading,  setLogsLoading]  = useState(false);
  const [showLogs,     setShowLogs]     = useState(false);

  // Load data when branch or month changes
  useEffect(() => {
    setLoading(true);
    setError('');
    api.correspondent(globalState, branch, selectedMonth)
      .then(d => {
        setData(d);
        if (!selectedMonth && d.selectedMonth) setSelectedMonth(d.selectedMonth);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [globalState, branch, selectedMonth]);

  const alertFetch = (opts = {}) =>
    fetch('/api/correspondent/payment-alert', {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('pk_token')}` },
    });

  const sendPaymentAlert = async () => {
    if (!confirm('Send zero-payment Telegram alert to all REs now?')) return;
    setAlertSending(true);
    setAlertMsg('');
    try {
      const res = await alertFetch({ method: 'POST' });
      const d = await res.json();
      setAlertMsg(d.ok ? '✓ Alert sent successfully.' : `Error: ${d.error}`);
      // Refresh logs if visible
      if (showLogs) fetchAlertLogs();
    } catch (e) {
      setAlertMsg('Error: ' + e.message);
    } finally {
      setAlertSending(false);
    }
  };

  const fetchAlertLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await alertFetch({ method: 'GET' });
      const d = await res.json();
      setAlertLogs(d.logs || []);
    } catch (e) {
      setAlertLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const toggleLogs = () => {
    if (!showLogs && !alertLogs) fetchAlertLogs();
    setShowLogs(v => !v);
  };

  const rows = useMemo(() => {
    if (!data?.correspondents) return [];
    const q = search.toLowerCase();
    if (!q) return data.correspondents;
    return data.correspondents.filter(r =>
      (r.name     || '').toLowerCase().includes(q) ||
      (r.branch   || '').toLowerCase().includes(q) ||
      (r.district || '').toLowerCase().includes(q) ||
      (r.location || '').toLowerCase().includes(q) ||
      (r.pan_no   || '').toLowerCase().includes(q)
    );
  }, [data, search]);

  const { sort, toggle, sorted } = useSort(rows, 'name');

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3" style={{ color: 'var(--muted)' }}>
      <Loader2 size={22} className="animate-spin" /> Loading…
    </div>
  );
  if (error) return (
    <div className="card p-6 text-center" style={{ color: '#dc2626' }}>Error: {error}</div>
  );
  if (!data) return null;

  const { summary, months, branchSummary } = data;
  const showChart = !branch || branch === 'All';

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Correspondent Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
            Active correspondents · word &amp; photo payment records
          </p>
        </div>

        {/* Month selector + alert button */}
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar size={15} style={{ color: 'var(--muted)' }} />
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="input py-1.5 text-sm"
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>

          {isAdmin() && (
            <>
              <button
                onClick={sendPaymentAlert}
                disabled={alertSending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-80 disabled:opacity-50"
                style={{ background: '#d7192015', color: '#d71920', border: '1px solid #d7192030' }}
                title="Send zero-payment alert to REs via Telegram"
              >
                {alertSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Send Payment Alert
              </button>
              <button
                onClick={toggleLogs}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:opacity-80"
                style={{ background: '#3b82f615', color: '#3b82f6', border: '1px solid #3b82f630' }}
              >
                <ClipboardList size={13} />
                {showLogs ? 'Hide Report' : 'View Report'}
              </button>
            </>
          )}
          {alertMsg && (
            <span className="text-xs font-medium" style={{ color: alertMsg.startsWith('✓') ? '#10b981' : '#d71920' }}>
              {alertMsg}
            </span>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Users}       label="Total Correspondents" value={fmt(summary.total)}   color="#2563eb" />
        <StatCard icon={TrendingUp}  label="Active This Month"    value={fmt(summary.active)}  sub={`of ${fmt(summary.total)}`} color="#059669" />
        <StatCard icon={FileText}    label="Stories"              value={fmt(summary.stories)} color="#7c3aed" />
        <StatCard icon={FileText}    label="Words"                value={fmt(summary.words)}   color="#0891b2" />
        <StatCard icon={Image}       label="Photos"               value={fmt(summary.photos)}  color="#d97706" />
        <StatCard icon={IndianRupee} label="Amount Paid"          value={fmtAmt(summary.amount)} color="#dc2626" />
      </div>

      {/* ── Branch chart ── */}
      {showChart && branchSummary.length > 0 && (
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Payment by Branch (₹)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={[...branchSummary].sort((a, b) => b.amount - a.amount)} margin={{ top: 4, right: 10, left: 10, bottom: 50 }}>
              <XAxis dataKey="branch" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? '₹' + (v/1000).toFixed(0) + 'k' : '₹' + v} />
              <Tooltip formatter={(v) => ['₹' + Number(v).toLocaleString('en-IN'), 'Amount Paid']} />
              <Bar dataKey="amount" radius={[4,4,0,0]}>
                {[...branchSummary].sort((a, b) => b.amount - a.amount).map((_, i) => (
                  <Cell key={i} fill={BRANCH_COLORS[i % BRANCH_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Table ── */}
      <div className="card overflow-hidden">
        {/* Search bar */}
        <div className="flex items-center gap-3 p-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <Search size={15} style={{ color: 'var(--muted)' }} />
          <input
            className="flex-1 bg-transparent text-sm outline-none"
            placeholder="Search by name, branch, district, location, PAN…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="text-xs" style={{ color: 'var(--muted)' }}>{sorted.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-semibold uppercase" style={{ borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--bg)' }}>
                {[
                  { col: 'name',         label: 'Name' },
                  { col: 'branch',       label: 'Branch' },
                  { col: 'district',     label: 'District' },
                  { col: 'location',     label: 'Location' },
                  { col: 'stories',      label: 'Stories' },
                  { col: 'words',        label: 'Words' },
                  { col: 'photos',       label: 'Photos' },
                  { col: 'amount_paid',  label: 'Amount' },
                ].map(({ col, label }) => (
                  <th key={col}
                    className="px-3 py-2.5 cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggle(col)}>
                    <span className="flex items-center gap-1">
                      {label} <SortIcon col={col} sort={sort} />
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2.5">Payment</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={9} className="text-center py-10" style={{ color: 'var(--muted)' }}>No records found</td></tr>
              )}
              {sorted.map(r => {
                const hasData = r.stories > 0 || r.words > 0 || r.photos > 0;
                const isOpen  = expanded === r.pan_no;
                return [
                  <tr key={r.pan_no}
                    onClick={() => setExpanded(isOpen ? null : r.pan_no)}
                    className="border-b cursor-pointer hover:opacity-80 transition"
                    style={{ borderColor: 'var(--border)', background: isOpen ? 'var(--bg)' : undefined }}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{r.pan_no}</div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.branch}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.district}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{r.location || '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{hasData ? fmt(r.stories) : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{hasData ? fmt(r.words)   : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{hasData ? fmt(r.photos)  : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">
                      {r.amount_paid > 0 ? <span style={{ color: '#059669' }}>{fmtAmt(r.amount_paid)}</span> : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.payment_status === 1
                        ? <span className="badge badge-green text-xs">Paid</span>
                        : r.payment_status === 0 && hasData
                          ? <span className="badge badge-yellow text-xs">Pending</span>
                          : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                    </td>
                  </tr>,
                  isOpen && (
                    <tr key={r.pan_no + '-detail'} style={{ background: 'var(--bg)' }}>
                      <td colSpan={9} className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          {r.mobile && (
                            <div className="flex items-center gap-1.5">
                              <Phone size={12} style={{ color: 'var(--muted)' }} />
                              <a href={`tel:${r.mobile}`} className="hover:underline">{r.mobile}</a>
                            </div>
                          )}
                          {r.email_id && (
                            <div className="flex items-center gap-1.5 truncate">
                              <Mail size={12} style={{ color: 'var(--muted)' }} />
                              <a href={`mailto:${r.email_id}`} className="hover:underline truncate">{r.email_id}</a>
                            </div>
                          )}
                          {r.desk_name && (
                            <div className="flex items-center gap-1.5">
                              <MapPin size={12} style={{ color: 'var(--muted)' }} />
                              <span>{r.desk_name}</span>
                            </div>
                          )}
                          {r.type && (
                            <div><span className="font-semibold" style={{ color: 'var(--muted)' }}>Type: </span>{r.type}</div>
                          )}
                          {r.dob && r.dob !== '' && (
                            <div><span className="font-semibold" style={{ color: 'var(--muted)' }}>DOB: </span>{r.dob}</div>
                          )}
                          {r.joining_date && r.joining_date !== '' && (
                            <div><span className="font-semibold" style={{ color: 'var(--muted)' }}>Joined: </span>{r.joining_date}</div>
                          )}
                          {r.payment_on && (
                            <div><span className="font-semibold" style={{ color: 'var(--muted)' }}>Paid on: </span>{new Date(r.payment_on).toLocaleDateString('en-IN')}</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Telegram Alert Report (Admin only) ── */}
      {isAdmin() && showLogs && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <ClipboardList size={15} style={{ color: '#3b82f6' }} />
              Telegram Alert Report
            </h2>
            <div className="flex items-center gap-2">
              {logsLoading && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--muted)' }} />}
              <button onClick={fetchAlertLogs} disabled={logsLoading}
                className="text-xs px-2 py-1 rounded hover:opacity-70"
                style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}>
                Refresh
              </button>
            </div>
          </div>

          {alertLogs && alertLogs.length === 0 && (
            <p className="text-sm text-center py-6" style={{ color: 'var(--muted)' }}>No alerts sent yet.</p>
          )}

          {alertLogs && alertLogs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs" style={{ color: 'var(--muted)' }}>
                    <th className="p-2 font-medium">#</th>
                    <th className="p-2 font-medium">RE Name</th>
                    <th className="p-2 font-medium">Branch</th>
                    <th className="p-2 font-medium">Month</th>
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium">Triggered By</th>
                    <th className="p-2 font-medium">Sent At</th>
                    <th className="p-2 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {alertLogs.map((log, i) => (
                    <tr key={log.id} className="border-t text-xs" style={{ borderColor: 'var(--border)' }}>
                      <td className="p-2" style={{ color: 'var(--muted)' }}>{i + 1}</td>
                      <td className="p-2 font-medium">{log.re_name || '—'}</td>
                      <td className="p-2">{log.branch || '—'}</td>
                      <td className="p-2">{log.month || '—'}</td>
                      <td className="p-2">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{
                            background: log.status === 'sent' ? '#10b98120' : '#d7192020',
                            color:      log.status === 'sent' ? '#10b981'   : '#d71920',
                          }}>
                          {log.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                        </span>
                      </td>
                      <td className="p-2 capitalize">{log.triggered_by || 'cron'}</td>
                      <td className="p-2 whitespace-nowrap" style={{ color: 'var(--muted)' }}>
                        {log.sent_at ? new Date(log.sent_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) : '—'}
                      </td>
                      <td className="p-2" style={{ color: '#d71920' }}>{log.error_msg || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
