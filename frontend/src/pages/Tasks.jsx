import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardList, Plus, X, CheckCircle2, Clock, AlertCircle, Ban,
  ChevronDown, ChevronUp, Users, BarChart2, MessageSquare, Send,
  Trash2, Edit2, UserPlus, Star, Loader2, Calendar,
  Newspaper, MapPin, BadgeCheck, Circle, ChevronRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { api }   from '../api/client.js';
import { PageHeader, SectionCard } from '../components/UI.jsx';

const CATEGORIES = [
  'Page Planning', 'Story Assignment', 'Photo Coverage', 'Breaking News Follow-up',
  'Exclusive Story', 'Investigation / Khulasa', 'Interview Scheduling', 'Event Coverage',
  'Election Coverage', 'Festival / Special Page', 'Supplement / Pullout', 'Photo Essay',
  'District / Rural Coverage', 'Circulation Drive', 'Reader Connect / Campaign',
  'Stringer Management', 'QC Review', 'Edition Deadline', 'Bureau Visit',
  'Reporter Appraisal', 'Content Audit', 'Legal Follow-up', 'Special Edition',
  'Advertisement Content', 'Other',
];

// ── Ready-made newsroom task pack (one-click load into Task Bank) ─────────────
const NEWSROOM_PACK = [
  { title: 'Page-1 lead story follow-up with fresh angle',                     category: 'Breaking News Follow-up',    priority: 'high',
    description: 'Yesterday\'s lead needs a Day-2 follow: reactions, official response, what-next angle. File by 4 PM for page planning.' },
  { title: 'File 1 exclusive / khulasa this week',                             category: 'Investigation / Khulasa',    priority: 'high',
    description: 'Work sources for one exclusive: RTI findings, civic failure, corruption angle, or human-impact investigation. Coordinate with desk before publishing.' },
  { title: 'Advance planning: upcoming festival special page',                 category: 'Festival / Special Page',    priority: 'high',
    description: 'Plan stories, photos and ads coordination for the upcoming festival. Submit page plan 3 days in advance to desk head.' },
  { title: 'Election beat: candidate & booth-level ground report',             category: 'Election Coverage',          priority: 'high',
    description: 'Ground report from constituency: voter mood, key issues, candidate movement. Include voices from at least 5 voters with names.' },
  { title: 'Civic issues series: one hyperlocal problem story daily',          category: 'Reader Connect / Campaign',  priority: 'medium',
    description: 'Daily hyperlocal story — roads, water, drainage, streetlights — with photo, official version, and follow-up tracker.' },
  { title: 'District / rural belt coverage visit',                            category: 'District / Rural Coverage',  priority: 'medium',
    description: 'Visit assigned rural belt: mandi rates, farmer issues, panchayat developments, school/hospital ground check. Minimum 2 stories from the visit.' },
  { title: 'Photo essay: weekend visual feature',                             category: 'Photo Essay',                priority: 'medium',
    description: 'Shoot a 5-6 photo essay on a local theme (market, heritage, seasonal change). Captions with names and context mandatory.' },
  { title: 'Verify & activate silent stringers in your area',                 category: 'Stringer Management',        priority: 'medium',
    description: 'Identify stringers who filed nothing this week. Call each, resolve blockers, assign one story each for tomorrow.' },
  { title: 'QC correction: fix repeated mistakes flagged this week',          category: 'QC Review',                  priority: 'high',
    description: 'Review this week\'s QC report for your pages. Brief the desk on repeated errors (spelling, captions, headline facts) and confirm corrections.' },
  { title: 'Edition deadline audit: release all pages before schedule',       category: 'Edition Deadline',           priority: 'high',
    description: 'Track tonight\'s page release times vs schedule. Identify the bottleneck page and fix the workflow. Target: zero delay.' },
  { title: 'Interview: district official / newsmaker of the week',            category: 'Interview Scheduling',       priority: 'medium',
    description: 'Schedule and conduct one Q&A with a relevant official or newsmaker. Push for news-making quotes, not routine statements.' },
  { title: 'Supplement / pullout content plan for next week',                 category: 'Supplement / Pullout',       priority: 'medium',
    description: 'Submit next week\'s pullout plan: anchor story, features, photo plan, and ad-space coordination with marketing.' },
  { title: 'Circulation push: story from a weak-circulation pocket',          category: 'Circulation Drive',          priority: 'medium',
    description: 'Identify a locality with weak circulation. File a strong hyperlocal story from there and coordinate copy promotion with circulation team.' },
  { title: 'Reader grievance follow-up: publish impact story',               category: 'Reader Connect / Campaign',  priority: 'medium',
    description: 'Pick one previously published reader complaint. Check current status with authorities and publish the impact/follow-up.' },
  { title: 'Daily evening planning meeting with desk & reporters',            category: 'Page Planning',              priority: 'low',
    description: 'Run the 6 PM planning meeting: tomorrow\'s page-1 candidates, assignments, photo plan, and pending follow-ups.' },
  { title: 'Content audit: compare our edition vs competitor',                category: 'Content Audit',              priority: 'low',
    description: 'Morning audit: what did competitors carry that we missed? List missed stories and assign catch-up follow-ups by noon.' },
];

const GROUP_TYPES = ['RE', 'Chief Reporter', 'Desk Head', 'Mixed'];

const PRIORITY = {
  high:   { label: 'High',   dot: '#ef4444', bg: '#fef2f2', text: '#b91c1c' },
  medium: { label: 'Medium', dot: '#f59e0b', bg: '#fffbeb', text: '#92400e' },
  low:    { label: 'Low',    dot: '#10b981', bg: '#f0fdf4', text: '#065f46' },
};

const STATUS = {
  pending:     { label: 'Pending',     Icon: Clock,        color: '#6b7280', bg: '#f3f4f6' },
  in_progress: { label: 'In Progress', Icon: AlertCircle,  color: '#3b82f6', bg: '#eff6ff' },
  completed:   { label: 'Completed',   Icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf4' },
  cancelled:   { label: 'Cancelled',   Icon: Ban,          color: '#ef4444', bg: '#fef2f2' },
};

const GRADE_COLOR = { A: '#16a34a', B: '#3b82f6', C: '#f59e0b', D: '#ef4444' };

function PriorityBadge({ p }) {
  const c = PRIORITY[p] || PRIORITY.medium;
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 11, padding: '2px 8px', borderRadius: 9999, fontWeight: 600 }}>
      {c.label}
    </span>
  );
}

function StatusBadge({ s }) {
  const c = STATUS[s] || STATUS.pending;
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 11, padding: '2px 8px 2px 6px', borderRadius: 9999, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <c.Icon size={11} /> {c.label}
    </span>
  );
}

// ── Assign-to selector (shared between single & bulk modals) ─────────────────
function TelegramBadge({ sent, sentAt }) {
  const title = sent
    ? `Telegram alert sent${sentAt ? ' at ' + String(sentAt).slice(0, 16).replace('T', ' ') : ''}`
    : 'Telegram alert not sent (no Telegram registered)';
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 11, padding: '2px 7px', borderRadius: 9999, fontWeight: 600,
      background: sent ? '#f0fdf4' : '#f3f4f6',
      color:      sent ? '#16a34a' : '#9ca3af',
      border: `1px solid ${sent ? '#bbf7d0' : '#e5e7eb'}`,
    }}>
      📱 {sent ? 'Sent' : 'Not sent'}
    </span>
  );
}

