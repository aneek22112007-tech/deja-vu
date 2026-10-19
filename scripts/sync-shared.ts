// Copies the isomorphic logic the edge functions need from src/lib -> supabase/functions/_shared.
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
export const SHARED = ['redact.ts', 'structure.ts', 'types.ts'];
for (const f of SHARED) {
  copyFileSync(resolve(root, 'src/lib', f), resolve(root, 'supabase/functions/_shared', f));
  console.log('synced', f);
}
