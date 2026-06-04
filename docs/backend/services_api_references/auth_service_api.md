# Auth Service API

All paths are prefixed with `/api/`. Interactive docs: `/api/docs/`.

Two account types: **parent** and **kid**. Most endpoints return JWT access/refresh tokens.

## Parent

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/register/` | Register a parent and send a verification email. |
| POST | `/auth/verify-email/` | Verify a parent's email. |
| POST | `/auth/token/` | Log in a parent (email/username + password) -> tokens. |
| POST | `/auth/token/refresh/` | Refresh a parent's access token. |
| POST | `/auth/token/verify/` | Check a parent's access token is valid. |
| POST | `/auth/google/` | Log in or sign up a parent via Google. |

The parent access token includes a `kid_ids` claim (the kids they guard), used by task-service.

## Kid

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/kids/signup/` | Register a kid and invite the primary parent. |
| POST | `/kids/signup/google/` | Register a kid via Google (not used yet). |
| POST | `/auth/kid/verify-email/` | Verify a kid's email. |
| POST | `/kids/invite-parent/` | Logged-in kid invites a second parent. |
| POST | `/auth/kid/token/` | Log in a kid -> tokens. |
| POST | `/auth/kid/token/refresh/` | Refresh a kid's access token. |
| POST | `/auth/kid/token/verify/` | Check a kid's access token is valid. |
| POST | `/auth/kid/google/` | Log in a kid via Google. |

## Guardian invitations

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/guardian-invitations/{token}/` | Preview a pending invitation (public). |
| POST | `/guardian-invitations/accept/` | Logged-in parent accepts a guardian invitation. |

## Misc

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/docs/` | Swagger UI. |
| GET | `/schema/` | OpenAPI schema. |
| GET | `/admin/` | Django admin (superuser). |
