import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ── Users ──────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email"),
  username: text("username"),
  avatarUrl: text("avatar_url"),
  subscriptionTier: text("subscription_tier").default("free"),
  subscriptionEnds: integer("subscription_ends", { mode: "timestamp" }),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Memory Palaces ─────────────────────────────────────────────────
export const memoryPalaces = sqliteTable("memory_palaces", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().default(""),
  contentHash: text("content_hash"),
  description: text("description"),
  subject: text("subject"),
  lociCount: integer("loci_count").default(0),
  loci: text("loci", { mode: "json" }).$type<LocusData[]>().default([]),
  extras: text("extras", { mode: "json" }).$type<PalaceExtras>().default({}),
  spatialMap: text("spatial_map", { mode: "json" }).$type<SpatialMapEntry[]>().default([]),
  lociSymbols: text("loci_symbols", { mode: "json" }).$type<Record<string, LocusSymbol>>().default({}),
  imageUrl: text("image_url"),
  isPublic: integer("is_public", { mode: "boolean" }).default(false),
  tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// Note: UNIQUE(user_id, slug) index created by migration 0002 — not in Drizzle schema

// ── AI Jobs ────────────────────────────────────────────────────────
export const aiJobs = sqliteTable("ai_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  jobType: text("job_type").notNull(),
  status: text("status").notNull().default("queued"),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
  result: text("result", { mode: "json" }).$type<Record<string, unknown>>(),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Walkthroughs ───────────────────────────────────────────────────
export const walkthroughs = sqliteTable("walkthroughs", {
  id: text("id").primaryKey(),
  palaceId: text("palace_id")
    .notNull()
    .references(() => memoryPalaces.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  durationMs: integer("duration_ms").default(0),
  transcript: text("transcript", { mode: "json" }).$type<WalkthroughEvent[]>(),
  audioKey: text("audio_key"),
  recallScore: real("recall_score"),
  lociVisited: integer("loci_visited").default(0),
  lociCorrect: integer("loci_correct").default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export interface WalkthroughEvent {
  locusIndex: number;
  action: "visited" | "recalled" | "forgot" | "skipped";
  ts: number; // relative ms from start
}

// ── Chats ──────────────────────────────────────────────────────────
export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull().default("New Chat"),
  messages: text("messages", { mode: "json" }).$type<ChatMessage[]>().default([]),
  contextPalaceId: text("context_palace_id").references(() => memoryPalaces.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  ts: string;
}

// ── Concept Chains ─────────────────────────────────────────────────
export const conceptChains = sqliteTable("concept_chains", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  rootConcept: text("root_concept").notNull(),
  chainJson: text("chain_json", { mode: "json" }).$type<ConceptChainData>().default({}),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export interface ConceptChainData {
  nodes?: Array<{ id: string; label: string; level: number }>;
  edges?: Array<{ source: string; target: string; relation: string }>;
}

export interface LocusData {
  concept: string;
  description: string;
  mnemonic: string;
  position?: number;
}

export interface PalaceExtras {
  spatialMap?: SpatialMapNode[];
  symbolicObjects?: SymbolicObject[];
  abbreviationChain?: AbbreviationStep[];
}

export interface SpatialMapNode {
  id: string;
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

/** Per-locus spatial position within the palace layout */
export interface SpatialMapEntry {
  locusIndex: number;   // index into the loci array
  x: number;
  y: number;
  z?: number;           // z-index/layer
  roomId?: string;      // which room/zone
  rotation?: number;    // degrees
}

/** AI-generated symbolic object per locus */
export interface LocusSymbol {
  imageKey?: string;     // R2 key
  imageUrl?: string;     // public URL (computed at read time)
  prompt: string;
  style?: string;        // minimalist, chinese-ink, cyberpunk, photoreal
  generatedAt?: number;  // unix timestamp
  model?: string;        // which AI model
}

export interface SymbolicObject {
  concept: string;
  symbol: string;
  description?: string;
  imageKey?: string;       // R2 key (base64 stripped before D1 write)
  imageUrl?: string;        // Public URL (computed at read time)
  category?: string;
}

export interface AbbreviationStep {
  original: string;
  abbreviation: string;
  step: number;
  rule?: string;
}

// ── Mnemonic Stories ───────────────────────────────────────────────
export const mnemonicStories = sqliteTable("mnemonic_stories", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  palaceId: text("palace_id").references(() => memoryPalaces.id),
  title: text("title").notNull(),
  content: text("content"),
  subject: text("subject"),
  concepts: text("concepts", { mode: "json" }).$type<string[]>().default([]),
  narrativeStyle: text("narrative_style").default("default"),
  imageUrls: text("image_urls", { mode: "json" }).$type<string[]>().default([]),
  isPublic: integer("is_public", { mode: "boolean" }).default(false),
  tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Symbols ────────────────────────────────────────────────────────
export const symbols = sqliteTable("symbols", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  storyId: text("story_id").references(() => mnemonicStories.id),
  concept: text("concept").notNull(),
  symbol: text("symbol").notNull(),
  description: text("description"),
  category: text("category"),
  imageUrl: text("image_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Study Sessions ─────────────────────────────────────────────────
export const studySessions = sqliteTable("study_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  subject: text("subject").notNull(),
  topic: text("topic"),
  durationMinutes: integer("duration_minutes"),
  focusScore: integer("focus_score"),
  notes: text("notes"),
  mode: text("mode").default("focused"), // focused, pomodoro, deep
  completedAt: integer("completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Timetables ─────────────────────────────────────────────────────
export const timetables = sqliteTable("timetables", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  entries: text("entries", { mode: "json" }).$type<TimetableEntry[]>().default([]),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  optimizedAt: integer("optimized_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type TimetableEntry = {
  day: string;
  startTime: string;
  endTime: string;
  subject: string;
  topic: string;
  mode: string;
};

// ── Questions (Q-Bank) ────────────────────────────────────────────
export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  subject: text("subject").notNull(),
  topic: text("topic"),
  questionType: text("question_type").default("mcq"), // mcq, short_answer, essay, fill_blank
  difficulty: text("difficulty").default("medium"),
  questionText: text("question_text").notNull(),
  options: text("options", { mode: "json" }).$type<string[]>(),
  correctAnswer: text("correct_answer"),
  explanation: text("explanation"),
  source: text("source").default("manual"), // manual, ai-generated
  generationMode: text("generation_mode"), // standard, deep-wide, novelty
  tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
  isMistake: integer("is_mistake", { mode: "boolean" }).default(false),
  mistakeCount: integer("mistake_count").default(0),
  lastAnsweredAt: integer("last_answered_at", { mode: "timestamp" }),
  lastAnswerCorrect: integer("last_answer_correct", { mode: "boolean" }),
  // FSRS scheduling fields
  fsrsStability: real("fsrs_stability"),
  fsrsDifficulty: real("fsrs_difficulty"),
  fsrsState: integer("fsrs_state").default(0), // 0=New, 1=Learning, 2=Review, 3=Relearning
  fsrsDue: integer("fsrs_due", { mode: "timestamp" }),
  fsrsElapsedDays: integer("fsrs_elapsed_days").default(0),
  fsrsScheduledDays: integer("fsrs_scheduled_days").default(0),
  fsrsReps: integer("fsrs_reps").default(0),
  fsrsLapses: integer("fsrs_lapses").default(0),
  fsrsLastReview: integer("fsrs_last_review", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Payments ───────────────────────────────────────────────────────
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  stripeSessionId: text("stripe_session_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeInvoiceId: text("stripe_invoice_id"),
  amount: integer("amount"),
  currency: text("currency").default("hkd"),
  status: text("status").default("pending"), // pending, completed, failed, refunded
  tier: text("tier"), // free, bronze, silver, gold, diamond
  interval: text("interval"), // month, year
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Annotations (3-Pass) ──────────────────────────────────────────
export const annotations = sqliteTable("annotations", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  content: text("content"),
  sourceUrl: text("source_url"),
  subject: text("subject"),
  pass1Summary: text("pass1_summary"),
  pass2Analysis: text("pass2_analysis"),
  pass3Synthesis: text("pass3_synthesis"),
  keyTerms: text("key_terms", { mode: "json" }).$type<string[]>().default([]),
  questions: text("questions", { mode: "json" }).$type<string[]>().default([]),
  tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
  currentPass: integer("current_pass").default(1),
  isComplete: integer("is_complete", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Reading Vault (Chinese) ───────────────────────────────────────
export const readingVault = sqliteTable("reading_vault", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  originalText: text("original_text").notNull(),
  language: text("language").default("chinese"),
  difficultyLevel: integer("difficulty_level"), // 1-10 HSK level
  vocabulary: text("vocabulary", { mode: "json" }).$type<VocabularyItem[]>().default([]),
  grammarNotes: text("grammar_notes"),
  translation: text("translation"),
  analysis: text("analysis"),
  audioUrl: text("audio_url"),
  sourceUrl: text("source_url"),
  tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
  wordCount: integer("word_count"),
  readingTimeMinutes: integer("reading_time_minutes"),
  isAnalyzed: integer("is_analyzed", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type VocabularyItem = {
  word: string;
  pinyin: string;
  definition: string;
  partOfSpeech: string;
  hskLevel: number;
};

// ── Recall Sessions ───────────────────────────────────────────────
export const recallSessions = sqliteTable("recall_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  mode: text("mode").notNull(), // free_recall, cued_recall, feynman
  subject: text("subject"),
  recallContent: text("recall_content"),
  correctContent: text("correct_content"),
  grade: real("grade"), // 0-10
  feedback: text("feedback"),
  conceptsHit: text("concepts_hit", { mode: "json" }).$type<string[]>().default([]),
  conceptsMissed: text("concepts_missed", { mode: "json" }).$type<string[]>().default([]),
  durationSeconds: integer("duration_seconds"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Technocratic Audits ───────────────────────────────────────────
export const technocraticAudits = sqliteTable("technocratic_audits", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  auditType: text("audit_type").notNull(), // study_efficiency, memory_retention, time_allocation
  periodStart: integer("period_start", { mode: "timestamp" }),
  periodEnd: integer("period_end", { mode: "timestamp" }),
  metrics: text("metrics", { mode: "json" }).$type<Record<string, number>>().default({}),
  findings: text("findings"),
  recommendations: text("recommendations"),
  score: real("score"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ── Methods ───────────────────────────────────────────────────────
export const methods = sqliteTable("methods", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"), // memorization, recall, focus, reading
  steps: text("steps", { mode: "json" }).$type<string[]>().default([]),
  effectiveness: real("effectiveness"), // user-rated 0-10
  usageCount: integer("usage_count").default(0),
  isCustom: integer("is_custom", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ════════════════════════════════════════════════════════════════
// Typed Table Registry — NEVER bracket-access db.schema
// ════════════════════════════════════════════════════════════════
/** All Drizzle table definitions keyed by stable name.
 *  Use this for dynamic table lookups instead of bracket-access on db.schema.
 *  Bracket access on module namespaces breaks Drizzle's .where() callbacks. */
export const TABLES = {
  users,
  memoryPalaces,
  mnemonicStories,
  symbols,
  studySessions,
  timetables,
  questions,
  payments,
  annotations,
  readingVault,
  recallSessions,
  technocraticAudits,
  methods,
  aiJobs,
  walkthroughs,
  chats,
  conceptChains,
} as const;

export type TableName = keyof typeof TABLES;

/** Safe table lookup — throws at call site if name is invalid */
export function getTable(name: TableName): typeof TABLES[TableName] {
  const t = TABLES[name];
  if (!t) throw new Error(`unknown_table:${name}`);
  return t;
}
