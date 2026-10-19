import type { Session, Stats } from './types';
import { HOURS_SAVED_PER_MATCH } from './match';

const KEY = 'dejavu.counters.v1';
type Counters = { recalls: number; matches: number };

const read = (): Counters => {
  try {
    return { recalls: 0, matches: 0, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { recalls: 0, matches: 0 };
  }
};

export function recordRecall(matched: boolean) {
  const c = read();
  c.recalls++;
  if (matched) c.matches++;
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

export function computeStats(sessions: Session[]): Stats {
  const c = read();
  const resolved = sessions.filter((s) => s.status === 'resolved').length;
  return {
    sessions: sessions.length,
    resolved,
    open: sessions.length - resolved,
    recalls: c.recalls,
    matches: c.matches,
    hoursSaved: +(c.matches * HOURS_SAVED_PER_MATCH).toFixed(1),
  };
}
