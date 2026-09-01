# ShiftProof

**Hours worked. Proof earned.**

ShiftProof is an independent, offline-first timecard engineering demo. It follows one employee entry from a durable Android save, through safe synchronization and human review, to an API-issued approval receipt.

It is a portfolio project, not a Wagepoint product or payroll engine. Wagepoint did not commission, sponsor, or approve it. All people, dates, hours, notes, identifiers, and review decisions in the demo are synthetic.

## Review the finished build

- [Live case study](https://shiftproof.swoop.video)
- [Live manager review](https://shiftproof.swoop.video/review)
- [Download the Android reviewer APK](https://github.com/yazanbaker94/shiftproof/releases/latest/download/shiftproof-release-arm64-v8a.apk)
- [Browse the source and documentation](https://github.com/yazanbaker94/shiftproof)

The Android APK is an ARM64 reviewer build for modern physical Android devices. It uses the same HTTPS API deployment as the manager review. Each mobile-created entry synchronizes into its own reviewer submission. `/review` shows a bounded, newest-first inbox of the 25 most recent submissions and loads the selected record's full evidence separately. The deterministic Sarah Chen scenario remains available as an explicitly labeled, read-only sample.

The published manager page is inspect-only. Production review decisions require an optional private reviewer capability link; without that capability, a visitor can examine connected synthetic records but cannot approve or return them.

## What to review

| Surface | Role in the demo | What it proves |
| --- | --- | --- |
| `apps/mobile` | Employee Android app | SQLite durability, automatic connectivity-aware synchronization, a persisted retry queue, stable request IDs, and accessible status marks |
| `apps/api` | Fastify service | Validated REST commands, idempotent creates, operation recovery, review decisions, and append-only evidence |
| `apps/web` | Case study and manager ledger | A reviewer can inspect recent live submissions and the read-only sample; a private reviewer capability can authorize an exact-record approve or return decision |
| `packages/contracts` | Shared vocabulary | Zod schemas and TypeScript types for entries, timesheets, operations, revisions, and events |
| `infra` | Deployment path | PostgreSQL, API, web, and Caddy services with health checks and bounded container resources |

The design is intentionally narrow: one reliable workflow is implemented end to end instead of presenting a broad mock payroll suite.

## The 90-second flow

1. In **Profile → Reviewer controls**, choose **Simulate offline**. This control is intentionally kept out of the employee's normal workflow.
2. Record hours—optionally loading the `16.0 h` review example—and save. SQLite commits the entry and its outbound operation in one transaction.
3. The app shows a local proof slip only after that transaction completes.
4. Choose **Automatic** again. If the device has internet, the queued command synchronizes without a manual button and uses the same idempotency key on every retry.
5. Open `/review`. The synchronized mobile entry appears in the recent live-submission inbox, separate from the labeled sample scenario; selecting it loads its full detail.
6. The public page is read-only. When demonstrating a decision, open the separately supplied private reviewer capability link, then choose **Approve** or **Return** on the exact submission.
7. The API appends the authorized decision and its evidence; approval also creates a stable receipt ID and timestamp.
8. Keep the Android **Timesheet** screen open for its 12-second decision check, bring the app to the foreground, or let the next automatic online pass run. Approval becomes **Payroll ready**. A return becomes **Returned by manager** and remains read-only; this narrow demo does not implement correction and resubmission.

For the exact reviewer path and the meaning of each mode, see [Reviewer demo script](docs/demo-script.md). For persistence and recovery details, see [Architecture](docs/architecture.md).

## Verified evidence

| Offline save on Android | Confirmed automatic synchronization | Reviewer-only network simulation |
| --- | --- | --- |
| ![ShiftProof saved offline on Android](docs/screenshots/mobile/saved-offline.png) | ![ShiftProof synchronized automatically with the API](docs/screenshots/mobile/synced-online.png) | ![ShiftProof reviewer controls](docs/screenshots/mobile/reviewer-controls.png) |

| Manager review | Approval recorded |
| --- | --- |
| ![ShiftProof manager review](docs/screenshots/web/manager-review.png) | ![ShiftProof approved revision](docs/screenshots/web/manager-review-approved.png) |

## What is implemented

- React Native/Expo screens and navigation for the employee workflow
- SQLite storage using WAL mode
- Atomic local entry + sync-operation writes
- A durable queue with `PENDING`, `SYNCING`, `WAITING_RETRY`, and `SUCCEEDED` states
- Exponential retry delays and recovery of an interrupted `SYNCING` operation
- Client-generated UUIDs and stable idempotency keys
- API request validation and same-key/same-payload replay
- Rejection of the same key with a different payload
- In-memory and PostgreSQL API repositories
- Append-only timesheet events and revisions
- A bounded manager inbox containing lightweight summaries for the 25 most recent mobile submissions
- Separate exact-record detail loading, with the shared sample clearly labeled and read-only
- Capability-gated approve/return commands against the selected submission's exact ID; the public production page can inspect but not mutate
- Android reconciliation of a connected decision during automatic sync, on foreground, and every 12 seconds while the Timesheet screen is visible
- API tests for replay, key collision, unusual-hours review, confirmation, approval, and return

## What is seeded or illustrative

The Sarah Chen scenario, pay period, `16.0 h` entry, manager identity, notes, and dashboard totals are deterministic demo data. The `16 h` threshold is a product demonstration heuristic—not payroll advice, an overtime rule, or a statement about Canadian employment law.

Runtime behavior depends on configuration:

- **Mobile without `EXPO_PUBLIC_API_URL`:** SQLite and the queue are real, but synchronization uses an on-device demo response. No remote server is contacted.
- **Mobile with `EXPO_PUBLIC_API_URL`:** create, recovery, confirm, and reconciliation use the REST API. A synchronized entry becomes an isolated live reviewer submission, not a mutation of the public sample.
- **API without `DATABASE_URL`:** the in-memory repository is real process state but resets when the API restarts.
- **API with `DATABASE_URL`:** PostgreSQL stores operations, entries, events, revisions, and decisions across restarts.
- **Web with an available API:** `/review` receives at most 25 lightweight submission summaries, then fetches full detail only for the selected record. The deterministic public record remains available as a read-only **Sample scenario**.
- **Public production review:** connected records can be inspected, but approve/return controls require a separately supplied private reviewer capability link. The shared sample is never mutable.
- **Web without an available API:** it displays a **Read-only preview**; no browser-only decision is presented as persisted.

The Android timesheet list genuinely reconciles a connected manager approval and changes the matching entry to **Payroll ready**. It also preserves a manager return as a read-only **Returned by manager** state; correction and resubmission are outside this narrow demo. The polished approval-receipt detail screen remains part of the seeded Sarah Chen scenario: the API issues a real `receiptId` and `approvedAt`, and mobile stores the returned receipt ID, but that detail screen's visible period, timestamp, and receipt copy use fixed demo values.

## Repository map

```text
apps/mobile         React Native employee app
apps/api            Fastify API and PostgreSQL migrations
apps/web            Case study and manager review ledger
packages/contracts  Shared request/response schemas
docs                Architecture, demo script, design system, screenshots
infra               Container and reverse-proxy configuration
```

Private visual references are intentionally excluded from version control. Recruiter-facing evidence belongs in `docs/screenshots`, not in the internal reference folder.

## Run locally

Requirements: Node.js 22.13+, npm, Java 17, and an Android SDK for native Android builds. PostgreSQL is optional; the API uses an in-memory repository when `DATABASE_URL` is absent.

Install each workspace:

```bash
npm --prefix packages/contracts install
npm --prefix apps/api install
npm --prefix apps/web install
npm --prefix apps/mobile install
```

Build the shared contracts, then start the API:

```bash
npm run contracts:build
npm run api:dev
```

For a connected local manager ledger, create an untracked `apps/web/.env.local` containing:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:4100
```

Then start the web app:

```bash
npm run web:dev
```

For an Android emulator to reach the API running on the host machine, create an untracked `apps/mobile/.env.local` containing:

```dotenv
EXPO_PUBLIC_API_URL=http://10.0.2.2:4100
```

Use the host's LAN address instead of `10.0.2.2` for a physical Android device. Then run:

```bash
npm run mobile:start
```

## Validate and build the APK

Run the repository checks:

```bash
npm run check
```

Build an emulator debug APK or an ARM64 reviewer APK:

```bash
npm --prefix apps/mobile run android:debug:x86_64
npm --prefix apps/mobile run android:reviewer:arm64
```

The build script writes generated APKs under `apps/mobile/dist/android/`. APKs are intentionally ignored by Git; the verified reviewer binary and its SHA-256 checksum are attached to the latest GitHub Release.

## Privacy and product boundary

ShiftProof contains no real employee, payroll, customer, or Wagepoint data. It is not a payroll engine: it records time evidence and review decisions but does not calculate wages, taxes, statutory overtime, eligibility, remittances, or payroll results.
