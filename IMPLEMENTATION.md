# BBS Management System — Implementation Status

Scope of this delivery: **Phases 1–7 core domain (database, transactional logic,
domain services, tests)** plus the Phase 1 design-token/env foundation.
Everything below is split honestly into IMPLEMENTED and NOT IMPLEMENTED.

## 1. Assessment (Section 63)

No repository was supplied — only the PRD, Execution Protocol and addendum.
There is therefore no existing stack, schema, auth or module to preserve or
conflict with, so the architecture in Sections 1–66 was established from zero.
The gap against the spec is total at the start; the ordering below follows
Section 57 exactly.

## 2. IMPLEMENTED

### Database (`supabase/migrations/`)
| Migration | Contents |
|---|---|
| 0001 | extensions, all enums, `system_settings`, `audit_logs` |
| 0002 | `users`, `members`, `current_app_role()`, `current_member_id()`, `is_admin()` |
| 0003 | `membership_plans`, `memberships`, `membership_credit_ledger`, `membership_credit_state()` |
| 0004 | `operating_schedules`, `schedule_overrides`, `session_slots` |
| 0005 | `casual_customers`, `bookings`, `booking_participants`, status/slot history, `attendance_records` |
| 0006 | `payment_orders`, `payment_transactions`, `renewal_requests`, `notifications`, `user_devices`, `integration_sync_jobs` |
| 0007 | transactional domain functions (below) |
| 0008 | row level security for every table |
| 0009 | configuration + plan + operating-schedule seed |

### Integrity guarantees enforced in the database, not in code
- `memberships_one_active_per_member` — one ACTIVE membership per member.
- `credit_ledger_one_reservation_per_participant` — a participant can never
  reserve twice (Section 44.3).
- `credit_ledger_one_settlement_per_participant` — a reservation can be settled
  exactly once, whichever way it settles (Section 44.4).
- `participant_identity_valid` — MEMBER rows require member + membership,
  CASUAL rows require a casual customer; no other combination can exist.
- `schedule_start_on_hour` / `slot_start_on_hour` — half-hour sessions are
  structurally impossible (Section 44.14).
- `session_slots (slot_date, start_time)` unique — slot generation is idempotent.
- `sync_jobs_pending_unique` — a retried sync job cannot duplicate a row.
- `notifications_dedupe_idx` — a repeated dispatch cannot duplicate a record.

### Transactional functions (Section 64.9)
`create_member_booking`, `approve_booking`, `cancel_booking`,
`request_reschedule`, `approve_reschedule`, `resolve_attendance`,
`generate_session_slots`, `expire_pending_bookings`, `expire_memberships`.

Each one locks the affected `session_slots` row first, then `memberships`
rows in ascending id order, then re-reads capacity and credit state inside the
same transaction. No "SELECT then INSERT" path exists.

### Domain / application layer (`src/`)
- `domain/shared/errors.ts` — the Section 47 error vocabulary; Postgres raises
  the same codes, so no database internals reach the client.
- `domain/booking/status-machine.ts` — Section 18 transitions.
- `domain/booking/cancellation-policy.ts` — Section 23, deadline from config.
- `domain/credit/ledger.ts` — derived credit state, never a stored integer.
- `domain/schedule/slot-generation.ts` — pure mirror of the SQL generator.
- `schemas/booking.ts` — Zod input contracts.
- `lib/settings.ts` — typed `system_settings` access with safe defaults.
- `modules/bookings/booking-service.ts` — authorization + validation + RPC;
  `member_id` is always derived server-side.
- `styles/tokens.css` — Section 66.2 tokens (sage/gold/cream/warm charcoal).

### Tests — 23 passing (`npx vitest run`)
Slot generation against the locked timetable (including "no 11:00", "no 12:00",
"no half-hour starts"), the booking state machine, and the full credit lifecycle
(reserve → complete / early return / late forfeit / BBS return / both no-show
resolutions). Typecheck (`tsc --noEmit`) passes clean.

## 3. NOT IMPLEMENTED / REMAINING

