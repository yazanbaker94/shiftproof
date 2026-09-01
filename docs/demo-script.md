# Reviewer demo script

This walkthrough distinguishes a connected run from the self-contained preview. Before presenting, decide which mode you are using.

The published reviewer path is [shiftproof.swoop.video](https://shiftproof.swoop.video), with the connected ledger at [/review](https://shiftproof.swoop.video/review). The public ledger is inspect-only. A production decision requires a separately supplied private reviewer capability link; do not publish or commit that link. The latest ARM64 APK is attached to the [GitHub release](https://github.com/yazanbaker94/shiftproof/releases/latest).

## Choose a mode

### Connected end to end

Run the API and configure both clients:

```dotenv
# apps/web/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:4100

# apps/mobile/.env.local — Android emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:4100
```

The manager page should say **Connected record**. Mobile synchronization will use HTTP, and API mutations will be stored in memory or PostgreSQL according to the API configuration. `/review` lists lightweight summaries for at most the 25 most recent isolated mobile submissions, loads exact detail after selection, and retains the deterministic record as a read-only **Sample scenario**. Public production visitors can inspect connected synthetic records; only a private capability link authorizes approve or return.

### Self-contained review

Leave `EXPO_PUBLIC_API_URL` unset to exercise real SQLite and queue behavior with an on-device demo response. If the manager API cannot be reached, its page says **Read-only preview**. In this mode no browser decision is persisted and mobile/server state is not shared.

Do not describe the self-contained mode as a live end-to-end backend run.

## 90-second connected walkthrough

1. Open the Android **Home** screen. Point out the connection status and that there is no manual synchronization action in the employee workflow.
2. Open **Profile → Reviewer controls** and choose **Simulate offline**. In ordinary use, the app follows device connectivity automatically.
3. Tap **Add hours**. Keep the default `8.0` regular + `1.5` overtime entry, or tap **Load 16.0 h review example** for the unusual-hours path.
4. Save. The proof slip appears only after SQLite commits both the entry and queued operation. The displayed local ID remains stable across retries.
5. Optionally close and relaunch the app. The proof and queued work remain unless app data is cleared or the demo is reset.
6. Choose **Automatic**. When device internet is available, the app sends due work and reconciles the server response automatically—there is no manual sync action. With the API configured, this creates a real isolated reviewer submission; without it, it is the documented local-demo transport.
7. For a 16-hour entry, open **Needs attention**, keep or edit the context note, and submit for review.
8. Open the web **Manager review** page and verify the status says **Connected record** before claiming persistence. In **Live mobile submissions**, select the entry you just synchronized; the inbox contains at most 25 recent summaries, newest-first, and the selected record's full detail loads separately. Do not confuse it with the separately labeled, read-only **Sample scenario**.
9. On the public URL, stop after inspection: it cannot record decisions. To demonstrate a mutation, open the separately supplied private reviewer capability link, verify the mobile submission's ID and hours, then choose **Approve** or **Return**. The command targets that exact timesheet ID. **Approve** appends the decision and produces API receipt metadata. **Return** requires a manager note and appends that decision instead.
10. Keep Android's **Timesheet** screen visible for its 12-second decision reconciliation, bring the app to the foreground while online, or allow the next automatic online pass to run. Approval changes the entry to **Payroll ready**. Return changes it to **Returned by manager** and leaves it read-only; this demo has no correction/resubmit workflow.
11. Refresh the manager page. In connected mode, the decision remains for the life of the configured repository. PostgreSQL survives API restarts; the in-memory repository does not.

## Recovery path worth demonstrating

The most important failure is an uncertain create result:

1. Android sends `POST /v1/reviewer/time-entries` with a stable `Idempotency-Key`.
2. If the request reports an error after the server may have committed it, mobile asks `GET /v1/operations/:key`.
3. When found, the original result is applied locally; no second entry is created.
4. When not found, the queue enters `WAITING_RETRY`, records the error, and retries after an exponential delay.
5. The API tests also prove that replaying the same key and payload returns the first result, while reusing the key for another payload returns `409`.

The demo does not include a UI button that deliberately drops a server response. This recovery path is implemented in the sync client and covered by protocol/API tests rather than being presented as a staged visual effect.

## Approval receipt: precise claim

After an authorized connected approval, the API record contains a real receipt ID and approval timestamp. Mobile reconciliation fetches the matching isolated timesheet during automatic sync, on foreground, or every 12 seconds while the Timesheet screen is visible; it stores the API receipt ID and marks that local entry `PAYROLL_READY`.

After an authorized return, Android preserves `RETURNED` as a terminal, read-only status. The demo intentionally does not claim an edit-and-resubmit workflow.

The current polished mobile receipt screen uses fixed Sarah Chen demo copy for its visible period, timestamp, and receipt label. Present that screen as the intended receipt experience, not as proof that every displayed field was dynamically populated by the manager action.

## Suggested explanation

> ShiftProof is a narrow reliability demo. The employee can save time evidence before connectivity returns because the entry and outbound command are committed together in SQLite. When the device reconnects, a stable idempotency key makes create retries safe and creates an isolated reviewer submission. The public manager page can inspect recent synthetic submissions; a private reviewer capability authorizes a decision on the exact record without erasing the employee's evidence. Android then reconciles approval to Payroll ready or preserves a return as read-only. The Sarah Chen sample and every person, hour, note, threshold, identifier, and decision are synthetic. This is independent portfolio software, not Wagepoint software or a payroll engine.

## Reviewer checks

- **Saved locally** corresponds to a completed SQLite transaction, not optimistic UI copy.
- Normal synchronization follows actual device reachability. The offline simulator lives only under **Reviewer controls** and is not part of the employee's everyday workflow.
- A connected mobile save appears under **Live mobile submissions**; the inbox is limited to 25 lightweight recent summaries and full detail is fetched for the selected ID.
- The public manager URL can inspect but cannot mutate. A production decision requires the private reviewer capability link and targets the exact selected ID.
- The deterministic Sarah Chen record remains visibly labeled **Sample scenario**, is always read-only, and is not evidence of the newly created mobile record.
- Status always uses text and shape, not color alone.
- **Connected record** and **Read-only preview** make web persistence explicit.
- Android reconciles while online automatically, on foreground, and every 12 seconds while Timesheet is visible. A returned entry stays read-only; resubmission is outside this demo.
- The 16-hour threshold is labeled as a demo heuristic, never a legal or payroll rule.
- The in-memory API resets on restart; PostgreSQL is the persistent mode.
- All names, records, notes, identifiers, and decisions are synthetic.
- The project is independent and unaffiliated with Wagepoint; it is not Wagepoint software or a payroll engine.

## Reset between reviews

- Mobile: use **Profile → Reset demo data** to restore the local seeded scenario. This clears local demo state; it does not delete already synchronized submissions from a persistent API.
- In-memory API: restart the API process.
- PostgreSQL: use a fresh demo database or rerun the intended seed/reset procedure; do not erase an environment that contains anything outside this synthetic demo.
- Browser preview: refresh the page.