function AssignSelector({ assignees, groups, value, groupValue, mode, onMode, onPan, onGroup }) {
  const [search, setSearch] = useState('');
  const filtered = search.trim()
    ? assignees.filter(a =>
        a.name?.toLowerCase().includes(search.toLowerCase()) ||
        a.Branch?.toLowerCase().includes(search.toLowerCase()) ||
        a.State?.toLowerCase().includes(search.toLowerCase())
      )
    : null;
  const byState = assignees.reduce((acc, a) => {
    const s = a.State || 'Other'; if (!acc[s]) acc[s] = []; acc[s].push(a); return acc;
  }, {});

  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
        Assign To *
      </label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {['individual', 'group'].map(m => (
          <button key={m} type="button" onClick={() => onMode(m)}
            style={{
              flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: '1.5px solid ' + (mode === m ? 'var(--brand)' : 'var(--border)'),
              background: mode === m ? 'var(--brand)' : 'transparent',
              color: mode === m ? '#fff' : 'var(--text)', cursor: 'pointer',
            }}>
            {m === 'individual' ? '👤 Individual' : '👥 Group'}
          </button>
        ))}
      </div>

      {mode === 'individual' ? (
        <>
          <input className="input" placeholder="Search name, branch, state…" value={search}
            onChange={e => { setSearch(e.target.value); onPan(''); }} style={{ marginBottom: 6 }} />
          <select className="input" value={value} onChange={e => onPan(e.target.value)}>
            <option value="">— Select Person —</option>
            {filtered
              ? filtered.map(a => (
                  <option key={a.pan_no} value={a.pan_no}>
                    {a.name} · {a.State}{a.Branch ? `/${a.Branch}` : ''}{a.designation ? ` (${a.designation})` : ''}{a.has_telegram ? ' 📱' : ''}
                  </option>
                ))
              : Object.keys(byState).sort().map(s => (
                  <optgroup key={s} label={s}>
                    {byState[s].map(a => (
                      <option key={a.pan_no} value={a.pan_no}>
                        {a.name}{a.Branch ? ` · ${a.Branch}` : ''}{a.designation ? ` (${a.designation})` : ''}{a.has_telegram ? ' 📱' : ''}
                      </option>
                    ))}
                  </optgroup>
                ))
            }
          </select>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>📱 = Telegram registered</p>
        </>
      ) : (
        <select className="input" value={groupValue} onChange={e => onGroup(e.target.value)}>
          <option value="">— Select Group —</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name} ({g.member_count} members) · {g.type}</option>
          ))}
        </select>
      )}
    </div>
  );
}

