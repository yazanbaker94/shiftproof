# Architecture

ShiftProof separates three concerns: durable employee capture on Android, authoritative workflow commands in the API, and manager review on the web. Shared contracts keep their identifiers and status vocabulary aligned.

```text
Android employee app                         Manager web ledger
┌──────────────────────┐                    ┌─────────────────────┐
│ UI + auto network    │                    │ live / preview label│
│ SQLite (WAL)         │                    │ inspect / gated act │
│ time entry           │                    └──────────┬──────────┘
│ queued operation     │                               │ REST
│ sync + review receipt│                               │
└──────────┬───────────┘                               │
           │ REST + Idempotency-Key                    │
           └──────────────────┬────────────────────────┘
                              ▼
                    ┌──────────────────────┐
                    │ Fastify + Zod API    │
                    │ domain validation    │
                    │ idempotent commands  │
                    │ operation lookup     │
                    │ review decisions     │
                    └──────────┬───────────┘
                               │
                 ┌─────────────┴─────────────┐
                 ▼                           ▼
        in-memory repository          PostgreSQL repository
        local/test convenience        persistent deployment
```

## Save invariant on mobile

The mobile UI does not report a local save until one exclusive SQLite transaction has:

1. inserted or updated the time entry; and
2. inserted the outbound operation with its serialized payload and idempotency key.

SQLite runs in WAL mode. Closing the app after the proof slip appears does not remove the entry or its queued operation. Clearing app data, uninstalling the app, or using **Reset demo data** does remove local records.

Entry status and queue status are separate. Entries use product states such as `PENDING_SYNC`, `NEEDS_ATTENTION`, `SUBMITTED`, and `PAYROLL_READY`. Queue rows use `PENDING`, `SYNCING`, `WAITING_RETRY`, and `SUCCEEDED`.

## Synchronization and recovery

Each create starts with a client UUID. The UUID becomes both the entry's `clientId` and part of the stable `Idempotency-Key` sent to the API.

```text
PENDING
   │ online / due
   ▼
SYNCING ───── success ─────► SUCCEEDED + local sync receipt
   │
   ├── request error on create ─► GET /v1/operations/:key
   │                                │
   │                                ├── found ─► apply original result
   │                                └── missing/error
   ▼
WAITING_RETRY ── exponential delay (capped at 60 s) ──► SYNCING
```

If the server committed a create but its HTTP response was lost, the operation lookup returns the stored result. If the operation cannot be recovered, the queue records the error and schedules another attempt. An operation left in `SYNCING` by an interrupted process is considered due the next time online synchronization runs.

The API stores a request hash with each idempotency operation:

- same key + same payload returns the original response and sets `Idempotent-Replayed: true`;
- same key + different payload returns `409 IDEMPOTENCY_KEY_REUSED`;
- an operation result can be queried by key after an uncertain response.

This guarantee is implemented for time-entry creation. Confirmation and manager review are ordinary domain commands; their history remains append-only, but they are not described as idempotency-key-backed creates.

## API and persistence modes

Fastify receives REST commands and Zod validates their shape. The service selects its repository at startup:

- no `DATABASE_URL` → deterministic in-memory repository, convenient for tests and local review, reset on process restart;
- `DATABASE_URL` present → PostgreSQL repository and SQL migrations, persistent across service restarts.

Core routes:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Repository mode and explicitly demo-only review threshold |
| `POST` | `/v1/time-entries` | Idempotent time-entry create |
| `POST` | `/v1/reviewer/time-entries` | Idempotent create into an isolated mobile reviewer submission |
| `GET` | `/v1/operations/:key` | Recover an uncertain create result |
| `GET` | `/v1/reviewer/timesheets` | Return lightweight summaries for up to 25 recent mobile submissions, newest-first |
| `GET` | `/v1/timesheets/:id` | Read entries, totals, events, and revisions; `demo` resolves to the seeded record |
| `POST` | `/v1/time-entries/:id/confirm` | Add employee confirmation context |
| `POST` | `/v1/timesheets/:id/approve` | With reviewer capability, append approval and issue receipt metadata |
| `POST` | `/v1/timesheets/:id/return` | With reviewer capability, append a return decision and manager note |

## Evidence model

Reviewing a record does not rewrite the evidence trail. The API keeps the current materialized timesheet for efficient reads and appends domain events and human-readable revisions for auditability. Approval adds a receipt ID and approval timestamp. Return requires a note and appends that reason.

The original entry, employee confirmation, and manager decision therefore remain distinguishable. This is an evidence-oriented demo, not a general-purpose event-sourcing framework.

## Connected reviewer handoff

With the API available, the manager page requests a bounded inbox of lightweight summaries for the 25 most recent live submissions and opens the newest one by default. It fetches full entries, events, and revisions only for the selected timesheet. A reviewer can select another live submission or deliberately switch to the deterministic, read-only **Sample scenario**.

Reading and deciding are separate trust boundaries. The public production page can inspect synthetic connected records, but approve and return commands require an optional private reviewer capability link. When that capability is present, the command uses the selected submission's exact timesheet ID. The API rejects decisions against `demo`, so the public sample cannot be changed even by a capable reviewer.

The manager page makes its connection mode explicit:

- **Connected record** means reads are backed by the API repository; mutation controls are available only when the private reviewer capability is valid.
- **Read-only preview** means the API was unavailable. The seeded table remains inspectable, but no decision is recorded.

That label is part of the trust boundary: a polished interaction is not presented as a persisted mutation when the service cannot be reached.

## Seeded versus connected mobile behavior

The Android app always uses real SQLite transactions and queue rows. Transport differs:

- without `EXPO_PUBLIC_API_URL`, successful synchronization is simulated locally so the mobile workflow can be reviewed without infrastructure;
- with `EXPO_PUBLIC_API_URL`, the app performs create, operation recovery, confirmation, and timesheet reconciliation against the REST API.

The seeded mobile and web screens tell the same deterministic Sarah Chen scenario, but they are not the destination for new employee data. A newly created mobile entry synchronizes through the real API into an isolated reviewer ledger keyed by its stable client UUID. A lightweight summary of that record can appear in `/review`; selecting it loads the exact detail. An authorized private reviewer can approve or return it by ID without changing the public baseline.

When Android is online, it reconciles live submissions during the automatic synchronization pass and whenever the app returns to the foreground. While the Timesheet screen is visible, it also checks for a manager decision every 12 seconds. Approval changes the matching local entry to `PAYROLL_READY` and stores the API receipt metadata. Return changes it to `RETURNED` and preserves that terminal state as read-only; correction and resubmission are not implemented. The labeled sample continues to provide a deterministic walkthrough and cannot be mutated.

## Deliberate product boundary

ShiftProof contains only synthetic demo data. It is independent portfolio software—not Wagepoint software, a Wagepoint product, or a payroll engine. It does not calculate payroll, tax, statutory overtime, eligibility, remittances, or labor-law compliance. Daily totals of 16 hours or more are flagged solely to demonstrate a calm human-review workflow. The health response and API copy label this as a product-demo heuristic.
