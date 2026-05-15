# User app — registration & guardians

## Original product intent

- Kid registers while providing a parent email → UI shows something like **“waiting for parent response”**.
- System emails the parent; parent **links an existing account** or **creates one** if they do not have it yet.
- A kid can invite a **second parent** (e.g. username + email) so two guardians can be associated with the same kid.

---

## Are the current tables enough?

**Partially.**

| Piece | Fits? | Notes |
|--------|--------|--------|
| `CustomUser` (parent / admin, email login) | Yes | Good target for “parent signs in or registers”, tokens, notifications. |
| `Kid` (profile + `username`, `password_hash`) | Mostly | Fine if kid auth stays **outside** `AUTH_USER_MODEL` (API validates password yourself). Alternatively later: unify kid as a user type (`role=kid`) if you want one auth stack — bigger change. |
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
   - Parent opens link → if no user with that email, **registration** creates `CustomUser` then **`accept`** sets FK + status.
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

### Phase B — Backend API (minimal vertical slice)

- **Kid signup:** create `Kid` + first pending invitation + enqueue email (or log link in DEBUG).
- **Accept invite endpoint:** validate token (not expired, status pending) → attach `CustomUser`, set accepted, optionally activate Kid.
- **Resend invitation** / **cancel** (optional).
- **Kid-authenticated endpoint:** “invite second parent” → create second pending row + email.

Use DRF serializers + permissions (kid can only invite for own `Kid` row).

### Phase C — Email

- Configure Django **`EMAIL_*`** settings (or transactional provider later): template with link  
  `{FRONTEND}/parent/invite/{token}` or `{API}/accounts/invite/complete?token=` → then redirect.

### Phase D — Frontend / UX copy

- States: pending / accepted / expired; second-parent invite screen; parent “create vs login then link” wizard.

### Phase E — Polish

- Rate limiting invites, expiry cleanup (management command), optional notification when invite accepted.

---

## Open decisions (pick before coding)

1. **Kid authentication:** stay on `Kid.username` + `password_hash` vs promote kid to **`CustomUser`(role=kid)**.
2. **Max guardians** per kid (2 only vs N).
3. **Who verifies email** (kid vs parent) and whether **`invite_email`** must match **`CustomUser.email`** exactly on accept.

Once you confirm these three, **Phase B** can proceed without model rework (Phase A is in place).
