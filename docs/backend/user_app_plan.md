# User app — registration & guardians

## Original product intent

- Kid registers while providing a parent email → UI shows something like **“waiting for parent response”**.
- System emails the parent; parent **links an existing account** or **creates one** if they do not have it yet.
- A kid can invite a **second parent** (e.g. username + email) so two guardians can be associated with the same kid.

---

## Auth & API stack (Django-native + JWT)

Use **Django’s built-in user and email machinery** where it applies, and **JWT for API sessions** (not magic-link tokens for day-to-day API auth).

| Concern | Use from Django / ecosystem | Notes |
|--------|-----------------------------|--------|
| Parent accounts | `AUTH_USER_MODEL` (`CustomUser`), `UserManager.create_user` / `set_password` | Parents get real hashed passwords and password validators already in `settings.py`. |
| Parent login (API) | **DRF** + **`djangorestframework-simplejwt`** | `TokenObtainPairView` / `TokenRefreshView` — access + refresh tokens for `CustomUser`. Optional **custom token serializer** to embed claims (e.g. `role`, linked `kid_ids`). |
| Parent **Google** sign-in (API / SPA) | **Google Identity Services** on the client → backend verifies **`id_token`**, then issues **your** JWT pair | SPA sends the credential (JWT from Google) to e.g. `POST /auth/google/`; Django verifies signature, `aud`, `iss`, `email_verified` using Google’s JWKS (library: **`google-auth`**). **`get_or_create`** `CustomUser` by stable **`sub`** (store `google_sub` on user or use **`django-allauth`** / **`social-auth-app-django`** if you want full social-account rows). Then return the same **SimpleJWT** access/refresh as password login so all parent API paths stay uniform. |
| Outbound mail | `django.core.mail.send_mail` / `EmailMessage`, templates via `django.template.loader.render_to_string` | Configure `EMAIL_BACKEND` (e.g. `console` in dev, `smtp` in prod), `DEFAULT_FROM_EMAIL`, `EMAIL_HOST`, etc. No need for a separate “email microservice” for v1. |
| HTML / text bodies | Django templates under e.g. `templates/emails/` | Single `render_to_string('emails/guardian_invite.txt', context)` (and `.html` if you send multipart). |
| Guardian invite link | **Opaque `GuardianInvitation.token`** (already on the model) | This is a **one-time / short-lived invite secret**, not a JWT. Keeps invites revocable and DB-backed. After accept, the client uses **normal JWT** from login. |
| Kid login (API) | **Open product decision** (see below) | `SimpleJWT` authenticates **users** from `AUTH_USER_MODEL` by default. If the kid stays on the separate `Kid` model, you either: (a) issue **custom signed JWTs** (e.g. PyJWT + shared settings) after validating `Kid` credentials, or (b) **unify** the kid as a `CustomUser` with `role=kid` so one JWT stack covers everyone. |

**Important distinction:** **Invite token** = row in `GuardianInvitation`, sent by email. **JWT** = issued only after successful authentication (parent `CustomUser`, or unified kid user / custom kid token path).

**Google vs invite:** The email in Google’s `id_token` should satisfy the same **invite / guardian** rules as a password-registered parent (e.g. normalized match to `invite_email` when completing an invite). Google does **not** replace your invite token for linking to a kid; it only proves identity for creating or selecting the `CustomUser` row.

**Kids and Google:** The plan assumes **only parents/guardians** use Google sign-in (they map to `CustomUser`). **Kid** signup/login stays **username + password** (or a unified `CustomUser` with `role=kid` later) — **not** Google in v1, unless you explicitly extend the product (COPPA/consent and age policies usually steer social login away from child accounts).

---

## Are the current tables enough?

**Partially.**

