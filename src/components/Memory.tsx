import { useMemo, useState } from 'react';
import { Check, ChevronDown, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import type { Backend } from '../lib/backend';
import type { Hypothesis, Session } from '../lib/types';
import { SessionFields, StatusBadge, timeAgo } from './ui';

function Editor({ s, onSave, onCancel }: { s: Session; onSave: (p: Partial<Session>) => void; onCancel: () => void }) {
  const [symptom, setSymptom] = useState(s.symptom);
  const [hyp, setHyp] = useState(s.hypotheses_tried.map((h) => (h.ruled_out ? '✗ ' : '') + h.text).join('\n'));
  const [cause, setCause] = useState(s.root_cause);
  const [fix, setFix] = useState(s.fix);
  const [tags, setTags] = useState(s.tags.join(', '));
  const parseHyp = (): Hypothesis[] =>
    hyp.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => (l.startsWith('✗') ? { text: l.slice(1).trim(), ruled_out: true } : { text: l, ruled_out: null }));
  return (
    <div className="space-y-3">
      <label className="block"><span className="label">symptom</span><input className="field mt-1" value={symptom} onChange={(e) => setSymptom(e.target.value)} /></label>
      <label className="block"><span className="label">hypotheses tried (one per line, prefix ✗ if ruled out)</span><textarea rows={3} className="field mt-1 font-mono text-sm" value={hyp} onChange={(e) => setHyp(e.target.value)} /></label>
      <label className="block"><span className="label">root cause</span><input data-testid="edit-cause" className="field mt-1" value={cause} onChange={(e) => setCause(e.target.value)} /></label>
      <label className="block"><span className="label">fix</span><input data-testid="edit-fix" className="field mt-1" value={fix} onChange={(e) => setFix(e.target.value)} /></label>
      <label className="block"><span className="label">tags (comma separated)</span><input className="field mt-1 font-mono text-sm" value={tags} onChange={(e) => setTags(e.target.value)} /></label>
      <div className="flex gap-2">
        <button
          data-testid="edit-save"
          className="btn-primary"
          onClick={() =>
            onSave({
              symptom, root_cause: cause, fix,
              hypotheses_tried: parseHyp(),
              tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
              status: fix.trim() ? 'resolved' : s.status,
            })
          }
        >
          <Check className="h-4 w-4" /> Save
        </button>
        <button className="btn-ghost" onClick={onCancel}><X className="h-4 w-4" /> Cancel</button>
      </div>
    </div>
  );
}

export function Memory({ backend, sessions, reload }: { backend: Backend; sessions: Session[]; reload: () => void }) {
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const list = useMemo(() => {
    const needle = q.toLowerCase();
    return sessions.filter(
      (s) =>
        (filter === 'all' || s.status === filter) &&
        (!needle || [s.symptom, s.root_cause, s.fix, s.tags.join(' ')].join(' ').toLowerCase().includes(needle)),
    );
  }, [sessions, filter, q]);

  const act = async (fn: () => Promise<unknown>) => {
    await fn();
    reload();
  };

  return (
    <div className="space-y-4">
      <div className="panel flex flex-wrap items-center gap-3 p-4">
        <input className="field max-w-xs py-2 text-sm" placeholder="filter memory…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex rounded-lg border border-ink-600 p-0.5">
          {(['all', 'open', 'resolved'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-3 py-1 text-xs font-medium ${filter === f ? 'bg-ink-700 text-white' : 'text-slate-400 hover:text-white'}`}>
              {f} {f === 'all' ? sessions.length : sessions.filter((s) => s.status === f).length}
            </button>
          ))}
        </div>
        {backend.reset && (
          <button className="btn-ghost ml-auto text-xs" onClick={() => confirm('Reset local memory to the sample data?') && act(() => backend.reset!())}>
            <RotateCcw className="h-3.5 w-3.5" /> reset demo data
          </button>
        )}
      </div>

      <ol className="relative space-y-3 border-l border-ink-700 pl-6">
        {list.map((s) => {
          const isOpen = open === s.id;
          return (
            <li key={s.id} className="relative" data-testid="memory-item">
              <span className={`absolute -left-[31px] top-5 h-2.5 w-2.5 rounded-full ring-4 ring-ink-950 ${s.status === 'resolved' ? 'bg-ok' : 'bg-warn'}`} />
              <div className="panel p-4">
                <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(isOpen ? null : s.id)}>
                  <span className="font-mono text-xs text-slate-500 w-16 shrink-0">{timeAgo(s.created_at)}</span>
                  <span className="flex-1 font-medium text-slate-100">{s.symptom}</span>
                  {s.sample && <span className="tag">sample</span>}
                  <StatusBadge s={s.status} />
                  <ChevronDown className={`h-4 w-4 text-slate-500 transition ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="mt-4 animate-fadeUp border-t border-ink-700 pt-4">
                    {editing === s.id ? (
                      <Editor s={s} onCancel={() => setEditing(null)} onSave={(p) => act(async () => { await backend.update(s.id, p); setEditing(null); })} />
                    ) : (
                      <>
                        <SessionFields s={s} />
                        <details className="mt-3 text-xs text-slate-500">
                          <summary className="cursor-pointer select-none">raw transcript (redacted)</summary>
                          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-ink-950 p-3 font-mono text-slate-400">{s.raw_transcript_redacted}</p>
                        </details>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button className="btn-ghost" data-testid="edit-btn" onClick={() => setEditing(s.id)}><Pencil className="h-4 w-4" /> {s.status === 'open' ? 'Resolve / edit' : 'Edit'}</button>
                          <button className="btn-ghost" onClick={() => act(() => backend.update(s.id, { status: s.status === 'open' ? 'resolved' : 'open' }))}>
                            <Check className="h-4 w-4" /> Mark {s.status === 'open' ? 'resolved' : 'open'}
                          </button>
                          <button className="btn-danger ml-auto" onClick={() => confirm('Delete this session forever?') && act(() => backend.remove(s.id))}><Trash2 className="h-4 w-4" /> Delete</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {!list.length && <li className="text-sm text-slate-500">Nothing here yet.</li>}
      </ol>
    </div>
  );
}
