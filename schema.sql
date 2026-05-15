-- ============================================================
--  KiddoPath Database Schema
-- ============================================================

-- ── EXTENSIONS ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- for gen_random_uuid()

-- Reusable category progression shape per kid
-- points: absolute points in that category (not spendable)
-- level/percentage: progression view used by analytics and UI
CREATE TYPE category_progress AS (
  points      INT,
  level       INT,
  percentage  INT
);

-- ============================================================
--  USERS & ACCOUNTS
-- ============================================================

CREATE TABLE users (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT          NOT NULL UNIQUE,
  password_hash   TEXT          NOT NULL,
  role            TEXT          NOT NULL DEFAULT 'parent' CHECK (role IN ('parent', 'admin')),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Kids table stores identity/profile data.
-- Progression/economy state is stored in kid_progress (1:1 by kid_id).

CREATE TABLE kids (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id             UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT          NOT NULL,
  username              TEXT          NOT NULL UNIQUE,
  email                 TEXT          UNIQUE,                 -- optional school email
  password_hash         TEXT,                                 -- if kid logs in themselves
  avatar_url            TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE kid_progress (
  kid_id                   UUID              PRIMARY KEY REFERENCES kids(id) ON DELETE CASCADE,

  -- Category progression (read-only progress, not spendable currency)
  health_progress          category_progress NOT NULL DEFAULT ROW(0, 1, 0)::category_progress,
  learning_progress        category_progress NOT NULL DEFAULT ROW(0, 1, 0)::category_progress,
  responsibility_progress  category_progress NOT NULL DEFAULT ROW(0, 1, 0)::category_progress,
  creativity_progress      category_progress NOT NULL DEFAULT ROW(0, 1, 0)::category_progress,
  CHECK (
    (health_progress).points >= 0
    AND (health_progress).level >= 1
    AND (health_progress).percentage BETWEEN 0 AND 100
  ),
  CHECK (
    (learning_progress).points >= 0
    AND (learning_progress).level >= 1
    AND (learning_progress).percentage BETWEEN 0 AND 100
  ),
  CHECK (
    (responsibility_progress).points >= 0
    AND (responsibility_progress).level >= 1
    AND (responsibility_progress).percentage BETWEEN 0 AND 100
  ),
  CHECK (
    (creativity_progress).points >= 0
    AND (creativity_progress).level >= 1
    AND (creativity_progress).percentage BETWEEN 0 AND 100
  ),

  -- Honesty (separate scoring system, goes up/down)
  honesty_score            INT               NOT NULL DEFAULT 100 CHECK (honesty_score >= 0),

  -- Spendable currency (primarily earned via XP conversion + bonuses)
  coins                    INT               NOT NULL DEFAULT 0 CHECK (coins >= 0),

  -- Overall progression (big picture across all stats)
  total_xp                 INT               NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  kid_level                INT               NOT NULL DEFAULT 1 CHECK (kid_level >= 1),
  xp_in_level              INT               NOT NULL DEFAULT 0 CHECK (xp_in_level >= 0),
  xp_to_next_level         INT               NOT NULL DEFAULT 100 CHECK (xp_to_next_level > 0),

  -- XP -> coin conversion progress (example: every 10 XP gives coins)
  xp_since_last_coin       INT               NOT NULL DEFAULT 0 CHECK (xp_since_last_coin >= 0),
  xp_per_coin_award        INT               NOT NULL DEFAULT 10 CHECK (xp_per_coin_award > 0),
  coins_per_award          INT               NOT NULL DEFAULT 1 CHECK (coins_per_award > 0),
  CHECK (xp_in_level <= xp_to_next_level),
  CHECK (xp_since_last_coin < xp_per_coin_award),

  updated_at               TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE INDEX idx_kids_parent ON kids(parent_id);

-- ============================================================
--  TASKS
-- ============================================================

CREATE TABLE tasks (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id          UUID          NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  created_by      UUID          NOT NULL REFERENCES users(id),   -- parent who made it
  title           TEXT          NOT NULL,
  description     TEXT,
  -- Category rewards are stored in task_category_rewards (supports multi-category tasks)
  xp_reward       INT           NOT NULL DEFAULT 10 CHECK (xp_reward >= 0),       -- always granted on confirmed completion
  ai_evaluated    BOOLEAN       NOT NULL DEFAULT FALSE,                            -- set true after AI classification
  ai_summary      TEXT,                                                            -- optional explanation of AI categorisation
  is_recurring    BOOLEAN       NOT NULL DEFAULT FALSE,
  recurrence      TEXT          CHECK (recurrence IN ('daily','weekly')),
  is_locked       BOOLEAN       NOT NULL DEFAULT FALSE,          -- parent-locked task
  due_date        DATE,
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CHECK (
    (is_recurring = TRUE AND recurrence IS NOT NULL)
    OR
    (is_recurring = FALSE AND recurrence IS NULL)
  )
);

CREATE INDEX idx_tasks_kid ON tasks(kid_id);

CREATE TABLE task_category_rewards (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID          NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  category        TEXT          NOT NULL CHECK (category IN ('health','learning','responsibility','creativity')),
  points_value    INT           NOT NULL CHECK (points_value > 0),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (task_id, category)
);

CREATE INDEX idx_task_category_rewards_task     ON task_category_rewards(task_id);
CREATE INDEX idx_task_category_rewards_category ON task_category_rewards(category);

CREATE TABLE task_completions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID          NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  kid_id          UUID          NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  status          TEXT          NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','confirmed','rejected')),
  completed_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ,
  reviewer_id     UUID          REFERENCES users(id),
  review_note     TEXT
);

CREATE INDEX idx_completions_kid    ON task_completions(kid_id);
CREATE INDEX idx_completions_task   ON task_completions(task_id);
CREATE INDEX idx_completions_status ON task_completions(status);

-- ============================================================
--  POINTS & HONESTY  (append-only ledgers)
-- ============================================================

CREATE TABLE points_log (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id          UUID          NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  category        TEXT          NOT NULL CHECK (category IN ('health','learning','responsibility','creativity')),
  delta           INT           NOT NULL,                        -- positive or negative
  source          TEXT          NOT NULL CHECK (source IN ('task','reward','admin','daily_quest')),
  source_id       UUID,                                          -- FK to task_completions etc.
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_points_log_kid ON points_log(kid_id);

CREATE TABLE honesty_log (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id            UUID          NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  completion_id     UUID          REFERENCES task_completions(id),
  delta             INT           NOT NULL,                      -- +5 confirmed, -10 rejected
  reason            TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_honesty_log_kid ON honesty_log(kid_id);

-- ============================================================
--  AVATAR & REWARDS
-- ============================================================

CREATE TABLE avatar_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT          NOT NULL,
  type            TEXT          NOT NULL CHECK (type IN ('hat','outfit','accessory','background')),
  image_url       TEXT,
  coin_cost       INT           NOT NULL DEFAULT 0 CHECK (coin_cost >= 0),
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE
);

CREATE TABLE kid_avatars (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id                UUID    NOT NULL UNIQUE REFERENCES kids(id) ON DELETE CASCADE,
  base_character        TEXT,
  unlocked_items        UUID[]  NOT NULL DEFAULT '{}',          -- array of avatar_items.id
  equipped_hat          UUID    REFERENCES avatar_items(id),
  equipped_outfit       UUID    REFERENCES avatar_items(id),
  equipped_accessory    UUID    REFERENCES avatar_items(id),
  equipped_background   UUID    REFERENCES avatar_items(id),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reward_purchases (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id          UUID          NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  item_id         UUID          NOT NULL REFERENCES avatar_items(id),
  coins_spent     INT           NOT NULL CHECK (coins_spent >= 0),
  purchased_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ============================================================
--  ENGAGEMENT      "will change when we design the analytics system"
-- ============================================================

CREATE TABLE daily_quests (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id            UUID    NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  title             TEXT    NOT NULL DEFAULT 'Complete tasks today!',
  tasks_required    INT     NOT NULL DEFAULT 3 CHECK (tasks_required >= 1),
  tasks_completed   INT     NOT NULL DEFAULT 0 CHECK (tasks_completed >= 0),
  bonus_coins       INT     NOT NULL DEFAULT 20 CHECK (bonus_coins >= 0),
  quest_date        DATE    NOT NULL DEFAULT CURRENT_DATE,
  is_completed      BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (kid_id, quest_date)
);

CREATE TABLE streaks (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id              UUID    NOT NULL REFERENCES kids(id) ON DELETE CASCADE,
  type                TEXT    NOT NULL CHECK (type IN ('task_completion')),
  current_streak      INT     NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  best_streak         INT     NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
  last_completed      DATE,
  UNIQUE (kid_id, type)
);

CREATE TABLE weekly_progress (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kid_id                UUID NOT NULL REFERENCES kids(id) ON DELETE CASCADE,

  week_start            DATE NOT NULL,
  week_end              DATE NOT NULL,

  tasks_completed       INT NOT NULL DEFAULT 0,
  xp_gained             INT NOT NULL DEFAULT 0,
  coins_earned          INT NOT NULL DEFAULT 0,

  health_points         INT NOT NULL DEFAULT 0,
  learning_points       INT NOT NULL DEFAULT 0,
  responsibility_points INT NOT NULL DEFAULT 0,
  creativity_points     INT NOT NULL DEFAULT 0,

  honesty_change        INT NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(kid_id, week_start)
);

-- ============================================================
--  NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id    UUID          NOT NULL,                        -- user.id or kid.id
  recipient_type  TEXT          NOT NULL CHECK (recipient_type IN ('parent','kid')),
  type            TEXT          NOT NULL CHECK (type IN (
                                  'task_submitted','task_confirmed','task_rejected',
                                  'level_up','streak','daily_quest_done')),
  message         TEXT          NOT NULL,
  is_read         BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read);

-- ============================================================
--  END
-- ============================================================