| Piece | Fits? | Notes |
|--------|--------|--------|
| `CustomUser` (parent / admin, email login) | Yes | Use for parent registration, `create_user`, JWT pair issuance, **Google sign-in** (after token verification), and optional email-based flows (future: `PasswordResetForm` / Django’s password reset views if you add HTML routes). |
| `Kid` (profile + `username`, `password_hash`) | Mostly | If kid stays **outside** `AUTH_USER_MODEL`, validate password in the API layer; JWT for kids then needs the **custom** path above. Unifying kid as a user type gives **one** JWT story at the cost of a larger model/auth change. |
| `Kid.parent` = single **required** `ForeignKey` | **No** | On signup, parent often **does not exist yet** and is **not verified** → you cannot reliably set `parent` at kid creation. |
| Exactly **one** parent per kid | **No** | You need either a **many-to-many** Kid ↔ Parent or a **`GuardianLink` / invitation** row per adult. |

**Conclusion:** Keep `CustomUser` and `Kid` as the core, but **change how parents attach**: replace (or soften) `Kid.parent` with an **invitation / guardian membership** model that supports **pending → accepted**, **invite by email**, and **multiple parents**.

---

## Data model direction (recommended)

1. **`GuardianInvitation` (or `KidGuardian`)** — one row per “link” attempt or active link:
   - `kid` (FK → `Kid`)
   - `parent` (FK → `CustomUser`, **null=True** until parent accepts / account exists)
   - `invite_email` (EmailField — always set for outbound invite)
   - `status`: e.g. `pending` | `accepted` | `declined` | `expired` | `revoked`
   - `token` (unique, for magic link), `sent_at`, `expires_at`
   - optional: `created_by_kid=True` vs staff-created, **role** (“primary”, “secondary”) if you care

2. **`Kid`** adjustments:
   - Either **drop** mandatory `Kid.parent`, or keep **nullable** `primary_parent` only as cache once first guardian accepts (optional denormalisation).
   - Add **`registration_status`** on `Kid` if useful for UX: `awaiting_primary_parent` | `active` | `suspended` (or derive only from invitations — your choice).

3. **Signup rules:**
   - **First parent email** → create Kid + **one** `GuardianInvitation(pending)`, send email (no `CustomUser` required yet).
   - Parent opens link → if no user with that email, **registration** creates `CustomUser` (Django **`create_user`** / **`set_password`**) **or** parent chooses **“Continue with Google”** and you **`get_or_create`** by `google_sub` with email from the verified `id_token` — then **`accept`** sets FK + status (enforce **email alignment** with `invite_email` per your open decisions).
   - **Second parent:** kid taps “invite parent” → new `GuardianInvitation` row with supplied email/username hint, same accept flow.

4. **Uniqueness / abuse:** prevent duplicate pending invites same `(kid, invite_email)`; cap number of guardians if product requires (“max 2”).

---

## Straightforward implementation plan (phases)

### Phase A — Models & migrations *(done)*

Implemented in codebase:

- **`GuardianInvitation`**: `kid`, optional `parent`, `invite_email`, `invited_username_hint`, `role` (`primary` / `secondary`), `status`, `token`, `created_by_kid`, timestamps. Partial unique index: **one pending invite per `(kid, invite_email)`**.
- **`Kid`**: **`parent`** is now **nullable** (signup before parent exists / multi-guardian). **`registration_status`**: `awaiting_primary_parent` | `active` | `suspended`. Migration **`0002_phase_a_guardians`** sets **`active`** for rows that already had a parent.
- **`Kid.parent`** kept as optional denormalised “primary” link for now; authoritative links for multiple adults are **`GuardianInvitation`** rows with `accepted` (+ `parent`) in Phase B.
- Django admin registrations for **`CustomUser`**, **`Kid`**, **`GuardianInvitation`** (`users/admin.py`).

### Phase A2 — Dependencies & JWT wiring *(recommended next)*

- Add **`djangorestframework`**, **`djangorestframework-simplejwt`**, and (optional) **`django-cors-headers`** if the SPA is on another origin.
- **Google token verification:** add **`google-auth`** (or verify JWT manually); store **`GOOGLE_OAUTH_CLIENT_ID`** (web client) in env and use it as the expected **`aud`** when verifying `id_token`.
- In `settings.py`: register apps, `REST_FRAMEWORK` with **`DEFAULT_AUTHENTICATION_CLASSES`: `JWTAuthentication`**, and **`SIMPLE_JWT`** (access lifetime, refresh rotation, signing key from `SECRET_KEY` or dedicated key).
- URLs: mount **`TokenObtainPairView`**, **`TokenRefreshView`** (and optionally **`TokenBlacklistView`** if using refresh blacklisting).
- **Custom user claims** (optional): subclass **`TokenObtainPairSerializer`** to add stable claims the frontend needs (e.g. `is_staff`, `user_id`) — avoid putting huge graphs in the JWT; load details from the API when needed.

