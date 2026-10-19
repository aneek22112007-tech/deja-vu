/**
 * Secret-redaction pass. Runs BEFORE anything is structured, embedded or stored.
 *
 * NOTE: supabase/functions/_shared/redact.ts is a byte-for-byte copy of this file
 * (Deno edge functions can't import from src/). Run `npm run sync-shared` after editing;
 * a unit test fails if the two drift apart.
 */

export interface RedactionFinding {
  type: string;
  count: number;
}

export interface RedactionResult {
  text: string;
  findings: RedactionFinding[];
}

type Rule = {
  type: string;
  re: RegExp;
  replace: string | ((substring: string, ...args: string[]) => string);
};

const isValidIPv4 = (ip: string) => ip.split('.').every((o) => Number(o) >= 0 && Number(o) <= 255 && String(Number(o)) === o);

// Order matters: most specific first.
const RULES: Rule[] = [
  {
    type: 'private_key',
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replace: '[REDACTED_PRIVATE_KEY]',
  },
  {
    type: 'connection_string',
    // scheme://user:password@host  -> keep scheme + host, drop credentials
    re: /\b((?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqps?|mssql|sqlserver|ftp|sftp|https?):\/\/)[^\s:@/]+:[^\s@/]+@/gi,
    replace: (_m, scheme) => `${scheme}[REDACTED_CREDENTIALS]@`,
  },
  { type: 'jwt', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, replace: '[REDACTED_JWT]' },
  { type: 'aws_access_key', re: /\b(?:AKIA|ASIA|AGPA|AIDA|AROA|ANPA)[0-9A-Z]{16}\b/g, replace: '[REDACTED_AWS_KEY]' },
  {
    type: 'aws_secret_key',
    re: /\b(aws_?secret_?access_?key|aws_?secret)(\s*[:=]\s*|\s+is\s+)["']?[A-Za-z0-9/+=]{30,}["']?/gi,
    replace: (_m, k, sep) => `${k}${sep}[REDACTED_AWS_SECRET]`,
  },
  { type: 'github_token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g, replace: '[REDACTED_GITHUB_TOKEN]' },
  { type: 'slack_token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, replace: '[REDACTED_SLACK_TOKEN]' },
  { type: 'groq_key', re: /\bgsk_[A-Za-z0-9]{20,}\b/g, replace: '[REDACTED_API_KEY]' },
  { type: 'openai_key', re: /\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{20,}\b/g, replace: '[REDACTED_API_KEY]' },
  { type: 'stripe_key', re: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g, replace: '[REDACTED_API_KEY]' },
  { type: 'google_api_key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g, replace: '[REDACTED_API_KEY]' },
  { type: 'bearer_token', re: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]{12,}=*/g, replace: (_m, kind) => `${kind} [REDACTED_TOKEN]` },
  {
    type: 'credential_assignment',
    // password=..., api_key: "...", DB_PASSWORD=..., token=...
    re: /\b([A-Za-z_]*(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|client[_-]?secret|auth)[A-Za-z_]*)(\s*[:=]\s*)(["']?)(?!Bearer\b|Basic\b|\[REDACTED)([^\s"',;]{3,})\3/gi,
    replace: (_m, k, sep, q) => `${k}${sep}${q}[REDACTED]${q}`,
  },
  {
    type: 'spoken_secret',
    // voice-style: "the password is hunter2", "token was abc123..."
    re: /\b(password|passcode|passphrase|secret|token|api key|key)\s+(is|was|=)\s+["']?(?!\[REDACTED)([^\s"',;.]{4,})/gi,
    replace: (_m, k, v) => `${k} ${v} [REDACTED]`,
  },
  { type: 'email', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replace: '[REDACTED_EMAIL]' },
  {
    type: 'ipv4',
    re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replace: (m) => (isValidIPv4(m) ? '[REDACTED_IP]' : m),
  },
  {
    type: 'ipv6',
    re: /\b(?:[0-9a-fA-F]{1,4}:){4,7}[0-9a-fA-F]{1,4}\b/g,
    replace: '[REDACTED_IP]',
  },
  {
    type: 'high_entropy_string',
    // long mixed-case+digit blobs (generic API keys). Lowercase hex such as git SHAs is NOT matched.
    re: /\b(?=[A-Za-z0-9+/_-]*[A-Z])(?=[A-Za-z0-9+/_-]*[a-z])(?=[A-Za-z0-9+/_-]*\d)[A-Za-z0-9+/_-]{32,}\b/g,
    replace: '[REDACTED_SECRET]',
  },
];

export function redact(input: string): RedactionResult {
  let text = input ?? '';
  const findings: RedactionFinding[] = [];
  for (const rule of RULES) {
    let count = 0;
    text = text.replace(rule.re, (...args: unknown[]) => {
      const match = args[0] as string;
      const out =
        typeof rule.replace === 'string'
          ? rule.replace
          : (rule.replace as (...a: unknown[]) => string)(...args);
      if (out !== match) count++;
      return out;
    });
    if (count > 0) findings.push({ type: rule.type, count });
  }
  return { text, findings };
}

export function totalRedactions(findings: RedactionFinding[]): number {
  return findings.reduce((n, f) => n + f.count, 0);
}