// ── Create Task Modal (supports bulk + group) ─────────────────────────────────
function CreateModal({ user, onClose, onDone }) {
  const [assignees,    setAssignees]    = useState([]);
  const [groups,       setGroups]       = useState([]);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [mode,      setMode]      = useState('individual'); // individual | group
  const [pan,       setPan]       = useState('');
  const [group,     setGroup]     = useState('');
  const [shared,    setShared]    = useState({ category: 'Story Assignment', priority: 'medium', due_date: '' });
  const [tasks,     setTasks]     = useState([{ title: '', description: '' }]);
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState('');

  useEffect(() => {
    api.taskAssignees().then(r => setAssignees(r.assignees || [])).catch(() => {});
    api.listTaskGroups().then(r => setGroups(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const setTask = (i, k, v) => setTasks(ts => ts.map((t, idx) => idx === i ? { ...t, [k]: v } : t));
  const addTask = () => setTasks(ts => [...ts, { title: '', description: '' }]);
  const removeTask = i => setTasks(ts => ts.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (tasks.every(t => !t.title.trim())) return setErr('At least one task title is required');
    if (mode === 'individual' && !pan) return setErr('Please select an assignee');
    if (mode === 'group' && !group) return setErr('Please select a group');
    setErr(''); setSaving(true);
    try {
      const payload = {
        ...shared,
        tasks: tasks.filter(t => t.title.trim()),
        assigned_to_pan:   mode === 'individual' ? pan   : undefined,
        assigned_to_group: mode === 'group'      ? group : undefined,
      };
      const r = await api.createTask(payload);
      onDone();
      onClose();
      if (r.count > 1) alert(`✅ ${r.count} tasks created successfully!`);
    } catch (e) {
      setErr(e.message || 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 580, padding: 24, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Create Task(s)</h3>
          <button onClick={onClose} style={{ color: 'var(--muted)', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Task list */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Tasks *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setShowBankPicker(true)}
                  style={{ fontSize: 11, color: '#7c3aed', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                  <Star size={11} /> From Task Bank
                </button>
                <button type="button" onClick={addTask}
                  style={{ fontSize: 11, color: 'var(--brand)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Plus size={12} /> Add Another
                </button>
              </div>
            </div>
            {tasks.map((t, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)', minWidth: 16 }}>#{i + 1}</span>
                  <input className="input" style={{ flex: 1 }} placeholder="Task title *"
                    value={t.title} onChange={e => setTask(i, 'title', e.target.value)} />
                  {tasks.length > 1 && (
                    <button type="button" onClick={() => removeTask(i)} style={{ color: '#ef4444', cursor: 'pointer' }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                <textarea className="input" rows={2} placeholder="Description (optional)"
                  value={t.description} onChange={e => setTask(i, 'description', e.target.value)}
                  style={{ resize: 'vertical', width: '100%', fontSize: 12 }} />
              </div>
            ))}
          </div>

          {/* Category + Priority + Due Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Category</label>
              <select className="input" value={shared.category} onChange={e => setShared(s => ({ ...s, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Priority</label>
              <select className="input" value={shared.priority} onChange={e => setShared(s => ({ ...s, priority: e.target.value }))}>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Due Date</label>
              <input className="input" type="date" value={shared.due_date}
                onChange={e => setShared(s => ({ ...s, due_date: e.target.value }))} />
            </div>
          </div>

          {/* Assign to */}
          <AssignSelector
            assignees={assignees} groups={groups}
            value={pan} groupValue={group} mode={mode}
            onMode={setMode} onPan={setPan} onGroup={setGroup}
          />

          {tasks.length > 1 || group ? (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#1d4ed8' }}>
              ℹ️ {tasks.length > 1 ? `${tasks.filter(t => t.title.trim()).length} tasks` : '1 task'} will be created
              {group ? ` for each member of the selected group` : ` for the selected person`}.
            </div>
          ) : null}

          {err && <p style={{ color: '#ef4444', fontSize: 12 }}>{err}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary flex items-center gap-2" onClick={submit} disabled={saving}>
              {saving ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : <><Plus size={13} /> Create Task(s)</>}
            </button>
          </div>
        </div>
      </div>

      {showBankPicker && (
        <TaskBankPicker
          onClose={() => setShowBankPicker(false)}
          onSelect={t => {
            setTasks(ts => {
              const empty = ts.findIndex(x => !x.title.trim());
              if (empty !== -1) {
                return ts.map((x, i) => i === empty ? { title: t.title, description: t.description || '' } : x);
              }
              return [...ts, { title: t.title, description: t.description || '' }];
            });
            setShared(s => ({ ...s, category: t.category || s.category, priority: t.priority || s.priority }));
            setShowBankPicker(false);
          }}
        />
      )}
    </div>
  );
}

// ── Comments Panel ────────────────────────────────────────────────────────────
function CommentsPanel({ task, user }) {
  const [comments,  setComments]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [comment,   setComment]   = useState('');
  const [statusUpd, setStatusUpd] = useState('');
  const [saving,    setSaving]    = useState(false);
  const bottomRef = useRef();

  const load = () => {
    setLoading(true);
    api.taskComments(task.id).then(r => { setComments(r.comments || []); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(load, [task.id]); // eslint-disable-line

  const submit = async () => {
    if (!comment.trim()) return;
    setSaving(true);
    try {
      await api.addTaskComment({ task_id: task.id, comment: comment.trim(), status_update: statusUpd || undefined });
      setComment(''); setStatusUpd('');
      load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const isAssignee = user?.sub === task.assigned_to_pan || user?.name === task.assigned_to_name;

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
        <MessageSquare size={11} /> COMMENTS {comments.length > 0 && `(${comments.length})`}
      </p>

      {loading ? <p style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</p> : (
        <>
          {comments.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>No comments yet.</p>}
          <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 8 }}>
            {comments.map(c => (
              <div key={c.id} style={{ marginBottom: 8, padding: '6px 10px', background: 'var(--bg)', borderRadius: 7, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600 }}>{c.commenter_name || c.commenter_pan}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>{String(c.created_at).slice(0, 16).replace('T', ' ')}</span>
                </div>
                {c.status_update && (
                  <StatusBadge s={c.status_update} />
                )}
                <p style={{ marginTop: 3, color: 'var(--text)', lineHeight: 1.5 }}>{c.comment}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Add comment — anyone with access */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea
              className="input" rows={2} placeholder="Add a comment…"
              value={comment} onChange={e => setComment(e.target.value)}
              style={{ resize: 'none', fontSize: 12 }}
            />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {/* Assignee can update status */}
              {isAssignee && task.status !== 'completed' && task.status !== 'cancelled' && (
                <select className="input" style={{ flex: 1, fontSize: 12 }} value={statusUpd} onChange={e => setStatusUpd(e.target.value)}>
                  <option value="">No status change</option>
                  {task.status === 'pending'     && <option value="in_progress">Mark: In Progress</option>}
                  {task.status === 'in_progress' && <option value="completed">Mark: Completed</option>}
                  <option value="cancelled">Mark: Cancelled</option>
                </select>
              )}
              <button
                onClick={submit} disabled={saving || !comment.trim()}
                className="btn-primary flex items-center gap-1"
                style={{ fontSize: 12, padding: '5px 12px', flexShrink: 0 }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                {saving ? '…' : 'Send'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, canEdit, onRefresh }) {
  const { user } = useApp();
  const [open,     setOpen]     = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showDel,  setShowDel]  = useState(false);

  const changeStatus = async (s) => {
    setUpdating(true);
    try { await api.updateTask(task.id, { status: s }); onRefresh(); }
    catch (e) { alert('Failed: ' + e.message); }
    finally { setUpdating(false); }
  };

  const deleteTask = async () => {
    if (!confirm('Delete this task?')) return;
    try { await api.deleteTask(task.id); onRefresh(); }
    catch (e) { alert(e.message); }
  };

  const due     = task.due_date ? String(task.due_date).slice(0, 10) : null;
  const overdue = due && ['pending','in_progress'].includes(task.status) && new Date(due) < new Date();
  const dueIn3  = due && ['pending','in_progress'].includes(task.status) &&
    (new Date(due) - new Date()) / 86400000 <= 3 && !overdue;

  const isCreator  = user?.sub === task.assigned_by;
  const isAssignee = user?.sub === task.assigned_to_pan;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', borderLeft: `4px solid ${STATUS[task.status]?.color || '#6b7280'}`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {task.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {task.category} · <b>{task.assigned_to_name}</b>
            {task.assigned_to_branch ? ` (${task.assigned_to_branch})` : task.assigned_to_state ? ` (${task.assigned_to_state})` : ''}
            {due && <span style={{ marginLeft: 8, color: overdue ? '#ef4444' : dueIn3 ? '#f59e0b' : 'var(--muted)' }}>
              📅 {due}{overdue ? ' ⚠️ Overdue' : dueIn3 ? ' ⚡ Due Soon' : ''}
            </span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <PriorityBadge p={task.priority} />
          <StatusBadge   s={task.status}   />
          <TelegramBadge sent={task.telegram_sent} sentAt={task.telegram_sent_at} hasTelegram={!!task.assigned_to_pan} />
          {open ? <ChevronUp size={15} style={{ color: 'var(--muted)' }} /> : <ChevronDown size={15} style={{ color: 'var(--muted)' }} />}
        </div>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px 14px' }}>
          {task.description && (
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, marginBottom: 10, whiteSpace: 'pre-wrap' }}>{task.description}</p>
          )}
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap', marginBottom: 10 }}>
            <span>From: {task.assigned_by_name || task.assigned_by}</span>
            {task.completed_at && <span>Completed: {String(task.completed_at).slice(0, 16).replace('T', ' ')}</span>}
            <span>Created: {String(task.created_at).slice(0, 10)}</span>
          </div>

          {/* Quick status actions for assignee */}
          {isAssignee && task.status === 'pending' && (
            <button className="btn-primary" style={{ fontSize: 12, padding: '5px 14px', marginBottom: 8 }}
              disabled={updating} onClick={() => changeStatus('in_progress')}>
              {updating ? '…' : '▶ Start Task'}
            </button>
          )}
          {isAssignee && task.status === 'in_progress' && (
            <button className="btn-primary" style={{ fontSize: 12, padding: '5px 14px', marginBottom: 8 }}
              disabled={updating} onClick={() => changeStatus('completed')}>
              {updating ? '…' : '✅ Mark Complete'}
            </button>
          )}
          {/* Creator cancel/delete */}
          {(canEdit || isCreator) && task.status === 'pending' && (
            <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 14px', color: '#ef4444', marginLeft: 6 }}
              disabled={updating} onClick={() => changeStatus('cancelled')}>
              Cancel
            </button>
          )}
          {(canEdit || isCreator) && (
            <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px', color: '#ef4444', marginLeft: 6 }}
              onClick={deleteTask}>
              <Trash2 size={12} />
            </button>
          )}

          <CommentsPanel task={task} user={user} />
        </div>
      )}
    </div>
  );
}

// ── Groups Tab ────────────────────────────────────────────────────────────────
function GroupsTab({ canEdit }) {
  const [groups,    setGroups]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [selected,  setSelected]  = useState(null); // group object with members
  const [showForm,  setShowForm]  = useState(false);
  const [assignees, setAssignees] = useState([]);
  const [search,    setSearch]    = useState('');

  const loadGroups = () => {
    setLoading(true);
    api.listTaskGroups().then(r => { setGroups(Array.isArray(r) ? r : []); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => {
    loadGroups();
    if (canEdit) api.taskAssignees().then(r => setAssignees(r.assignees || [])).catch(() => {});
  }, []); // eslint-disable-line

  const openGroup = async (g) => {
    const detail = await api.getTaskGroup(g.id).catch(() => null);
    setSelected(detail?.group || g);
  };

  const deleteGroup = async (g) => {
    if (!confirm(`Delete group "${g.name}"? All member links will be removed.`)) return;
    await api.deleteTaskGroup(g.id).catch(e => alert(e.message));
    setSelected(null); loadGroups();
  };

  const removeMember = async (pan_no) => {
    await api.removeGroupMember(selected.id, pan_no).catch(e => alert(e.message));
    openGroup(selected);
  };

  const addMembersFromSearch = async (selectedPans) => {
    if (!selectedPans.length) return;
    await api.addGroupMembers(selected.id, selectedPans).catch(e => alert(e.message));
    openGroup(selected);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '260px 1fr' : '1fr', gap: 16 }}>
      {/* Group list */}
      <SectionCard
        title={`Groups (${groups.length})`}
        action={canEdit && (
          <button className="btn-primary flex items-center gap-1 text-sm px-3 py-1" onClick={() => setShowForm(true)}>
            <Plus size={13} /> New Group
          </button>
        )}
      >
        {loading ? <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>Loading…</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {groups.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)', padding: 16, textAlign: 'center' }}>No groups yet. Create one to get started.</p>}
            {groups.map(g => (
              <button key={g.id} onClick={() => openGroup(g)}
                style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: '1px solid',
                  borderColor: selected?.id === g.id ? 'var(--brand)' : 'var(--border)',
                  background: selected?.id === g.id ? '#eff6ff' : 'var(--bg)',
                  cursor: 'pointer',
                }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{g.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {g.type} · {g.member_count} members
                </div>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Group detail */}
      {selected && (
        <SectionCard
          title={selected.name}
          action={
            <div style={{ display: 'flex', gap: 6 }}>
              {canEdit && <AddMembersDropdown assignees={assignees} members={selected.members || []} onAdd={addMembersFromSearch} />}
              {canEdit && <button className="btn-ghost px-2" style={{ color: '#ef4444' }} onClick={() => deleteGroup(selected)}><Trash2 size={14} /></button>}
              <button className="btn-ghost px-2" onClick={() => setSelected(null)}><X size={14} /></button>
            </div>
          }
        >
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
            Type: <b>{selected.type || '—'}</b> · {selected.description || ''}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(!selected.members || selected.members.length === 0) && (
              <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>No members yet. Click "+ Add Members" to add.</p>
            )}
            {(selected.members || []).map(m => (
              <div key={m.pan_no} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: 'var(--bg)', borderRadius: 7 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{m.emp_name}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{m.branch || m.state || ''}{m.telegram_chat_id ? ' 📱' : ''}</span>
                </div>
                {canEdit && (
                  <button onClick={() => removeMember(m.pan_no)} style={{ color: '#ef4444', cursor: 'pointer' }}>
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {showForm && <GroupForm onClose={() => setShowForm(false)} onDone={(msg) => { setShowForm(false); loadGroups(); if (msg) alert('✅ Group created!' + msg); }} />}
    </div>
  );
}

function AddMembersDropdown({ assignees, members, onAdd }) {
  const [open,    setOpen]    = useState(false);
  const [search,  setSearch]  = useState('');
  const [sel,     setSel]     = useState([]);
  const memberPans = new Set(members.map(m => m.pan_no));
  const available = assignees.filter(a => !memberPans.has(a.pan_no) &&
    (!search || a.name?.toLowerCase().includes(search.toLowerCase()) ||
     a.Branch?.toLowerCase().includes(search.toLowerCase())));

  const toggle = (pan) => setSel(s => s.includes(pan) ? s.filter(p => p !== pan) : [...s, pan]);

  const doAdd = () => { onAdd(sel); setSel([]); setOpen(false); };

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn-primary flex items-center gap-1 text-sm px-3 py-1" onClick={() => setOpen(o => !o)}>
        <UserPlus size={13} /> Add Members
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '110%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, width: 280, zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
          <input className="input mb-2" style={{ fontSize: 12 }} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 8 }}>
            {available.slice(0, 50).map(a => (
              <label key={a.pan_no} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px', cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={sel.includes(a.pan_no)} onChange={() => toggle(a.pan_no)} />
                {a.name}{a.Branch ? ` · ${a.Branch}` : ''}{a.has_telegram ? ' 📱' : ''}
              </label>
            ))}
            {available.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 8 }}>No available members</p>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-ghost" style={{ flex: 1, fontSize: 12 }} onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" style={{ flex: 1, fontSize: 12 }} disabled={!sel.length} onClick={doAdd}>
              Add {sel.length > 0 ? `(${sel.length})` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const AUTO_MEMBER_TYPES = ['RE', 'Chief Reporter', 'Desk Head'];

function GroupForm({ onClose, onDone }) {
  const [form, setForm] = useState({ name: '', description: '', type: 'RE' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!form.name.trim()) return setErr('Group name is required');
    setSaving(true);
    try {
      const r = await api.createTaskGroup(form);
      const autoMsg = r.auto_members > 0 ? ` ${r.auto_members} members auto-added from employee records.` : '';
      onDone(autoMsg);
    }
    catch (e) { setErr(e.message); setSaving(false); }
  };

  const isAutoType = AUTO_MEMBER_TYPES.includes(form.type);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 15 }}>Create Group</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Group Name *</label>
            <input className="input" placeholder="e.g. MP RE Group" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Type</label>
            <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {GROUP_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            {isAutoType && (
              <p style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>
                ✅ All active <b>{form.type}</b> employees will be auto-added as members.
              </p>
            )}
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Description</label>
            <input className="input" placeholder="Optional description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          {err && <p style={{ color: '#ef4444', fontSize: 12 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={submit} disabled={saving}>
              {saving ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Report & Grading Tab ──────────────────────────────────────────────────────
function ReportTab() {
  const { user } = useApp();
  const [period, setPeriod] = useState('weekly');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.taskReport({ period, state: user?.role === 'State Head' ? user.state : undefined })
      .then(setReport).catch(() => setReport(null)).finally(() => setLoading(false));
  }, [period, user]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const gradeStyle = (g) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 26, height: 26, borderRadius: '50%', fontWeight: 800, fontSize: 13,
    background: (GRADE_COLOR[g] || '#6b7280') + '22',
    color: GRADE_COLOR[g] || '#6b7280',
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        {[['weekly', 'This Week'], ['monthly', 'This Month']].map(([val, lbl]) => (
          <button key={val} onClick={() => setPeriod(val)}
            style={{
              padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: period === val ? 'var(--brand)' : 'var(--bg)',
              color: period === val ? '#fff' : 'var(--text)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}>
            {lbl}
          </button>
        ))}
        <button onClick={load} className="btn-ghost px-3 py-1 text-sm ml-2">Refresh</button>
      </div>

      {/* Summary KPIs */}
      {report?.summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Total',       val: report.summary.total,       color: '#6b7280' },
            { label: 'Completed',   val: report.summary.completed,   color: '#16a34a' },
            { label: 'In Progress', val: report.summary.in_progress, color: '#3b82f6' },
            { label: 'Pending',     val: report.summary.pending,     color: '#f59e0b' },
          ].map(({ label, val, color }) => (
            <div key={label} className="card p-3" style={{ borderTop: `3px solid ${color}` }}>
              <div style={{ fontSize: 24, fontWeight: 700, color }}>{val || 0}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Branch-wise summary */}
      {report?.report?.length > 0 && (() => {
        const byBranch = {};
        report.report.forEach(r => {
          const b = r.assigned_to_branch || r.assigned_to_state || '—';
          if (!byBranch[b]) byBranch[b] = { branch: b, total: 0, completed: 0, overdue: 0 };
          byBranch[b].total     += Number(r.total)     || 0;
          byBranch[b].completed += Number(r.completed) || 0;
          byBranch[b].overdue   += Number(r.overdue)   || 0;
        });
        const rows = Object.values(byBranch)
          .map(b => ({ ...b, rate: b.total ? Math.round((b.completed / b.total) * 100) : 0 }))
          .sort((a, b) => b.rate - a.rate);
        return (
          <SectionCard title="Branch-wise Performance" className="mb-4">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700 }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Branch</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center' }}>Tasks</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center' }}>Completed</th>
                    <th style={{ padding: '8px 6px', textAlign: 'center' }}>Overdue</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: 160 }}>Completion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b, i) => (
                    <tr key={b.branch} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{b.branch}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center' }}>{b.total}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{b.completed}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', color: b.overdue > 0 ? '#ef4444' : 'var(--muted)' }}>{b.overdue}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 9999, background: 'var(--border)' }}>
                            <div style={{ width: `${b.rate}%`, height: 6, borderRadius: 9999,
                              background: b.rate >= 85 ? '#16a34a' : b.rate >= 70 ? '#3b82f6' : b.rate >= 50 ? '#f59e0b' : '#ef4444' }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 36, textAlign: 'right' }}>{b.rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        );
      })()}

      <SectionCard title="Employee Grading">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>
        ) : !report?.report?.length ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>No task data for this period.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700 }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Employee</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Branch</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center' }}>Total</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center' }}>Done</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center' }}>On-time</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center' }}>Overdue</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center' }}>Rate</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center' }}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {report.report.map((r, i) => (
                  <tr key={r.assigned_to_pan} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.assigned_to_name}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{r.assigned_to_branch || r.assigned_to_state || '—'}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>{r.total}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{r.completed}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', color: '#3b82f6' }}>{r.on_time}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', color: r.overdue > 0 ? '#ef4444' : 'var(--muted)' }}>{r.overdue}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>{r.completion_rate}%</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                      <span style={gradeStyle(r.grade)}>{r.grade}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10, padding: '0 4px' }}>
              Grade: <b style={{ color: GRADE_COLOR.A }}>A</b> ≥85% · <b style={{ color: GRADE_COLOR.B }}>B</b> ≥70% · <b style={{ color: GRADE_COLOR.C }}>C</b> ≥50% · <b style={{ color: GRADE_COLOR.D }}>D</b> &lt;50%
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Task Bank Tab ─────────────────────────────────────────────────────────────
function TaskBankTab({ canEdit }) {
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState(null);

  const load = () => {
    setLoading(true);
    api.listTaskBank().then(r => { setTemplates(r.templates || []); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line

  const deleteItem = async (t) => {
    if (!confirm(`Delete template "${t.title}"?`)) return;
    await api.deleteTaskBankItem(t.id).catch(e => alert(e.message));
    load();
  };

  const [packLoading, setPackLoading] = useState(false);
  const loadNewsroomPack = async () => {
    const existing = new Set(templates.map(t => t.title.toLowerCase().trim()));
    const missing  = NEWSROOM_PACK.filter(t => !existing.has(t.title.toLowerCase().trim()));
    if (!missing.length) return alert('All newsroom pack templates are already in the bank.');
    if (!confirm(`Add ${missing.length} ready-made newsroom task templates to the bank?`)) return;
    setPackLoading(true);
    let added = 0;
    for (const t of missing) {
      try { await api.createTaskBankItem(t); added++; } catch { /* skip on error */ }
    }
    setPackLoading(false);
    alert(`✅ ${added} newsroom templates added.`);
    load();
  };

  const cats = ['all', ...Array.from(new Set(templates.map(t => t.category))).sort()];
  const filtered = templates.filter(t => {
    if (catFilter !== 'all' && t.category !== catFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) &&
        !(t.description || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <SectionCard
        title={`Task Bank (${templates.length} templates)`}
        action={canEdit && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-ghost flex items-center gap-1 text-sm px-3 py-1"
              style={{ color: '#7c3aed', fontWeight: 600 }}
              disabled={packLoading} onClick={loadNewsroomPack}>
              {packLoading ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />} Newsroom Pack
            </button>
            <button className="btn-primary flex items-center gap-1 text-sm px-3 py-1"
              onClick={() => { setEditing(null); setShowForm(true); }}>
              <Plus size={13} /> New Template
            </button>
          </div>
        )}
      >
        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <input className="input" placeholder="Search templates…" value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 180, fontSize: 12 }} />
          <select className="input" value={catFilter} onChange={e => setCatFilter(e.target.value)}
            style={{ fontSize: 12 }}>
            {cats.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Star size={36} style={{ color: 'var(--muted)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14, color: 'var(--muted)' }}>
              {templates.length === 0 ? 'No templates yet. Create your first task template.' : 'No templates match your search.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {filtered.map(t => (
              <div key={t.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--bg)', borderLeft: `3px solid ${PRIORITY[t.priority]?.dot || '#6b7280'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{t.title}</span>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                      <button onClick={() => { setEditing(t); setShowForm(true); }}
                        style={{ color: 'var(--muted)', cursor: 'pointer', padding: 2 }}><Edit2 size={13} /></button>
                      <button onClick={() => deleteItem(t)}
                        style={{ color: '#ef4444', cursor: 'pointer', padding: 2 }}><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
                {t.description && (
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {t.description}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface)', padding: '2px 7px', borderRadius: 9999, border: '1px solid var(--border)' }}>
                    {t.category}
                  </span>
                  <PriorityBadge p={t.priority} />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {showForm && (
        <TaskBankForm
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onDone={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function TaskBankForm({ initial, onClose, onDone }) {
  const [form, setForm] = useState({
    title:       initial?.title       || '',
    description: initial?.description || '',
    category:    initial?.category    || 'Story Assignment',
    priority:    initial?.priority    || 'medium',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const submit = async () => {
    if (!form.title.trim()) return setErr('Title is required');
    setSaving(true);
    try {
      if (initial) { await api.updateTaskBankItem(initial.id, form); }
      else         { await api.createTaskBankItem(form); }
      onDone();
    } catch (e) { setErr(e.message); setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 22, width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ fontWeight: 700, fontSize: 15 }}>{initial ? 'Edit Template' : 'New Task Template'}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Title *</label>
            <input className="input" placeholder="e.g. Front Page Story Assignment"
              value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea className="input" rows={3} placeholder="Default task description / instructions…"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              style={{ resize: 'vertical' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Category</label>
              <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Default Priority</label>
              <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
          </div>
          {err && <p style={{ color: '#ef4444', fontSize: 12 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Task Bank Picker (used inside Create modal) ────────────────────────────────
function TaskBankPicker({ onSelect, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [catFilter, setCatFilter] = useState('all');

  useEffect(() => {
    api.listTaskBank().then(r => { setTemplates(r.templates || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const cats = ['all', ...Array.from(new Set(templates.map(t => t.category))).sort()];
  const filtered = templates.filter(t => {
    if (catFilter !== 'all' && t.category !== catFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontWeight: 700, fontSize: 15 }}>Pick from Task Bank</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <input className="input" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, fontSize: 12 }} />
          <select className="input" value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ fontSize: 12 }}>
            {cats.map(c => <option key={c} value={c}>{c === 'all' ? 'All' : c}</option>)}
          </select>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '10px 20px 16px' }}>
          {loading ? <p style={{ textAlign: 'center', padding: 30, color: 'var(--muted)' }}>Loading…</p> :
           filtered.length === 0 ? <p style={{ textAlign: 'center', padding: 30, color: 'var(--muted)', fontSize: 13 }}>No templates found.</p> :
           filtered.map(t => (
            <button key={t.id} onClick={() => onSelect(t)}
              style={{ width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 6, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', cursor: 'pointer', borderLeft: `3px solid ${PRIORITY[t.priority]?.dot || '#6b7280'}` }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{t.title}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t.category}</span>
                <PriorityBadge p={t.priority} />
              </div>
              {t.description && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.description}</p>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Weekly Plan & Review Tab ──────────────────────────────────────────────────
// RE submits a weekly action plan for their branch; State Head / Admin review & grade.
const PLAN_NOTES_TEMPLATE = `📰 WEEKLY EDITORIAL ACTION PLAN
═══════════════════════════════════════

1️⃣ PAGE-1 CONTENDERS (lead stories planned this week)
   • Story:                    | Reporter:          | Day:
   •

2️⃣ EXCLUSIVES / KHULASA / IMPACT JOURNALISM
   • Target: ___ exclusives this week
   • Investigation in progress:
   • Expected impact / follow-up plan:

3️⃣ EVENTS, FESTIVALS & CIVIC CALENDAR (advance planning)
   • Event:                    | Coverage type (photo/special page/live):
   •

4️⃣ LOCAL EDITION & PULLOUT PLANNING
   • Special pages / supplements planned:
   • District & rural coverage focus:

5️⃣ CIRCULATION-DRIVING CONTENT (reader connect)
   • Hyperlocal series / campaigns:
   • Reader panchayat / public grievance follow-ups:

6️⃣ NEWSROOM OPERATIONS
   • Staffing & leave adjustments:
   • Stringer network gaps to fill:
   • Edition deadline discipline plan:

7️⃣ LAST WEEK'S REVIEW (self-assessment)
   • Targets achieved:
   • Missed stories / gaps to fix:
   • QC mistakes & correction plan:
`;

const GRADE_DESC = { A: 'Excellent', B: 'Good', C: 'Average', D: 'Poor' };

function nextMonday() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? 1 : 8 - day; // days until next Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAJOR EVENT PLANNING & IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────
const EVENT_TYPES = [
  'Election Coverage', 'Festival / Special Edition', 'Investigative Series Launch',
  'State Level Event', 'National Event Coverage', 'Sports Special Coverage',
  'Supplement / Pullout', 'Press Conference Coverage', 'Exclusive Interview Campaign',
  'Civic Campaign / Readers\' Issue', 'Awards & Felicitation', 'Cultural Event Coverage',
  'Budget / Finance Coverage', 'Panchayat / Local Body Coverage', 'Health Campaign',
  'Education Special', 'Crime / Court Series', 'Environment Coverage', 'Other',
];

const EVENT_STATUS = {
  submitted:   { label: 'Submitted',   color: '#3b82f6', bg: '#eff6ff' },
  approved:    { label: 'Approved',    color: '#16a34a', bg: '#f0fdf4' },
  rejected:    { label: 'Rejected',    color: '#dc2626', bg: '#fef2f2' },
  in_progress: { label: 'In Progress', color: '#f59e0b', bg: '#fffbeb' },
  completed:   { label: 'Completed',   color: '#7c3aed', bg: '#f5f3ff' },
};

const BLANK_CHECKLIST = [
  { title: 'Story angles finalized and assigned', assignee: '', due: '', done: false },
  { title: 'Photographer/videographer deployed', assignee: '', due: '', done: false },
  { title: 'Page layout plan submitted to desk', assignee: '', due: '', done: false },
  { title: 'Field reporters briefed', assignee: '', due: '', done: false },
  { title: 'Stringers activated for coverage', assignee: '', due: '', done: false },
  { title: 'Copy filed and subbed on time', assignee: '', due: '', done: false },
  { title: 'Post-event impact story planned', assignee: '', due: '', done: false },
];

const BLANK_FORM = {
  event_name: '', event_type: EVENT_TYPES[0], event_start: '', event_end: '',
  location: '', planning_notes: '', staffing_plan: '', resources: '',
  checklist: BLANK_CHECKLIST,
};

function EventStatusBadge({ status }) {
  const s = EVENT_STATUS[status] || EVENT_STATUS.submitted;
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, padding: '2px 10px', borderRadius: 9999, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

function EventPlanningTab() {
  const { user, state: globalState, branch: globalBranch } = useApp();
  const [events,     setEvents]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState(BLANK_FORM);
  const [editId,     setEditId]     = useState(null);
  const [expanded,   setExpanded]   = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [reviewing,  setReviewing]  = useState(null); // { id, comment, status }
  const [statusFilter, setStatusFilter] = useState('all');

  const isRE    = user?.role === 'Regional Editor';
  const canReview = user?.role === 'Admin' || user?.role === 'State Head' || user?.role === 'Management';
  const canCreate = isRE || canReview;

  const load = useCallback(() => {
    setLoading(true);
    api.listEvents(globalState, globalBranch)
      .then(r => { setEvents(r.events || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [globalState, globalBranch]);
  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm(BLANK_FORM); setEditId(null); setShowForm(true);
  }
  function openEdit(ev) {
    setForm({
      event_name: ev.event_name, event_type: ev.event_type,
      event_start: ev.event_start?.slice(0,10) || '', event_end: ev.event_end?.slice(0,10) || '',
      location: ev.location || '', planning_notes: ev.planning_notes || '',
      staffing_plan: ev.staffing_plan || '', resources: ev.resources || '',
      checklist: ev.checklist?.length ? ev.checklist : BLANK_CHECKLIST,
    });
    setEditId(ev.id); setShowForm(true);
  }

  async function saveForm() {
    if (!form.event_name.trim()) { alert('Event name is required'); return; }
    setSaving(true);
    try {
      await api.saveEvent({ ...form, ...(editId ? { id: editId } : {}) });
      setShowForm(false); load();
    } catch (e) { alert('Error: ' + e.message); }
    setSaving(false);
  }

  async function submitReview() {
    if (!reviewing) return;
    setSaving(true);
    try {
      await api.saveEvent({ review: true, id: reviewing.id, review_comment: reviewing.comment, status: reviewing.status });
      setReviewing(null); load();
    } catch (e) { alert('Error: ' + e.message); }
    setSaving(false);
  }

  async function toggleCheckItem(ev, idx) {
    const updated = ev.checklist.map((item, i) => i === idx ? { ...item, done: !item.done } : item);
    try {
      await api.saveEvent({ progress: true, id: ev.id, checklist: updated });
      setEvents(es => es.map(e => e.id === ev.id ? { ...e, checklist: updated } : e));
    } catch (e) { alert('Error: ' + e.message); }
  }

  const fmtDate = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const visible = statusFilter === 'all' ? events : events.filter(e => e.status === statusFilter);

  return (
    <div>
      {/* Header actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', ...Object.keys(EVENT_STATUS)].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{
                padding: '4px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: statusFilter === s ? 'var(--brand)' : 'var(--bg)',
                color: statusFilter === s ? '#fff' : 'var(--fg)',
                border: '1px solid var(--border)',
              }}>
              {s === 'all' ? 'All' : EVENT_STATUS[s].label}
            </button>
          ))}
        </div>
        {canCreate && (
          <button className="btn-primary flex items-center gap-2" onClick={openNew}>
            <Plus size={15} /> New Event Plan
          </button>
        )}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}><Loader2 size={20} className="animate-spin" /></div>}

      {!loading && visible.length === 0 && (
        <div className="card p-10 text-center" style={{ color: 'var(--muted)' }}>
          <Newspaper size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
          <div style={{ fontSize: 14 }}>No event plans yet. Click "New Event Plan" to get started.</div>
        </div>
      )}

      {/* Event cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {visible.map(ev => {
          const isOpen = expanded === ev.id;
          const doneCount = (ev.checklist || []).filter(c => c.done).length;
          const totalCount = (ev.checklist || []).length;
          const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
          const canEdit = isRE && (ev.status === 'submitted' || ev.status === 'rejected');

          return (
            <div key={ev.id} className="card overflow-hidden">
              {/* Card header */}
              <button className="w-full text-left p-4 hover:bg-black/5 dark:hover:bg-white/5 transition"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
                onClick={() => setExpanded(isOpen ? null : ev.id)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{ev.event_name}</span>
                      <EventStatusBadge status={ev.status} />
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                        {ev.event_type}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: 'var(--muted)' }}>
                      {ev.event_start && <span>📅 {fmtDate(ev.event_start)}{ev.event_end && ev.event_end !== ev.event_start ? ` – ${fmtDate(ev.event_end)}` : ''}</span>}
                      {ev.location   && <span>📍 {ev.location}</span>}
                      <span>🏢 {ev.branch} · {ev.state}</span>
                      <span>By {ev.submitted_by_name || ev.submitted_by}</span>
                    </div>
                    {totalCount > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'var(--border)' }}>
                          <div style={{ width: `${pct}%`, height: 4, borderRadius: 4, background: pct === 100 ? '#16a34a' : '#3b82f6', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{doneCount}/{totalCount} tasks done</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {canEdit && (
                      <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={e => { e.stopPropagation(); openEdit(ev); }}>
                        <Edit2 size={13} />
                      </button>
                    )}
                    {canReview && ev.status === 'submitted' && (
                      <button className="btn-primary" style={{ fontSize: 12, padding: '4px 12px' }}
                        onClick={e => { e.stopPropagation(); setReviewing({ id: ev.id, comment: '', status: 'approved' }); }}>
                        Review
                      </button>
                    )}
                    <ChevronRight size={16} style={{ color: 'var(--muted)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)', padding: 16, background: 'var(--bg)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 16 }}>
                    {ev.planning_notes && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Coverage Plan</div>
                        <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{ev.planning_notes}</p>
                      </div>
                    )}
                    {ev.staffing_plan && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Team & Staffing</div>
                        <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{ev.staffing_plan}</p>
                      </div>
                    )}
                    {ev.resources && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Resources Required</div>
                        <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{ev.resources}</p>
                      </div>
                    )}
                  </div>

                  {/* Checklist */}
                  {ev.checklist?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Implementation Checklist</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {ev.checklist.map((item, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 8, background: item.done ? '#f0fdf4' : 'var(--surface)', border: `1px solid ${item.done ? '#86efac' : 'var(--border)'}` }}>
                            <button onClick={() => toggleCheckItem(ev, i)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: item.done ? '#16a34a' : 'var(--muted)', flexShrink: 0 }}>
                              {item.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                            </button>
                            <span style={{ flex: 1, fontSize: 13, textDecoration: item.done ? 'line-through' : 'none', color: item.done ? 'var(--muted)' : 'var(--fg)' }}>{item.title}</span>
                            {item.assignee && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{item.assignee}</span>}
                            {item.due && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{item.due}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Review remarks */}
                  {ev.review_comment && (
                    <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: ev.status === 'rejected' ? '#fef2f2' : '#f0fdf4', borderLeft: `3px solid ${ev.status === 'rejected' ? '#dc2626' : '#16a34a'}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, color: ev.status === 'rejected' ? '#dc2626' : '#16a34a' }}>
                        Reviewer Remarks — {ev.reviewed_by_name || ev.reviewed_by}
                      </div>
                      <p style={{ fontSize: 13, margin: 0 }}>{ev.review_comment}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Create / Edit modal ─────────────────────────────────────────────── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowForm(false)} />
          <div className="card relative z-10 flex flex-col" style={{ width: '100%', maxWidth: 680, maxHeight: '90vh', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16 }}>{editId ? 'Edit Event Plan' : 'New Major Event Plan'}</h3>
              <button onClick={() => setShowForm(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}><X size={20} /></button>
            </div>
            <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Event Name *</label>
                <input className="input w-full mt-1" value={form.event_name}
                  onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))}
                  placeholder="e.g. Rajasthan Election Ground Report 2026" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Event Type</label>
                  <select className="input w-full mt-1" value={form.event_type}
                    onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Location / Venue</label>
                  <input className="input w-full mt-1" value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="District, City or Area" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Event Start Date</label>
                  <input type="date" className="input w-full mt-1" value={form.event_start}
                    onChange={e => setForm(f => ({ ...f, event_start: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Event End Date</label>
                  <input type="date" className="input w-full mt-1" value={form.event_end}
                    onChange={e => setForm(f => ({ ...f, event_end: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Coverage Plan (story angles, page plan, photo plan)</label>
                <textarea className="input w-full mt-1" rows={4} value={form.planning_notes}
                  onChange={e => setForm(f => ({ ...f, planning_notes: e.target.value }))}
                  placeholder={`e.g.\n• Page-1 lead: voter mood from 5 booths\n• Page-3 special: candidate profiles\n• Photo essay: 6-8 frames from ground\n• Follow-up story next day`} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Team & Staffing</label>
                  <textarea className="input w-full mt-1" rows={3} value={form.staffing_plan}
                    onChange={e => setForm(f => ({ ...f, staffing_plan: e.target.value }))}
                    placeholder={`e.g.\n2 Reporters\n1 Photographer\n3 Stringers`} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Resources Required</label>
                  <textarea className="input w-full mt-1" rows={3} value={form.resources}
                    onChange={e => setForm(f => ({ ...f, resources: e.target.value }))}
                    placeholder={`e.g.\n1 Vehicle\nExtra pages allocated\nSocial media coordination`} />
                </div>
              </div>

              {/* Checklist editor */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Implementation Checklist</label>
                  <button style={{ fontSize: 12, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => setForm(f => ({ ...f, checklist: [...f.checklist, { title: '', assignee: '', due: '', done: false }] }))}>
                    + Add Item
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {form.checklist.map((item, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 6, alignItems: 'center' }}>
                      <input className="input" style={{ fontSize: 12 }} value={item.title}
                        onChange={e => setForm(f => ({ ...f, checklist: f.checklist.map((c, j) => j === i ? { ...c, title: e.target.value } : c) }))}
                        placeholder="Task description" />
                      <input className="input" style={{ fontSize: 12, width: 100 }} value={item.assignee}
                        onChange={e => setForm(f => ({ ...f, checklist: f.checklist.map((c, j) => j === i ? { ...c, assignee: e.target.value } : c) }))}
                        placeholder="Person" />
                      <input type="date" className="input" style={{ fontSize: 12, width: 130 }} value={item.due}
                        onChange={e => setForm(f => ({ ...f, checklist: f.checklist.map((c, j) => j === i ? { ...c, due: e.target.value } : c) }))} />
                      <button onClick={() => setForm(f => ({ ...f, checklist: f.checklist.filter((_, j) => j !== i) }))}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
              <button className="btn-ghost" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
              <button className="btn-primary flex items-center gap-2" onClick={saveForm} disabled={saving}>
                {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Send size={14} /> Submit to State Head</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Review modal (Admin / SH) ───────────────────────────────────────── */}
      {reviewing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setReviewing(null)} />
          <div className="card relative z-10" style={{ width: '100%', maxWidth: 480, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16 }}>Review Event Plan</h3>
              <button onClick={() => setReviewing(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Decision</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 14 }}>
              {['approved','rejected','in_progress'].map(s => (
                <button key={s} onClick={() => setReviewing(r => ({ ...r, status: s }))}
                  style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    background: reviewing.status === s ? EVENT_STATUS[s]?.color : 'var(--bg)',
                    color: reviewing.status === s ? '#fff' : 'var(--fg)',
                    border: `1px solid ${reviewing.status === s ? EVENT_STATUS[s]?.color : 'var(--border)'}` }}>
                  {EVENT_STATUS[s]?.label}
                </button>
              ))}
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Remarks</label>
            <textarea className="input w-full mt-1" rows={4} value={reviewing.comment}
              onChange={e => setReviewing(r => ({ ...r, comment: e.target.value }))}
              placeholder="Add feedback, suggestions or directives for the RE…" />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="btn-ghost" onClick={() => setReviewing(null)} disabled={saving}>Cancel</button>
              <button className="btn-primary flex items-center gap-2" onClick={submitReview} disabled={saving}>
                {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><BadgeCheck size={14} /> Submit Review</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WeeklyReviewTab() {
  const { user } = useApp();
  const [plans,     setPlans]     = useState([]);
  const [canReview, setCanReview] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(null); // plan being edited
  const [saving,    setSaving]    = useState(false);

  const load = () => {
    setLoading(true);
    api.listWeeklyReviews()
      .then(r => { setPlans(r.plans || []); setCanReview(!!r.canReview); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(load, []);

  const upcoming  = nextMonday();
  const myPlan    = plans.find(p => p.week_start === upcoming && p.submitted_by === user?.sub);
  const isWeekend = [0, 6].includes(new Date().getDay());
  const canSubmit = ['Admin', 'State Head', 'Regional Editor'].includes(user?.role);

  const startPlan = () => setEditing(myPlan || {
    week_start: upcoming,
    notes: PLAN_NOTES_TEMPLATE,
    action_items: [],
  });

  const save = async (plan) => {
    setSaving(true);
    try { await api.saveWeeklyReview(plan); setEditing(null); load(); }
    catch (e) { alert('Failed: ' + e.message); }
    finally { setSaving(false); }
  };

  const toggleItem = async (plan, idx) => {
    const items = plan.action_items.map((it, i) =>
      i === idx ? { ...it, status: it.status === 'done' ? 'pending' : 'done' } : it);
    await api.saveWeeklyReview({ id: plan.id, week_start: plan.week_start, notes: plan.notes, action_items: items })
      .catch(e => alert(e.message));
    load();
  };

  return (
    <div>
      {/* Submit banner */}
      {canSubmit && !myPlan && !editing && (
        <div style={{
          background: isWeekend ? '#fef2f2' : '#fffbeb',
          border: `1px solid ${isWeekend ? '#fecaca' : '#fde68a'}`,
          borderRadius: 10, padding: '14px 18px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: isWeekend ? '#b91c1c' : '#92400e' }}>
              {isWeekend ? '⏰ Weekly action plan is due this weekend' : '📋 Weekly action plan'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {user?.role === 'Regional Editor'
                ? <>Submit your branch action plan for the week starting <b>{upcoming}</b>. State Head will review &amp; grade it.</>
                : <>REs submit branch plans for the week starting <b>{upcoming}</b>; you review &amp; grade them below.</>}
            </div>
          </div>
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={startPlan}>
            <Plus size={14} /> Submit Action Plan
          </button>
        </div>
      )}
      {canSubmit && myPlan && !editing && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button className="btn-ghost flex items-center gap-1.5 text-sm" onClick={startPlan}>
            <Edit2 size={13} /> Edit My Plan for {upcoming}
          </button>
        </div>
      )}

      {editing && (
        <PlanEditor plan={editing} saving={saving} user={user}
          onCancel={() => setEditing(null)} onSave={save} />
      )}

      {/* Plans list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>
      ) : plans.length === 0 && !editing ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Calendar size={36} style={{ color: 'var(--muted)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14, color: 'var(--muted)' }}>No weekly plans submitted yet.</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Every Saturday 10 AM a Telegram reminder goes out. REs submit branch plans; State Head/Admin review &amp; grade.
          </p>
        </div>
      ) : (
        plans.map(p => (
          <PlanCard key={p.id} plan={p} user={user} canReview={canReview}
            onToggle={toggleItem} onRefresh={load} />
        ))
      )}
    </div>
  );
}

function PlanCard({ plan, user, canReview, onToggle, onRefresh }) {
  const [showReview, setShowReview] = useState(false);
  const [comment, setComment] = useState(plan.review_comment || '');
  const [grade,   setGrade]   = useState(plan.grade || '');
  const [saving,  setSaving]  = useState(false);

  const done   = plan.action_items.filter(i => i.status === 'done').length;
  const total  = plan.action_items.length;
  const isOwner = plan.submitted_by === user?.sub;
  const scope   = [plan.branch, plan.state].filter(Boolean).join(', ') || '—';

  const saveReview = async () => {
    setSaving(true);
    try {
      await api.saveWeeklyReview({ id: plan.id, review: true, review_comment: comment, grade: grade || undefined });
      setShowReview(false);
      onRefresh();
    } catch (e) { alert('Failed: ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <SectionCard className="mb-4"
      title={
        <span className="flex items-center gap-2 flex-wrap">
          <Calendar size={14} />
          Week of {plan.week_start}
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
            · {plan.submitted_by_name || plan.submitted_by} ({plan.submitted_role || '—'}) · {scope}
          </span>
          {total > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
              background: done === total ? '#f0fdf4' : '#fffbeb',
              color:      done === total ? '#16a34a' : '#92400e',
            }}>
              {done}/{total} done
            </span>
          )}
          {plan.grade ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 24, height: 24, borderRadius: '50%', fontWeight: 800, fontSize: 13,
              background: (GRADE_COLOR[plan.grade] || '#6b7280') + '22',
              color: GRADE_COLOR[plan.grade] || '#6b7280',
            }} title={`Graded ${plan.grade} (${GRADE_DESC[plan.grade]}) by ${plan.reviewed_by_name || ''}`}>
              {plan.grade}
            </span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: '#f3f4f6', color: '#6b7280' }}>
              Awaiting review
            </span>
          )}
        </span>
      }
      action={canReview && (
        <button className="btn-ghost text-sm flex items-center gap-1.5" onClick={() => setShowReview(s => !s)}>
          <Star size={13} /> {plan.grade ? 'Edit Review' : 'Review & Grade'}
        </button>
      )}>

      {plan.notes && (
        <pre style={{
          fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap', fontFamily: 'inherit',
          background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, lineHeight: 1.6,
        }}>{plan.notes}</pre>
      )}

      {plan.action_items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {plan.action_items.map((it, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              background: 'var(--bg)', borderRadius: 8,
              borderLeft: `3px solid ${PRIORITY[it.priority]?.dot || '#6b7280'}`,
              opacity: it.status === 'done' ? 0.6 : 1,
            }}>
              <input type="checkbox" checked={it.status === 'done'}
                disabled={!isOwner && !canReview}
                onChange={() => onToggle(plan, i)}
                style={{ cursor: (isOwner || canReview) ? 'pointer' : 'default', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, textDecoration: it.status === 'done' ? 'line-through' : 'none' }}>
                {it.title}
              </span>
              <PriorityBadge p={it.priority} />
              {it.due_date && <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>📅 {it.due_date}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Existing review remark */}
      {plan.review_comment && !showReview && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', marginBottom: 3 }}>
            REVIEW by {plan.reviewed_by_name || plan.reviewed_by}
            {plan.reviewed_at ? ` · ${String(plan.reviewed_at).slice(0, 16).replace('T', ' ')}` : ''}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{plan.review_comment}</p>
        </div>
      )}

      {/* Review form (State Head / Admin) */}
      {showReview && canReview && (
        <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>REVIEW & GRADE THIS PLAN</div>
          <textarea className="input" rows={3} placeholder="Review remarks — what was good, what to improve…"
            value={comment} onChange={e => setComment(e.target.value)}
            style={{ resize: 'vertical', width: '100%', fontSize: 13, marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>Grade:</span>
            {['A', 'B', 'C', 'D'].map(g => (
              <button key={g} type="button" onClick={() => setGrade(g)}
                style={{
                  width: 34, height: 34, borderRadius: '50%', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                  border: `2px solid ${grade === g ? GRADE_COLOR[g] : 'var(--border)'}`,
                  background: grade === g ? GRADE_COLOR[g] : 'transparent',
                  color: grade === g ? '#fff' : GRADE_COLOR[g],
                }} title={GRADE_DESC[g]}>
                {g}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button className="btn-ghost text-sm" onClick={() => setShowReview(false)} disabled={saving}>Cancel</button>
            <button className="btn-primary text-sm flex items-center gap-1.5" onClick={saveReview} disabled={saving}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Save Review
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function PlanEditor({ plan, saving, user, onCancel, onSave }) {
  const [notes, setNotes] = useState(plan.notes || '');
  const [items, setItems] = useState(plan.action_items?.length ? plan.action_items : [{ title: '', priority: 'medium', due_date: '', status: 'pending' }]);

  const setItem = (i, k, v) => setItems(its => its.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const addItem = () => setItems(its => [...its, { title: '', priority: 'medium', due_date: '', status: 'pending' }]);
  const removeItem = i => setItems(its => its.filter((_, idx) => idx !== i));

  const scope = [user?.branch, user?.state].filter(Boolean).join(', ');

  return (
    <SectionCard className="mb-4"
      title={<span className="flex items-center gap-2"><Edit2 size={14} /> Action Plan — Week of {plan.week_start}{scope ? ` · ${scope}` : ''}</span>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
            Coverage &amp; Operations Plan (stories, events, exclusives, staffing)
          </label>
          <textarea className="input" rows={10} value={notes} onChange={e => setNotes(e.target.value)}
            style={{ resize: 'vertical', width: '100%', fontSize: 13, lineHeight: 1.6 }} />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
              Weekly Targets / Action Items
            </label>
            <button type="button" onClick={addItem}
              style={{ fontSize: 11, color: 'var(--brand)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Plus size={12} /> Add Item
            </button>
          </div>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <input className="input" style={{ flex: 1, fontSize: 13 }} placeholder="Target / action item…"
                value={it.title} onChange={e => setItem(i, 'title', e.target.value)} />
              <select className="input" style={{ width: 100, fontSize: 12 }} value={it.priority}
                onChange={e => setItem(i, 'priority', e.target.value)}>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Med</option>
                <option value="low">🟢 Low</option>
              </select>
              <input className="input" type="date" style={{ width: 140, fontSize: 12 }}
                value={it.due_date} onChange={e => setItem(i, 'due_date', e.target.value)} />
              <button type="button" onClick={() => removeItem(i)} style={{ color: '#ef4444', cursor: 'pointer', flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn-primary flex items-center gap-1.5" disabled={saving}
            onClick={() => onSave({ ...plan, notes, action_items: items.filter(t => t.title.trim()) })}>
            {saving ? <><Loader2 size={13} className="animate-spin" /> Submitting…</> : <><CheckCircle2 size={13} /> Submit Plan</>}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Tasks() {
  const { user, state: globalState, branch: globalBranch } = useApp();
  const [searchParams] = useSearchParams();
  const [activeTab,    setActiveTab]    = useState(searchParams.get('tab') || 'tasks'); // tasks | groups | bank | report | review
  const [tasks,        setTasks]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [catFilter,    setCatFilter]    = useState('all');
  const [search,       setSearch]       = useState('');
  const [showCreate,   setShowCreate]   = useState(false);

  const canCreate = ['Admin', 'State Head'].includes(user?.role);
  const canEdit   = ['Admin', 'State Head'].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all' && statusFilter !== 'overdue') params.status = statusFilter;
      if (globalState  && globalState  !== 'All') params.state  = globalState;
      if (globalBranch && globalBranch !== 'All') params.branch = globalBranch;
      const r = await api.listTasks(params);
      setTasks(r.tasks || []);
    } catch { setTasks([]); }
    finally { setLoading(false); }
  }, [statusFilter, globalState, globalBranch]);

  useEffect(() => { if (activeTab === 'tasks') load(); }, [load, activeTab]);

  const isOverdue = t => t.due_date && ['pending', 'in_progress'].includes(t.status) &&
    new Date(String(t.due_date).slice(0, 10)) < new Date(new Date().toISOString().slice(0, 10));

  const counts = tasks.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});
  counts.overdue = tasks.filter(isOverdue).length;

  const visibleTasks = tasks.filter(t => {
    if (statusFilter === 'overdue' && !isOverdue(t)) return false;
    if (catFilter !== 'all' && t.category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.title?.toLowerCase().includes(q) &&
          !t.assigned_to_name?.toLowerCase().includes(q) &&
          !t.assigned_to_branch?.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const taskCats = ['all', ...Array.from(new Set(tasks.map(t => t.category).filter(Boolean))).sort()];

  const TABS = [
    { key: 'tasks',    label: 'Tasks',            Icon: ClipboardList },
    { key: 'groups',   label: 'Groups',            Icon: Users },
    { key: 'bank',     label: 'Task Bank',         Icon: Star },
    { key: 'report',   label: 'Report & Grading',  Icon: BarChart2 },
    { key: 'review',   label: 'Weekly Review',     Icon: Calendar },
    { key: 'events',   label: 'Major Events',       Icon: Newspaper },
  ];

  return (
    <div>
      <PageHeader title="Task Management" subtitle="Assign, track and grade newsroom tasks">
        {canCreate && activeTab === 'tasks' && (
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New Task
          </button>
        )}
      </PageHeader>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: 'none', background: 'transparent',
              color: activeTab === key ? 'var(--brand)' : 'var(--muted)',
              borderBottom: `2px solid ${activeTab === key ? 'var(--brand)' : 'transparent'}`,
              marginBottom: -1,
            }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <>
          {/* Status filter + search */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {[['all','All'], ['pending', 'Pending'], ['in_progress', 'In Progress'], ['overdue', '⚠️ Overdue'], ['completed', 'Completed'], ['cancelled', 'Cancelled']].map(([key, label]) => {
              const count = key === 'all' ? tasks.length : (counts[key] || 0);
              const isOd  = key === 'overdue';
              return (
                <button key={key} onClick={() => setStatusFilter(key)}
                  style={{
                    padding: '5px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${isOd && count > 0 && statusFilter !== key ? '#fecaca' : 'var(--border)'}`,
                    cursor: 'pointer',
                    background: statusFilter === key ? (isOd ? '#ef4444' : 'var(--brand)') : (isOd && count > 0 ? '#fef2f2' : 'var(--bg)'),
                    color:      statusFilter === key ? '#fff' : (isOd && count > 0 ? '#b91c1c' : 'var(--text)'),
                  }}>
                  {label}{count > 0 ? ` (${count})` : ''}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <input className="input" placeholder="🔍 Search task, person or branch…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200, fontSize: 13 }} />
            <select className="input" value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ fontSize: 13, maxWidth: 240 }}>
              {taskCats.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
            </select>
          </div>

          {/* KPI cards */}
          {tasks.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
              {['pending','in_progress','completed'].map(key => (
                <div key={key} className="card p-4" style={{ borderTop: `3px solid ${STATUS[key].color}` }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: STATUS[key].color }}>{counts[key] || 0}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{STATUS[key].label}</div>
                </div>
              ))}
              <div className="card p-4" style={{ borderTop: '3px solid #ef4444' }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#ef4444' }}>{counts.overdue || 0}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Overdue ⚠️</div>
              </div>
            </div>
          )}

          <SectionCard title={<span className="flex items-center gap-1.5"><ClipboardList size={14} /> Tasks{visibleTasks.length !== tasks.length ? ` (${visibleTasks.length} of ${tasks.length})` : ''}</span>}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>
            ) : visibleTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <ClipboardList size={36} style={{ color: 'var(--muted)', margin: '0 auto 12px' }} />
                <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                  {tasks.length === 0
                    ? (canCreate ? 'No tasks yet. Click "New Task" to create one.' : 'No tasks assigned to you.')
                    : 'No tasks match your filters.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {visibleTasks.map(t => <TaskCard key={t.id} task={t} canEdit={canEdit} onRefresh={load} />)}
              </div>
            )}
          </SectionCard>

          {showCreate && <CreateModal user={user} onClose={() => setShowCreate(false)} onDone={load} />}
        </>
      )}

      {activeTab === 'groups' && <GroupsTab canEdit={canCreate} />}
      {activeTab === 'bank'   && <TaskBankTab canEdit={canCreate} />}
      {activeTab === 'report' && <ReportTab />}
      {activeTab === 'review' && <WeeklyReviewTab />}
      {activeTab === 'events' && <EventPlanningTab />}
    </div>
  );
}