### Phase B — Backend API (minimal vertical slice)

- **Kid signup:** create `Kid` + first pending invitation + **`send_mail`** / `EmailMessage` using a Django template (in DEBUG, `console` backend still “implements” the flow without SMTP).
- **Parent register (if no account):** DRF serializer that calls **`User.objects.create_user`** (or your `CustomUser` manager) with validated password → same validators as admin-created users.
- **Parent login:** existing user → **JWT pair** via SimpleJWT (email/username + password fields as you prefer on `CustomUser`).
- **Parent Google login:** **`POST /auth/google/`** (name as you like) accepts **`id_token`** (or the one-shot credential string from GIS) → verify with Google → **`get_or_create` `CustomUser`** → return **same SimpleJWT pair** as password login.
- **Accept invite endpoint:** validate **invite `token`** (not expired, status pending) → attach **`CustomUser`** (must match product rules vs `invite_email`; if the parent uses Google, compare verified Google **email** to `invite_email`), set accepted, optionally activate Kid → response can include **JWT pair** so the parent lands logged in without a second login step (optional UX).
- **Resend invitation** / **cancel** (optional).
- **Kid-authenticated endpoint:** “invite second parent” → create second pending row + email; permission class ensures the JWT (or session) identifies the kid row allowed to act.

Use DRF serializers + permissions throughout.

### Phase C — Email (Django-first)

- **Settings:** `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL` (production); local dev often uses **`django.core.mail.backends.console.EmailBackend`**.
- **Templates:** `render_to_string` for subject/body; link target **`{FRONTEND}/parent/invite/{token}`** (or API redirect URL that sets cookies — JWT SPA usually prefers frontend route).
- **Sending:** `send_mail(..., fail_silently=False)` in a try/except in the view or **enqueue** later (Phase E) with Celery/RQ if needed; for v1, synchronous send is fine.
- **Admins:** optional `mail_admins()` for failures — not required for invites.

### Phase D — Frontend / UX copy

- States: pending / accepted / expired; second-parent invite screen; parent “create vs login then link” wizard.
- **Google:** load **Google Identity Services** (button / One Tap); on success, send the credential to your **`/auth/google/`** endpoint and store the returned **SimpleJWT** pair like a normal login.
- Store **access JWT** in memory or secure storage; use **refresh** endpoint before access expiry; attach **`Authorization: Bearer <access>`** to API calls.

### Phase E — Polish

- Rate limiting invites, expiry cleanup (management command), optional notification when invite accepted.
- Optional: Django **`PasswordResetView`** (session/HTML) or DRF endpoints wrapping **`PasswordResetTokenGenerator`** if you want password reset without adding a paid provider.

---

## Open decisions (pick before coding)

1. **Kid authentication + JWT:** stay on `Kid.username` + `password_hash` with a **custom kid JWT** path, vs promote kid to **`CustomUser`(role=kid)** so **SimpleJWT** covers kids and parents the same way.
2. **Max guardians** per kid (2 only vs N).
3. **Who verifies email** (kid vs parent) and whether **`invite_email`** must match **`CustomUser.email`** / **Google email** exactly on accept (require **`email_verified`** from Google if using Google on that path).
4. **Google account storage:** minimal (**`google_sub`** + reuse `email` on `CustomUser`) vs **`django-allauth`** / **`social-auth-app-django`** for multiple providers and admin visibility later.
5. **Password vs Google on one account:** allow linking Google to an existing email/password user (recommended UX) vs forbid duplicates — if linking, add a **“link Google”** flow for authenticated users in a later slice.

Once you confirm these, **Phase B** can proceed without model rework (Phase A is in place); you may add a small migration for **`google_sub`** (nullable, unique) if you skip allauth for v1. **Phase A2** can land in parallel (JWT + Google verification plumbing does not depend on guardian logic).
