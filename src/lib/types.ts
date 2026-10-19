export type SessionStatus = 'resolved' | 'open';

export interface Hypothesis {
  text: string;
  /** true = ruled out / didn't work, false = was actually the cause, null = unknown */
  ruled_out: boolean | null;
}

export interface StructuredNote {
  symptom: string;
  hypotheses_tried: Hypothesis[];
  root_cause: string;
  fix: string;
  tags: string[];
}

export interface Session extends StructuredNote {
  id: string;
  raw_transcript_redacted: string;
  status: SessionStatus;
  created_at: string; // ISO
  updated_at?: string;
  sample?: boolean; // true = shipped sample data, not the user's real incident
  embedding?: number[];
}

export interface RedactionFinding {
  type: string;
  count: number;
}

export interface CaptureResult {
  session: Session;
  redactions: RedactionFinding[];
  structuredBy: 'groq' | 'local-heuristic';
}

export interface RecallMatch {
  session: Session;
  similarity: number; // 0..1 cosine
}

export type Confidence = 'high' | 'medium' | 'low' | 'none';

export interface RecallResult {
  query: string;
  matches: RecallMatch[];
  matched: boolean;
  confidence: Confidence;
  explanation: string;
  hitCount: number;
  likelyCause?: string;
  fixThatWorked?: string;
  threshold: number;
  explainedBy: 'groq' | 'local';
  engine?: string;
}

export interface Stats {
  sessions: number;
  resolved: number;
  open: number;
  recalls: number;
  matches: number;
  hoursSaved: number;
}
