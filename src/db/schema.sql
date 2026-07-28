-- M1. Reference DDL for the CURRENT schema (v4) — the cumulative effect of every
-- migration in src/db/migrations/. Normative prose: docs/SCHEMA.md.
--
-- This file is NOT executed by the app or by tests; it exists for human review only.
-- The migrations themselves (src/db/migrations/001_initial.ts,
-- src/db/migrations/002_offday_whole_day_unique.ts,
-- src/db/migrations/003_snoozable_and_one_hop_check.ts,
-- src/db/migrations/004_assistant_voice_language.ts) are canonical. Keep this file in
-- sync when a migration is added.

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  theme TEXT NOT NULL CHECK (theme IN ('light','dark','auto')) DEFAULT 'auto',
  accent TEXT NOT NULL CHECK (accent IN ('forge-orange','indigo','berry','plum')) DEFAULT 'forge-orange',
  onboarding_completed_at TEXT,
  tenure_anchor_date TEXT NOT NULL,
  cycle_cadence TEXT NOT NULL CHECK (cycle_cadence IN ('weekly','monthly')) DEFAULT 'monthly',
  notif_master INTEGER NOT NULL DEFAULT 0 CHECK (notif_master IN (0,1)),
  notif_routine_due INTEGER NOT NULL DEFAULT 0 CHECK (notif_routine_due IN (0,1)),
  notif_event_starting INTEGER NOT NULL DEFAULT 0 CHECK (notif_event_starting IN (0,1)),
  notif_course_dose INTEGER NOT NULL DEFAULT 0 CHECK (notif_course_dose IN (0,1)),
  notif_course_ending_soon INTEGER NOT NULL DEFAULT 0 CHECK (notif_course_ending_soon IN (0,1)),
  notif_gentle_reentry INTEGER NOT NULL DEFAULT 0 CHECK (notif_gentle_reentry IN (0,1)),
  notif_milestone_reached INTEGER NOT NULL DEFAULT 0 CHECK (notif_milestone_reached IN (0,1)),
  notif_daily_digest INTEGER NOT NULL DEFAULT 0 CHECK (notif_daily_digest IN (0,1)),
  notif_digest_time TEXT NOT NULL DEFAULT '08:00',
  assistant_language TEXT NOT NULL DEFAULT 'en-US',   -- migration 4 (architect CR-6), F16/S36
  assistant_voice TEXT NOT NULL DEFAULT 'warm',       -- migration 4 (architect CR-6), F16/S36
  sync_enabled INTEGER NOT NULL DEFAULT 0 CHECK (sync_enabled IN (0,1)),
  sync_last_synced_at TEXT,
  sync_last_error TEXT,
  last_backup_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE task (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('routine','event','course','todo')),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  note TEXT,
  icon TEXT NOT NULL DEFAULT 'Repeat',
  color TEXT NOT NULL CHECK (color IN ('forge-orange','indigo','berry','plum')) DEFAULT 'forge-orange',
  is_as_needed INTEGER NOT NULL DEFAULT 0 CHECK (is_as_needed IN (0,1)),
  cadence_kind TEXT CHECK (cadence_kind IN ('daily','specific-weekdays','weekly','bi-weekly','monthly','bi-monthly','yearly')),
  cadence_weekdays TEXT,
  cadence_weekday INTEGER,
  cadence_day_of_month INTEGER CHECK (cadence_day_of_month IS NULL OR (cadence_day_of_month BETWEEN 1 AND 31)),
  cadence_month INTEGER CHECK (cadence_month IS NULL OR (cadence_month BETWEEN 1 AND 12)),
  cadence_anchor_date TEXT,
  event_date TEXT,
  time_of_day TEXT,
  start_date TEXT,
  end_date TEXT,
  doses_per_day INTEGER NOT NULL DEFAULT 1 CHECK (doses_per_day >= 1),
  is_tracked INTEGER NOT NULL DEFAULT 0 CHECK (is_tracked IN (0,1)),
  importance TEXT CHECK (importance IN ('high','med','low')),
  necessity TEXT CHECK (necessity IN ('must-do','recommended','optional')),
  todo_done_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  -- migration 3 (CR-4): PRD §3.7 per-task snooze gate, default on.
  snoozable INTEGER NOT NULL DEFAULT 1 CHECK (snoozable IN (0,1)),
  CHECK (is_as_needed = 0 OR type = 'routine')
);
CREATE INDEX idx_task_type_deleted ON task(type, deleted_at);
CREATE INDEX idx_task_as_needed ON task(is_as_needed);

