---
name: Gamification core loop
overview: Build the gamification-service core loop (stats XP%, stat levels, overall XP, main level, coins) as a single Django app, fed by a push from task-service whenever a task completion becomes confirmed.
todos:
  - id: app
    content: Create gamification Django app (models KidProfile/KidStat/CompletionEvent), register in INSTALLED_APPS, add XP constants to settings
    status: pending
  - id: urls
    content: Fix core/urls.py mount to api/gamification/ (health, schema, docs, app urls) to match nginx
    status: pending
  - id: engine
    content: Implement transactional, idempotent apply_completion engine (stat xp% -> stat level -> overall xp -> main level -> coins)
    status: pending
  - id: ingest
    content: Add internal ingest endpoint with X-Internal-Token / IsInternalService permission
    status: pending
  - id: reads
    content: Add kid stats/profile read endpoints and parent kid-stats endpoint
    status: pending
  - id: push
    content: "task-service: add push_completion_confirmed and call it from both confirm paths; add requests dependency"
    status: pending
  - id: config
    content: Wire INTERNAL_SERVICE_TOKEN and GAMIFICATION_INTERNAL_URL into .env.example and docker-compose
    status: pending
  - id: migrate
    content: Generate and apply gamification migrations
    status: pending
isProject: false
---

# Gamification Service - Core Loop

## Goal

When a kid's task completion becomes `confirmed` in task-service, push an event to gamification-service. Gamification converts category points into per-stat XP%, handles stat level-ups, grants overall XP -> main level -> coins.

## Domain model (core scope only)

Categories mirror task-service `CATEGORY_CHOICES`: `health`, `learning`, `responsibility`, `creativity`.

- `KidProfile` (one row per kid): `kid_id` (UUID, unique), `main_level`, `overall_xp`, `coins`, `created_at`, `updated_at`.
- `KidStat` (one row per kid+category): `kid_id`, `category`, `level`, `xp_percent` (0-100), unique `(kid_id, category)`.
- `CompletionEvent` (idempotency ledger): `completion_id` (UUID, unique), `kid_id`, `payload`, `processed_at`. Guarantees a completion is never counted twice.

No FKs to other services - `kid_id` stored as plain `UUIDField(db_index=True)`, matching `[task-service/tasks/models.py](services/task-service/tasks/models.py)`.

## Tunable constants (in `core/settings.py`)

- `STAT_XP_PER_LEVEL = 100` (points to fill a stat 0 -> 100%).
- `OVERALL_XP_PER_STAT_LEVEL = 50` (overall XP granted per stat level completed).
- `MAIN_XP_PER_LEVEL = 200` (overall XP to gain a main level).
- `COINS_PER_MAIN_LEVEL = 25` (coins granted per main level gained).

## Plan

- 1. New Django app `gamification`
  - Create `services/gamification-service/gamification/` (models, serializers, views, urls, admin, apps, migrations).
- Register `'gamification'` in `INSTALLED_APPS` in `[core/settings.py](services/gamification-service/core/settings.py)`.
- Add the 4 constants above to settings.

### 2. Fix URL mount to match nginx

nginx proxies `/api/gamification/` unstripped (`[nginx.conf](security/nginx/nginx.conf)` line 49), but `[core/urls.py](services/gamification-service/core/urls.py)` currently mounts `api/`. Change to mirror task-service:

```python
urlpatterns = [
    path('api/gamification/schema/', SpectacularAPIView.as_view(), name='gamification-schema'),
    path('api/gamification/docs/', SpectacularSwaggerView.as_view(url_name='gamification-schema')),
    path('api/gamification/', include('common.urls')),       # health
    path('api/gamification/', include('gamification.urls')),
]
```

### 3. XP engine (`gamification/engine.py`)

Single transactional function `apply_completion(kid_id, completion_id, category_points)`:

- If `CompletionEvent(completion_id)` exists -> return early (idempotent).
- For each `(category, points)`: add to `KidStat.xp_percent`; while `>= STAT_XP_PER_LEVEL`, subtract threshold, `level += 1`, accumulate `OVERALL_XP_PER_STAT_LEVEL` (loop handles multiple level-ups; percentage resets per spec).
- Add accumulated overall XP to `KidProfile.overall_xp`; while `>= MAIN_XP_PER_LEVEL`, subtract, `main_level += 1`, `coins += COINS_PER_MAIN_LEVEL`.
- Create `CompletionEvent` row. Wrap in `transaction.atomic()` + `select_for_update()`.

### 4. Internal ingest endpoint (push target)

- `POST /api/gamification/internal/completions/` -> `apply_completion`.
- Auth: shared-secret header `X-Internal-Token` (env `INTERNAL_SERVICE_TOKEN`), validated by a small `IsInternalService` permission in `[common/permissions.py](services/gamification-service/common/permissions.py)` (not a user JWT).
- Body: `{ "completion_id": uuid, "kid_id": uuid, "category_points": [{"category": "health", "points": 10}, ...] }`.

### 5. Read endpoints

- `GET /api/gamification/stats/` (`IsKid`) - the kid's own stats list.
- `GET /api/gamification/profile/` (`IsKid`) - main_level, overall_xp, coins.
- `GET /api/gamification/kids/<uuid:kid_id>/stats/` (`IsParent`) - guard with `kid_id in request.user.kid_ids`.
Uses `KidActor`/`ParentActor` already wired in `[common/authentication.py](services/gamification-service/common/authentication.py)`.

### 6. task-service: push on confirm

Add `services/task-service/tasks/notifications.py` with `push_completion_confirmed(completion)`:

- Build `category_points` from `completion.task.category_rewards` (`category`, `points_value`).
- `POST` to `settings.GAMIFICATION_INTERNAL_URL + '/api/gamification/internal/completions/'` with `X-Internal-Token`, short timeout, best-effort (log on failure; idempotent ingest allows later replay).
Call it from both confirm paths in `[tasks/views.py](services/task-service/tasks/views.py)`:
- `TaskCompletionReviewView.post` when status set to `confirmed` (line ~173).
- The create/auto-confirm path in `tasks/serializers.py` `_resolve_status` returning `CONFIRMED`.
Add `requests` to `[task-service/requirements.txt](services/task-service/requirements.txt)`.

### 7. Config wiring

- `[.env.example](.env.example)`: add `INTERNAL_SERVICE_TOKEN`, `GAMIFICATION_INTERNAL_URL=http://gamification-service:8000`.
- `[docker-compose.yml](docker-compose.yml)`: pass `INTERNAL_SERVICE_TOKEN` to both services; pass `GAMIFICATION_INTERNAL_URL` to task-service; add `gamification-service` to nginx `depends_on`.

### 8. Migrations

- `python manage.py makemigrations gamification` then `migrate` (DB `gamification_db` already configured).

## Deferred (per scope decision)

`streaks`, `honesty`, `quests`, and the catalog/coins-spending side stay out of this plan.