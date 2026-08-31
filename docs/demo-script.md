# Reviewer demo script

This walkthrough distinguishes a connected run from the self-contained preview. Before presenting, decide which mode you are using.

## Choose a mode

### Connected end to end

Run the API and configure both clients:

```dotenv
# apps/web/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:4100

# apps/mobile/.env.local — Android emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:4100
```

The manager page should say **Live record**. Mobile synchronization will use HTTP, and API mutations will be stored in memory or PostgreSQL according to the API configuration.

### Self-contained review

Leave `EXPO_PUBLIC_API_URL` unset to exercise real SQLite and queue behavior with an on-device demo response. If the manager API cannot be reached, its page says **Isolated preview**. In this mode, browser decisions are intentionally not persisted and mobile/server state is not shared.

Do not describe the self-contained mode as a live end-to-end backend run.

## 90-second connected walkthrough

1. Open the Android **Home** screen. Point out the explicit **Demo network** control and the text-and-shape status marks.
2. Set **Demo network** to **Offline**.
3. Tap **Add hours**. Keep the default `8.0` regular + `1.5` overtime entry, or tap **Load 16.0 h review example** for the unusual-hours path.
4. Save. The proof slip appears only after SQLite commits both the entry and queued operation. The displayed local ID remains stable across retries.
5. Optionally close and relaunch the app. The proof and queued work remain unless app data is cleared or the demo is reset.
6. Set **Demo network** to **Online**. The app sends due work and reconciles the server response. With the API configured, this is a real HTTP request; without it, it is the documented local-demo transport.
7. For a 16-hour entry, open **Needs attention**, keep or edit the context note, and submit for review.
8. Open the web **Manager review** page and verify the status says **Live record** before claiming persistence.
9. Select the amber row. **Approve** appends the decision and produces API receipt metadata. **Return** requires a manager note and appends that decision instead. Choose one; the demo API correctly prevents returning an already approved timesheet.
10. Refresh the manager page. In connected mode, the decision remains for the life of the configured repository. PostgreSQL survives API restarts; the in-memory repository does not.

## Recovery path worth demonstrating

The most important failure is an uncertain create result:

1. Android sends `POST /v1/time-entries` with a stable `Idempotency-Key`.
2. If the request reports an error after the server may have committed it, mobile asks `GET /v1/operations/:key`.
3. When found, the original result is applied locally; no second entry is created.
4. When not found, the queue enters `WAITING_RETRY`, records the error, and retries after an exponential delay.
5. The API tests also prove that replaying the same key and payload returns the first result, while reusing the key for another payload returns `409`.

The demo does not include a UI button that deliberately drops a server response. This recovery path is implemented in the sync client and covered by protocol/API tests rather than being presented as a staged visual effect.

## Approval receipt: precise claim

After a connected approval, the API record contains a real receipt ID and approval timestamp. Mobile reconciliation can store the API receipt ID and mark matching local entries `PAYROLL_READY`.

The current polished mobile receipt screen uses fixed Sarah Chen demo copy for its visible period, timestamp, and receipt label. Present that screen as the intended receipt experience, not as proof that every displayed field was dynamically populated by the manager action.

## Suggested explanation

> ShiftProof is a narrow reliability demo. The employee can save time evidence before connectivity returns because the entry and outbound command are committed together in SQLite. When the device reconnects, a stable idempotency key makes create retries safe. A manager can review the unusual entry without erasing the employee's original evidence, and a connected approval appends history and issues receipt metadata. The people, hours, threshold, and receipt presentation are synthetic; the persistence and recovery mechanisms are the engineering proof.

## Reviewer checks

- **Saved locally** corresponds to a completed SQLite transaction, not optimistic UI copy.
- The demo network switch is a product control; the app separately observes actual device reachability.
- Status always uses text and shape, not color alone.
- **Live record** and **Isolated preview** make web persistence explicit.
- The 16-hour threshold is labeled as a demo heuristic, never a legal or payroll rule.
- The in-memory API resets on restart; PostgreSQL is the persistent mode.
- All names and records are synthetic.
- The project is independent and unaffiliated with Wagepoint.

## Reset between reviews

- Mobile: use **Profile → Reset demo data** to restore the local seeded scenario.
- In-memory API: restart the API process.
- PostgreSQL: use a fresh demo database or rerun the intended seed/reset procedure; do not erase an environment that contains anything outside this synthetic demo.
- Browser preview: refresh the page.
