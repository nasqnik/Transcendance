# Task Service API

All paths are prefixed with `/api/task/`. Auth via `Authorization: Bearer <JWT>`.
Interactive docs: `/api/task/docs/`.

Roles: **kid** and **parent** (decided by the JWT). A parent's token carries `kid_ids` (the kids they guard).

## Tasks

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/tasks/` | kid | List the kid's own active tasks. |
| POST | `/tasks/` | kid | Create a task. AI scores each category, writes a summary, and sets `xp_reward` = sum of points. |
| GET | `/tasks/{task_id}/` | kid | Get one of the kid's own tasks. |

**POST `/tasks/` body**

```json
{ "title": "Read a book", "description": "Read 20 pages", "due_date": null }
```

Response (and GET) include `id`, `xp_reward`, `ai_summary`, `ai_evaluated`, `category_rewards` (per-category points), and `review_mode`.

**`review_mode`** tells the UI how completing this task behaves:

| `review_mode` | Meaning | UI |
| --- | --- | --- |
| `always` | all shown categories -> completion will be pending | submit, no toggle |
| `never` | no shown categories -> auto-confirmed | submit, no toggle |
| `optional` | mixed -> kid decides | show a "send to parent?" toggle -> sets `send_for_review` |

Only send `send_for_review` when `review_mode === "optional"`; it is ignored otherwise.

## Completions

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/completions/` | kid / parent | Kid lists own; parent lists completions for their guarded kids. |
| POST | `/completions/` | kid | Submit a task as completed. |
| POST | `/completions/{completion_id}/review/` | parent | Confirm or reject a completion. 404 if not a guarded kid's. |

**POST `/completions/` body**

```json
{ "task": "<task_id>", "send_for_review": false }
```

Resulting `status` depends on the kid's category visibility:
- all the task's categories shown to parent -> `pending`
- none shown -> `confirmed` (auto)
- mixed -> `pending` if `send_for_review` is true, else `confirmed`

**POST `/completions/{id}/review/` body**

```json
{ "status": "confirmed", "review_note": "Great job!" }
```

`status` must be `confirmed` or `rejected`.

## Settings

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | `/settings/categories/` | kid | Read which categories are shown to the parent. |
| PUT | `/settings/categories/` | kid | Update visibility (partial allowed). |

**Body / response**

```json
{ "show_health": true, "show_learning": true, "show_responsibility": true, "show_creativity": true }
```

## Misc

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health/` | Health check. |
| GET | `/docs/` | Swagger UI. |
| GET | `/schema/` | OpenAPI schema. |