CREATE TABLE step (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('ideal','fallback')),
  text TEXT NOT NULL,
  position INTEGER NOT NULL,
  due_weekdays TEXT
);
CREATE INDEX idx_step_task ON step(task_id, role, position);

CREATE TABLE day_log (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  chip_state TEXT CHECK (chip_state IN ('todo','done','fallback','skip')),
  is_manual_override INTEGER NOT NULL DEFAULT 0 CHECK (is_manual_override IN (0,1)),
  completed_step_ids TEXT NOT NULL DEFAULT '[]',
  doses_completed INTEGER NOT NULL DEFAULT 0,
  -- migration 3 (CR-4): one-hop snooze only — SCHEMA §4.2. Table-rebuilt to add this;
  -- SQLite has no ALTER TABLE ADD CONSTRAINT.
  moved_to_date TEXT CHECK (moved_to_date IS NULL OR moved_to_date = date(date, '+1 day')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (task_id, date)
);
CREATE INDEX idx_log_date ON day_log(date);
CREATE INDEX idx_log_task_date ON day_log(task_id, date);

CREATE TABLE off_day_mark (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  task_id TEXT REFERENCES task(id) ON DELETE CASCADE,
  prior_chip_state TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (date, task_id)
);
-- migration 2: at most one whole-day row (task_id IS NULL) per date.
CREATE UNIQUE INDEX idx_offday_whole_day ON off_day_mark(date) WHERE task_id IS NULL;

CREATE TABLE as_needed_use (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  marker TEXT CHECK (marker IN ('ideal','fallback')),
  created_at TEXT NOT NULL
);

CREATE TABLE xp_award (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES task(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('ideal','fallback')),
  amount INTEGER NOT NULL,
  cycle_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (task_id, date)
);

CREATE TABLE achievement_unlock (
  key TEXT PRIMARY KEY,
  unlocked_on TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE cycle_record (
  id TEXT PRIMARY KEY,
  cadence TEXT NOT NULL CHECK (cadence IN ('weekly','monthly')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  consistency_percent INTEGER,
  breakdown_ideal REAL NOT NULL,
  breakdown_fallback REAL NOT NULL,
  breakdown_off INTEGER NOT NULL,
  breakdown_missed INTEGER NOT NULL,
  cycling_xp_final INTEGER NOT NULL,
  badge_keys_unlocked TEXT NOT NULL DEFAULT '[]',
  is_short_cycle INTEGER NOT NULL DEFAULT 0 CHECK (is_short_cycle IN (0,1)),
  finalized_at TEXT NOT NULL
);

CREATE TABLE cycle_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current_cycle_id TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('weekly','monthly')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL
);

CREATE TABLE entitlement (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  source TEXT NOT NULL CHECK (source IN ('none','subscription','byo-key')) DEFAULT 'none',
  plan TEXT CHECK (plan IN ('monthly','annual')),
  status TEXT NOT NULL CHECK (status IN ('none','trial','active','expired')) DEFAULT 'none',
  renews_on TEXT,
  trial_ends_on TEXT,
  has_byo_key INTEGER NOT NULL DEFAULT 0 CHECK (has_byo_key IN (0,1)),
  byo_supports_transcription INTEGER NOT NULL DEFAULT 0 CHECK (byo_supports_transcription IN (0,1)),
  updated_at TEXT NOT NULL
);

CREATE TABLE assistant_conversation (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  modality TEXT NOT NULL CHECK (modality IN ('voice','text','voice+text')),
  summary TEXT NOT NULL DEFAULT '',
  task_ids_touched TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE assistant_message (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES assistant_conversation(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  text TEXT NOT NULL,
  tool_calls TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE widget_config (
  size TEXT PRIMARY KEY CHECK (size IN ('small-today','small-one-task','medium-up-next')),
  mode TEXT NOT NULL CHECK (mode IN ('fixed-task','smart-next-due')),
  fixed_task_id TEXT REFERENCES task(id) ON DELETE SET NULL
);
