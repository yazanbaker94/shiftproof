import { randomUUID } from "node:crypto";

import { DEMO_IDS, DEMO_REVIEW_REASON } from "@shiftproof/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import { MemoryShiftProofRepository } from "../src/memory-repository.js";

const openApps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

async function testApp() {
  const app = await buildApp({
    repository: new MemoryShiftProofRepository(),
    corsOrigins: ["*"],
  });
  openApps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

describe("ShiftProof API", () => {
  it("reports the repository and labels the 16-hour rule as a demo heuristic", async () => {
    const app = await testApp();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      service: "shiftproof-api",
      storage: "memory",
      demo: { timesheetId: DEMO_IDS.timesheet },
    });
    expect(response.json().demo.reviewHeuristic).toContain("product-demo heuristic");
  });

  it("returns the same mutation for a safe retry and rejects key reuse with other data", async () => {
    const app = await testApp();
    const key = "offline-op-01928";
    const body = {
      clientId: randomUUID(),
      workDate: "2026-08-28",
      regularMinutes: 480,
      overtimeMinutes: 90,
      note: "Covered close",
    };

    const first = await app.inject({
      method: "POST",
      url: "/v1/time-entries",
      headers: { "idempotency-key": key },
      payload: body,
    });
    const retry = await app.inject({
      method: "POST",
      url: "/v1/time-entries",
      headers: { "idempotency-key": key },
      payload: { ...body },
    });
    const collision = await app.inject({
      method: "POST",
      url: "/v1/time-entries",
      headers: { "idempotency-key": key },
      payload: { ...body, overtimeMinutes: 60 },
    });

    expect(first.statusCode).toBe(201);
    expect(retry.statusCode).toBe(201);
    expect(retry.headers["idempotent-replayed"]).toBe("true");
    expect(retry.json()).toEqual(first.json());
    expect(collision.statusCode).toBe(409);
    expect(collision.json().error.code).toBe("IDEMPOTENCY_KEY_REUSED");

    const operation = await app.inject({
      method: "GET",
      url: `/v1/operations/${key}`,
    });
    expect(operation.statusCode).toBe(200);
    expect(operation.json()).toMatchObject({
      data: {
        key,
        status: "succeeded",
        responseStatus: 201,
        response: first.json(),
      },
    });
  });

  it("flags exactly 16 hours, preserves review evidence, confirms, and approves", async () => {
    const app = await testApp();
    const create = await app.inject({
      method: "POST",
      url: "/v1/time-entries",
      headers: { "idempotency-key": "unusual-op-01929" },
      payload: {
        clientId: randomUUID(),
        workDate: "2026-08-29",
        regularMinutes: 900,
        overtimeMinutes: 60,
        note: "Covered an unexpected absence",
      },
    });

    expect(create.statusCode).toBe(201);
    const createdEntry = create.json().data.entry;
    expect(createdEntry).toMatchObject({
      totalHours: 16,
      regularMinutes: 900,
      overtimeMinutes: 60,
      requiresReview: true,
      status: "needs_attention",
      reviewReason: DEMO_REVIEW_REASON,
    });

    const confirm = await app.inject({
      method: "POST",
      url: `/v1/time-entries/${createdEntry.id}/confirm`,
      payload: { note: "I confirm the double shift is correct" },
    });
    expect(confirm.statusCode).toBe(200);
    expect(confirm.json().data.entry.status).toBe("confirmed");

    const approve = await app.inject({
      method: "POST",
      url: "/v1/timesheets/demo/approve",
      payload: { note: "Manager checked the coverage note" },
    });
    expect(approve.statusCode).toBe(200);
    expect(approve.json().data).toMatchObject({
      id: DEMO_IDS.timesheet,
      status: "approved",
      receiptId: "SP-82F14",
    });
    expect(approve.json().data.approvedAt).toBeTruthy();

    const eventTypes = approve.json().data.events.map(
      (event: { type: string }) => event.type,
    );
    expect(eventTypes).toContain("UNUSUAL_HOURS_FLAGGED");
    expect(eventTypes).toContain("UNUSUAL_HOURS_CONFIRMED");
    expect(eventTypes.at(-1)).toBe("TIMESHEET_APPROVED");
    const actions = approve.json().data.revisions.map(
      (revision: { action: string }) => revision.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining([
        "TIME_ENTRY_CREATED",
        "UNUSUAL_HOURS_CONFIRMED",
        "TIMESHEET_APPROVED",
      ]),
    );
  });

  it("returns a timesheet with an append-only manager reason", async () => {
    const app = await testApp();
    const returned = await app.inject({
      method: "POST",
      url: "/v1/timesheets/demo/return",
      payload: { note: "Please attach the shift coverage note" },
    });

    expect(returned.statusCode).toBe(200);
    expect(returned.json().data.status).toBe("returned");
    expect(returned.json().data.events.at(-1)).toMatchObject({
      type: "TIMESHEET_RETURNED",
      payload: { note: "Please attach the shift coverage note" },
    });
    expect(returned.json().data.revisions.at(-1)).toMatchObject({
      action: "TIMESHEET_RETURNED",
      note: "Please attach the shift coverage note",
    });
  });
});
