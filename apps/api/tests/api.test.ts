import { randomUUID } from "node:crypto";

import {
  DEMO_IDS,
  DEMO_REVIEW_REASON,
  ReviewerTimesheetListResponseSchema,
} from "@shiftproof/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app.js";
import { MemoryShiftProofRepository } from "../src/memory-repository.js";

const openApps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

async function createTestApp(
  options: {
    allowSampleMutations?: boolean;
    reviewerAccessToken?: string;
  } = {},
) {
  const app = await buildApp({
    repository: new MemoryShiftProofRepository(),
    corsOrigins: ["*"],
    ...options,
  });
  openApps.push(app);
  return app;
}

async function testApp() {
  return createTestApp({ allowSampleMutations: true });
}

async function defaultPolicyApp() {
  return createTestApp();
}

afterEach(async () => {
  vi.useRealTimers();
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
      reviewerAccessRequired: false,
      demo: { timesheetId: DEMO_IDS.timesheet },
    });
    expect(response.json().demo.reviewHeuristic).toContain("product-demo heuristic");
  });

  it("keeps the shared sample read-only by default", async () => {
    const app = await defaultPolicyApp();
    const before = await app.inject({ method: "GET", url: "/v1/timesheets/demo" });

    const approve = await app.inject({
      method: "POST",
      url: "/v1/timesheets/demo/approve",
      payload: { note: "This must not change the public sample" },
    });
    const returned = await app.inject({
      method: "POST",
      url: `/v1/timesheets/${DEMO_IDS.timesheet}/return`,
      payload: { note: "This must not change the public sample" },
    });

    for (const response of [approve, returned]) {
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        error: {
          code: "SAMPLE_READ_ONLY",
          message: "The shared sample timesheet is read-only",
        },
      });
    }
    const after = await app.inject({ method: "GET", url: "/v1/timesheets/demo" });
    expect(after.json()).toEqual(before.json());
  });

  it("requires the configured reviewer token for exact approve and return decisions", async () => {
    const reviewerAccessToken = "reviewer-capability-test-secret";
    const app = await createTestApp({ reviewerAccessToken });
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.json().reviewerAccessRequired).toBe(true);

    const sample = await app.inject({
      method: "POST",
      url: "/v1/timesheets/demo/approve",
      payload: {},
    });
    expect(sample.statusCode).toBe(403);
    expect(sample.json().error.code).toBe("SAMPLE_READ_ONLY");

    for (const [index, decision] of ["approve", "return"].entries()) {
      const clientId = randomUUID();
      const created = await app.inject({
        method: "POST",
        url: "/v1/reviewer/time-entries",
        headers: { "idempotency-key": `reviewer-access-op-${index}` },
        payload: {
          clientId,
          workDate: `2026-09-0${index + 1}`,
          regularMinutes: 480,
          overtimeMinutes: 0,
          note: "Submitted from mobile",
        },
      });
      expect(created.statusCode).toBe(201);

      const decisionPayload =
        decision === "return" ? { note: "Please verify the shift note" } : {};
      const missing = await app.inject({
        method: "POST",
        url: `/v1/timesheets/${clientId}/${decision}`,
        payload: decisionPayload,
      });
      const wrong = await app.inject({
        method: "POST",
        url: `/v1/timesheets/${clientId}/${decision}`,
        headers: { "x-shiftproof-reviewer-token": "wrong-reviewer-token" },
        payload: decisionPayload,
      });

      for (const response of [missing, wrong]) {
        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({
          error: {
            code: "REVIEWER_ACCESS_REQUIRED",
            message: "A valid reviewer access token is required",
          },
        });
      }

      const beforeAuthorizedDecision = await app.inject({
        method: "GET",
        url: `/v1/timesheets/${clientId}`,
      });
      expect(beforeAuthorizedDecision.json().data.status).toBe("draft");

      const authorized = await app.inject({
        method: "POST",
        url: `/v1/timesheets/${clientId}/${decision}`,
        headers: { "x-shiftproof-reviewer-token": reviewerAccessToken },
        payload: decisionPayload,
      });
      expect(authorized.statusCode).toBe(200);
      expect(authorized.json().data).toMatchObject({
        id: clientId,
        status: decision === "approve" ? "approved" : "returned",
      });
    }
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

  it("syncs each mobile reviewer run without mutating an approved shared demo", async () => {
    const app = await testApp();
    const approved = await app.inject({
      method: "POST",
      url: "/v1/timesheets/demo/approve",
      payload: { note: "Keep the public manager example immutable" },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().data.status).toBe("approved");

    const clientId = randomUUID();
    const key = "reviewer-mobile-op-01930";
    const payload = {
      clientId,
      workDate: "2026-09-01",
      regularMinutes: 480,
      overtimeMinutes: 90,
      note: "Saved offline before reconnecting",
    };
    const created = await app.inject({
      method: "POST",
      url: "/v1/reviewer/time-entries",
      headers: { "idempotency-key": key },
      payload,
    });
    const replayed = await app.inject({
      method: "POST",
      url: "/v1/reviewer/time-entries",
      headers: { "idempotency-key": key },
      payload,
    });

    expect(created.statusCode).toBe(201);
    expect(created.json().data.entry).toMatchObject({
      clientId,
      timesheetId: clientId,
      status: "synced",
    });
    expect(created.json().data.timesheet).toMatchObject({
      id: clientId,
      status: "draft",
    });
    expect(replayed.statusCode).toBe(201);
    expect(replayed.headers["idempotent-replayed"]).toBe("true");
    expect(replayed.json()).toEqual(created.json());

    const secondClientId = randomUUID();
    const secondRun = await app.inject({
      method: "POST",
      url: "/v1/reviewer/time-entries",
      headers: { "idempotency-key": "reviewer-mobile-op-01931" },
      payload: { ...payload, clientId: secondClientId },
    });
    expect(secondRun.statusCode).toBe(201);
    expect(secondRun.json().data.entry.timesheetId).toBe(secondClientId);

    const reviewerRun = await app.inject({
      method: "GET",
      url: `/v1/timesheets/${clientId}`,
    });
    expect(reviewerRun.statusCode).toBe(200);
    expect(reviewerRun.json().data.entries).toHaveLength(1);

    const shared = await app.inject({ method: "GET", url: "/v1/timesheets/demo" });
    expect(shared.json().data.status).toBe("approved");
    expect(shared.json().data.entries).toHaveLength(4);

    const reserved = await app.inject({
      method: "POST",
      url: "/v1/reviewer/time-entries",
      headers: { "idempotency-key": "reviewer-mobile-op-01932" },
      payload: { ...payload, clientId: DEMO_IDS.timesheet },
    });
    expect(reserved.statusCode).toBe(409);
    expect(reserved.json().error.code).toBe("REVIEWER_RUN_ID_RESERVED");
  });

  it("lists isolated mobile submissions newest first and scopes approval to the selected run", async () => {
    const app = await defaultPolicyApp();
    const firstClientId = "c0000000-0000-4000-8000-000000000002";
    const secondClientId = "c0000000-0000-4000-8000-000000000001";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-01T10:00:00.000Z"));

    for (const [index, clientId] of [firstClientId, secondClientId].entries()) {
      vi.setSystemTime(new Date(`2026-09-01T10:0${index}:00.000Z`));
      const created = await app.inject({
        method: "POST",
        url: "/v1/reviewer/time-entries",
        headers: { "idempotency-key": `reviewer-inbox-op-${index}` },
        payload: {
          clientId,
          workDate: `2026-09-0${index + 1}`,
          regularMinutes: index === 0 ? 480 : 960,
          overtimeMinutes: 0,
          note: index === 0 ? "First mobile submission" : "Newest mobile submission",
        },
      });
      expect(created.statusCode).toBe(201);
    }

    const canonicalBefore = await app.inject({
      method: "GET",
      url: "/v1/timesheets/demo",
    });
    const untouchedSubmissionBefore = await app.inject({
      method: "GET",
      url: `/v1/timesheets/${firstClientId}`,
    });
    const response = await app.inject({
      method: "GET",
      url: "/v1/reviewer/timesheets",
    });

    expect(response.statusCode).toBe(200);
    const inbox = ReviewerTimesheetListResponseSchema.parse(response.json());
    expect(inbox.data.map((timesheet) => timesheet.id)).toEqual([
      secondClientId,
      firstClientId,
    ]);
    expect(inbox.data).toHaveLength(2);
    expect(inbox.data).not.toContainEqual(
      expect.objectContaining({ id: DEMO_IDS.timesheet }),
    );
    expect(inbox.data[0]).toMatchObject({
      id: secondClientId,
      employee: { id: DEMO_IDS.employee, name: "Sarah Chen" },
      period: {
        start: "2026-09-02",
        end: "2026-09-02",
        label: "Reviewer run / 2026-09-02",
      },
      status: "needs_attention",
      totals: { regular: 16, overtime: 0, all: 16 },
      entryCount: 1,
      createdAt: "2026-09-01T10:01:00.000Z",
      updatedAt: "2026-09-01T10:01:00.000Z",
    });
    expect(response.json().data[0]).not.toHaveProperty("entries");
    expect(response.json().data[0]).not.toHaveProperty("events");
    expect(response.json().data[0]).not.toHaveProperty("revisions");

    const limitedResponse = await app.inject({
      method: "GET",
      url: "/v1/reviewer/timesheets?limit=1",
    });
    expect(limitedResponse.statusCode).toBe(200);
    expect(limitedResponse.json().data.map((item: { id: string }) => item.id)).toEqual([
      secondClientId,
    ]);

    const overLimitResponse = await app.inject({
      method: "GET",
      url: "/v1/reviewer/timesheets?limit=26",
    });
    expect(overLimitResponse.statusCode).toBe(400);
    expect(overLimitResponse.json().error.code).toBe("INVALID_REQUEST");

    const selected = inbox.data[0];
    if (!selected) throw new Error("Expected a reviewer submission");
    const selectedId = selected.id;
    const approved = await app.inject({
      method: "POST",
      url: `/v1/timesheets/${selectedId}/approve`,
      payload: { note: "Approved from the reviewer inbox" },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().data).toMatchObject({
      id: selectedId,
      status: "approved",
    });
    expect(approved.json().data.receiptId).toBeTruthy();
    expect(approved.json().data.approvedAt).toBeTruthy();
    expect(approved.json().data.events.at(-1).type).toBe("TIMESHEET_APPROVED");

    const untouchedSubmission = await app.inject({
      method: "GET",
      url: `/v1/timesheets/${firstClientId}`,
    });
    expect(untouchedSubmission.json().data).toEqual(
      untouchedSubmissionBefore.json().data,
    );

    const canonicalAfter = await app.inject({
      method: "GET",
      url: "/v1/timesheets/demo",
    });
    expect(canonicalAfter.json().data).toEqual(canonicalBefore.json().data);
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
