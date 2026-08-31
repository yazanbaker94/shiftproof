# ShiftProof API

Small, deliberate backend for the ShiftProof hiring demo. It proves the parts an
offline-first mobile app cannot fake with screenshots: stable client IDs,
idempotent retries, reconciliation after a lost response, append-only review
evidence, and a manager approval receipt.

## Run locally

```bash
npm install
npm run dev
```

Without `DATABASE_URL`, the API uses a deterministic in-memory repository seeded
with Sarah Chen's **Aug 24–Sep 06** timesheet. `GET /v1/timesheets/demo` is an
alias for the stable demo UUID exported by `@shiftproof/contracts`.

To use PostgreSQL, create a database, copy `.env.example`, then run:

```bash
npm run db:migrate
npm run start
```

The SQL model keeps current projections in `timesheets` and `time_entries`, while
`time_entry_revisions`, `timesheet_revisions`, and `timesheet_events` are guarded
by database triggers that reject updates and deletes.

## Mobile reconciliation contract

Create an entry with an offline-generated UUID and a stable request key:

```http
POST /v1/time-entries
Idempotency-Key: add-hours/01928/attempt-1
Content-Type: application/json

{
  "clientId": "3b792a31-f17f-45e7-84e3-c07ef4c86889",
  "workDate": "2026-08-28",
  "regularMinutes": 480,
  "overtimeMinutes": 90,
  "note": "Covered close"
}
```

`timesheetId` and `employeeId` default to the demo identities. The first request
returns `201`. A byte-for-byte semantic retry with the same key returns the same
status and body plus `Idempotent-Replayed: true`. Reusing the key with different
data returns `409 IDEMPOTENCY_KEY_REUSED`.

If the phone loses the success response, it can recover it from
`GET /v1/operations/:key` at `data.response.data`.

## Routes

- `GET /health`
- `POST /v1/time-entries`
- `GET /v1/operations/:key`
- `GET /v1/timesheets/:id` (`demo` is accepted)
- `POST /v1/time-entries/:id/confirm`
- `POST /v1/timesheets/:id/approve`
- `POST /v1/timesheets/:id/return`

The unusual-hours flag is intentionally a **demo heuristic**: a daily total of
16 hours or more opens review. It is not presented as a Canadian payroll or
labour-law rule.