Honestly stated — none of the following is scaffolded and none should be
claimed as done:

- Next.js app itself (App Router, Server Actions, layouts, any screen).
- Supabase Auth wiring and the Google OAuth callback.
- Casual booking RPC + admin flow (Phase 8), renewal/payment abstraction
  (Phase 9), FCM notifications and device registration (Phase 10), reporting
  and Excel export (Phase 11), Google Sheets sync worker (Phase 12).
- Integration and concurrency tests against a real Postgres instance
  (Section 64.10 TEST A–E). The constraints that make them pass exist; the
  tests themselves need a live database, which this environment has no
  connection to.
- The PWA layer (manifest, service worker) from Section 65.
- RLS behavioural verification (Section 64.14) — policies exist, behaviour is
  unverified without a live project.

## 4. Engineering decisions made (Section 64.24)

1. **Credit is reserved at approval, not at submission.** Section 15 ties
   reservation to a *confirmed* booking. A PENDING booking therefore holds
   capacity only; eligibility still checks available credit at submission so a
   member cannot queue a booking they cannot pay for. `create_member_booking`
   and `approve_booking` both re-validate.
2. **Lock ordering is slot → membership (id ascending)** to make deadlock
   between concurrent bookings impossible.
3. **Credit state is derived, never stored.** `membership_credit_state()` sums
   the ledger; two partial unique indexes make double-reserve and
   double-settle unrepresentable rather than merely unlikely.
4. **Timezone is `Asia/Makassar` (WITA)**, stored as configuration.
5. **Booking closes when every participant is resolved** — the booking becomes
   COMPLETED if anyone attended, otherwise NO_SHOW, so a mixed session is never
   stuck open.

## 5. Running it

```bash
npm install
npx vitest run          # 23 domain tests
npx tsc --noEmit        # typecheck
supabase db push        # applies migrations 0001-0009 in order
select generate_session_slots(current_date, current_date + 30);
```

---

## 6. Presentation layer (ditambahkan setelah design direction)

| File | Isi |
|---|---|
| `src/app/globals.css` | design token BBS (emas/arang/krem + sage/clay/lilac) |
| `tailwind.config.ts` | token dipetakan ke Tailwind theme — komponen tidak pernah pakai hex |
| `src/components/ui/primitives.tsx` | HeroCard, StatCard, Card, StatusPill, CreditBar, Button |
| `src/components/member/bottom-nav.tsx` | pill nav gelap, tab set per role |
| `src/components/member/top-bar.tsx` | avatar + greeting + bell dengan unread dot |
| `src/app/(member)/layout.tsx` | guard sesi + nav; role diturunkan server-side |
| `src/app/(member)/home/page.tsx` | Member Home sebagai Server Component |
| `src/app/(member)/schedule/actions.ts` | Server Action `submitBooking` |
| `src/lib/auth.ts` | `getActor` / `requireActor` — role & memberId dari DB |
| `src/infrastructure/supabase-server.ts` | klien SSR pakai anon key, RLS tetap berlaku |
| `src/modules/bookings/booking-queries.ts` | query baca Member Home, tanpa N+1 |
| `next.config.mjs` | next-pwa; non-GET selalu NetworkOnly |
| `public/manifest.webmanifest` | manifest standalone, ikon 192/512/maskable |
| `bbs-prototype.html` | prototipe klikable 16 screen (referensi visual, bukan kode produksi) |

**Catatan typecheck:** `tsconfig.json` sementara meng-exclude file yang
bergantung pada Next/React/Supabase SDK, karena dependensi itu belum terpasang
di environment ini. Setelah `npm install next react react-dom lucide-react
@supabase/ssr @supabase/supabase-js next-pwa tailwindcss`, hapus blok `exclude`
dan jalankan `npx tsc --noEmit` penuh.

**Masih kurang di layer ini:** screen Schedule/Bookings/Booking Detail/
Membership/Renewal/Profile/Notifications belum jadi page (baru ada di
prototipe HTML), semua screen Admin & Groomer, ikon PNG untuk manifest,
dan halaman publik.
