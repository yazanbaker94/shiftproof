import { randomUUID } from "node:crypto";

import {
  DEMO_IDS,
  DEMO_REVIEW_REASON,
  DEMO_REVIEW_THRESHOLD_HOURS,
  type ApproveTimesheetBody,
  type ConfirmTimeEntryBody,
  type CreateTimeEntryBody,
  type IdempotencyOperation,
  type ReturnTimesheetBody,
  type TimeEntry,
  type Timesheet,
  type TimesheetEvent,
  type TimesheetRevision,
} from "@shiftproof/contracts";

import { DomainError } from "./errors.js";
import {
  createOperation,
  type EntryMutationResult,
  type IdempotentCreateResult,
  type ShiftProofRepository,
} from "./repository.js";

const iso = (value: string) => new Date(value).toISOString();
const nowIso = () => new Date().toISOString();
const roundHours = (value: number) => Math.round(value * 100) / 100;
const clone = <T>(value: T): T => structuredClone(value);

const ENTRY_IDS = {
  monday: "82f14000-0000-4000-8000-000000000011",
  thursday: "82f14000-0000-4000-8000-000000000012",
  wednesday: "82f14000-0000-4000-8000-000000000013",
} as const;

function seededEntry(
  id: string,
  workDate: string,
  regularHours: number,
  status: TimeEntry["status"] = "synced",
): TimeEntry {
  const timestamp = iso(`${workDate}T22:00:00Z`);
  const requiresReview = regularHours >= DEMO_REVIEW_THRESHOLD_HOURS;
  return {
    id,
    clientId: id.replace("-8000-", "-9000-"),
    timesheetId: DEMO_IDS.timesheet,
    employeeId: DEMO_IDS.employee,
    workDate,
    regularMinutes: Math.round(regularHours * 60),
    overtimeMinutes: 0,
    regularHours,
    overtimeHours: 0,
    totalHours: regularHours,
    note: requiresReview ? "Emergency inventory count after closing." : null,
    status,
    requiresReview,
    reviewReason: requiresReview ? DEMO_REVIEW_REASON : null,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildSeedTimesheet(): Timesheet {
  const createdAt = iso("2026-08-24T13:00:00Z");
  const updatedAt = iso("2026-08-27T22:00:00Z");
  const entries = [
    seededEntry(ENTRY_IDS.monday, "2026-08-24", 8),
    seededEntry(
      DEMO_IDS.unusualEntry,
      "2026-08-25",
      16,
      "needs_attention",
    ),
    seededEntry(ENTRY_IDS.wednesday, "2026-08-26", 8),
    seededEntry(ENTRY_IDS.thursday, "2026-08-27", 7.5),
  ];

  const events: TimesheetEvent[] = entries.map((entry, index) => ({
    id: `82f14000-0000-4000-8000-00000000002${index + 1}`,
    sequence: index + 1,
    type: entry.requiresReview ? "UNUSUAL_HOURS_FLAGGED" : "TIME_ENTRY_SYNCED",
    actorId: DEMO_IDS.employee,
    payload: {
      entryId: entry.id,
      workDate: entry.workDate,
      totalHours: entry.totalHours,
      ...(entry.requiresReview
        ? {
            reviewReason: DEMO_REVIEW_REASON,
            explanation:
              "Demo heuristic: a daily total of 16 hours or more needs a human review.",
          }
        : {}),
    },
    createdAt: entry.updatedAt,
  }));

  return {
    id: DEMO_IDS.timesheet,
    employee: { id: DEMO_IDS.employee, name: "Sarah Chen" },
    period: {
      start: "2026-08-24",
      end: "2026-09-06",
      label: "Aug 24–Sep 06",
    },
    status: "needs_attention",
    totals: { regular: 39.5, overtime: 0, all: 39.5 },
    entries,
    events,
    revisions: [
      {
        id: "82f14000-0000-4000-8000-000000000031",
        revision: 1,
        status: "needs_attention",
        action: "SEED_SNAPSHOT",
        actorId: null,
        note: "Deterministic hiring-demo data",
        createdAt: updatedAt,
      },
    ],
    revision: 1,
    receiptId: null,
    approvedAt: null,
    createdAt,
    updatedAt,
  };
}

export class MemoryShiftProofRepository implements ShiftProofRepository {
  private readonly timesheets = new Map<string, Timesheet>();
  private readonly operations = new Map<string, IdempotencyOperation>();

  constructor(options: { seed?: boolean } = { seed: true }) {
    if (options.seed !== false) {
      const timesheet = buildSeedTimesheet();
      this.timesheets.set(timesheet.id, timesheet);
    }
  }

  async health() {
    return { ok: true, storage: "memory" as const };
  }

  async getOperation(key: string) {
    const operation = this.operations.get(key);
    return operation ? clone(operation) : null;
  }

  async ensureReviewerTimesheet(
    id: string,
    employeeId: string,
    workDate: string,
  ): Promise<void> {
    if (this.timesheets.has(id)) return;
    const timestamp = nowIso();
    this.timesheets.set(id, {
      id,
      employee: { id: employeeId, name: "Sarah Chen" },
      period: {
        start: workDate,
        end: workDate,
        label: `Reviewer run / ${workDate}`,
      },
      status: "draft",
      totals: { regular: 0, overtime: 0, all: 0 },
      entries: [],
      events: [],
      revisions: [
        {
          id: randomUUID(),
          revision: 1,
          status: "draft",
          action: "REVIEWER_RUN_CREATED",
          actorId: employeeId,
          note: "Isolated mobile reviewer run",
          createdAt: timestamp,
        },
      ],
      revision: 1,
      receiptId: null,
      approvedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  async createTimeEntryIdempotent(
    body: CreateTimeEntryBody,
    operationKey: string,
    hash: string,
  ): Promise<IdempotentCreateResult> {
    const existingOperation = this.operations.get(operationKey);
    if (existingOperation) {
      return {
        kind: existingOperation.requestHash === hash ? "replayed" : "conflict",
        operation: clone(existingOperation),
      };
    }

    const timesheet = this.requireTimesheet(body.timesheetId);
    this.assertEntryCanBeCreated(timesheet, body);

    const timestamp = nowIso();
    const regularHours = roundHours(body.regularMinutes / 60);
    const overtimeHours = roundHours(body.overtimeMinutes / 60);
    const totalHours = roundHours((body.regularMinutes + body.overtimeMinutes) / 60);
    const requiresReview = totalHours >= DEMO_REVIEW_THRESHOLD_HOURS;
    const entry: TimeEntry = {
      id: randomUUID(),
      clientId: body.clientId,
      timesheetId: body.timesheetId,
      employeeId: body.employeeId,
      workDate: body.workDate,
      regularMinutes: body.regularMinutes,
      overtimeMinutes: body.overtimeMinutes,
      regularHours,
      overtimeHours,
      totalHours,
      note: body.note?.trim() || null,
      status: requiresReview ? "needs_attention" : "synced",
      requiresReview,
      reviewReason: requiresReview ? DEMO_REVIEW_REASON : null,
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    timesheet.entries.push(entry);
    timesheet.entries.sort((left, right) =>
      left.workDate.localeCompare(right.workDate),
    );
    if (requiresReview) {
      timesheet.status = "needs_attention";
    } else if (timesheet.status === "returned") {
      timesheet.status = "draft";
    }
    this.refreshTimesheet(timesheet, timestamp);
    this.appendEvent(timesheet, {
      type: requiresReview ? "UNUSUAL_HOURS_FLAGGED" : "TIME_ENTRY_SYNCED",
      actorId: body.employeeId,
      payload: {
        entryId: entry.id,
        workDate: entry.workDate,
        totalHours,
        ...(requiresReview
          ? {
              reviewReason: DEMO_REVIEW_REASON,
              explanation:
                "Demo heuristic: a daily total of 16 hours or more needs a human review.",
            }
          : {}),
      },
      createdAt: timestamp,
    });
    this.appendRevision(
      timesheet,
      "TIME_ENTRY_CREATED",
      body.employeeId,
      body.note?.trim() || null,
      timestamp,
    );

    const response = {
      data: {
        entry: clone(entry),
        timesheet: clone(timesheet),
        operationKey,
      },
    };
    const operation = createOperation(operationKey, hash, response, timestamp);
    this.operations.set(operationKey, operation);
    return { kind: "created", operation: clone(operation) };
  }

  async getTimesheet(id: string) {
    const timesheet = this.timesheets.get(id);
    return timesheet ? clone(timesheet) : null;
  }

  async confirmTimeEntry(
    id: string,
    body: ConfirmTimeEntryBody,
  ): Promise<EntryMutationResult> {
    const timesheet = this.findTimesheetForEntry(id);
    const entry = timesheet.entries.find((candidate) => candidate.id === id)!;
    if (entry.employeeId !== body.employeeId) {
      throw new DomainError(
        403,
        "EMPLOYEE_MISMATCH",
        "Only the employee who owns this entry can confirm it",
      );
    }
    if (!entry.requiresReview) {
      throw new DomainError(
        409,
        "ENTRY_NOT_REVIEWABLE",
        "This entry does not require an unusual-hours confirmation",
      );
    }
    if (entry.status === "confirmed") {
      return { entry: clone(entry), timesheet: clone(timesheet) };
    }

    const timestamp = nowIso();
    entry.status = "confirmed";
    entry.revision += 1;
    entry.updatedAt = timestamp;
    this.refreshTimesheet(timesheet, timestamp);
    this.appendEvent(timesheet, {
      type: "UNUSUAL_HOURS_CONFIRMED",
      actorId: body.employeeId,
      payload: { entryId: entry.id, note: body.note },
      createdAt: timestamp,
    });
    this.appendRevision(
      timesheet,
      "UNUSUAL_HOURS_CONFIRMED",
      body.employeeId,
      body.note,
      timestamp,
    );
    return { entry: clone(entry), timesheet: clone(timesheet) };
  }

  async approveTimesheet(id: string, body: ApproveTimesheetBody) {
    const timesheet = this.requireTimesheet(id);
    if (timesheet.status === "approved") {
      return clone(timesheet);
    }

    const timestamp = nowIso();
    timesheet.status = "approved";
    timesheet.approvedAt = timestamp;
    timesheet.receiptId =
      timesheet.id === DEMO_IDS.timesheet
        ? "SP-82F14"
        : `SP-${timesheet.id.replaceAll("-", "").slice(0, 5).toUpperCase()}`;
    this.refreshTimesheet(timesheet, timestamp);
    this.appendEvent(timesheet, {
      type: "TIMESHEET_APPROVED",
      actorId: body.managerId,
      payload: { receiptId: timesheet.receiptId, note: body.note ?? null },
      createdAt: timestamp,
    });
    this.appendRevision(
      timesheet,
      "TIMESHEET_APPROVED",
      body.managerId,
      body.note?.trim() || null,
      timestamp,
    );
    return clone(timesheet);
  }

  async returnTimesheet(id: string, body: ReturnTimesheetBody) {
    const timesheet = this.requireTimesheet(id);
    if (timesheet.status === "approved") {
      throw new DomainError(
        409,
        "TIMESHEET_ALREADY_APPROVED",
        "An approved timesheet cannot be returned",
      );
    }

    const timestamp = nowIso();
    timesheet.status = "returned";
    this.refreshTimesheet(timesheet, timestamp);
    this.appendEvent(timesheet, {
      type: "TIMESHEET_RETURNED",
      actorId: body.managerId,
      payload: { note: body.note },
      createdAt: timestamp,
    });
    this.appendRevision(
      timesheet,
      "TIMESHEET_RETURNED",
      body.managerId,
      body.note,
      timestamp,
    );
    return clone(timesheet);
  }

  async close() {}

  private requireTimesheet(id: string) {
    const timesheet = this.timesheets.get(id);
    if (!timesheet) {
      throw new DomainError(404, "TIMESHEET_NOT_FOUND", "Timesheet not found");
    }
    return timesheet;
  }

  private findTimesheetForEntry(entryId: string) {
    const timesheet = [...this.timesheets.values()].find((candidate) =>
      candidate.entries.some((entry) => entry.id === entryId),
    );
    if (!timesheet) {
      throw new DomainError(404, "TIME_ENTRY_NOT_FOUND", "Time entry not found");
    }
    return timesheet;
  }

  private assertEntryCanBeCreated(
    timesheet: Timesheet,
    body: CreateTimeEntryBody,
  ) {
    if (timesheet.employee.id !== body.employeeId) {
      throw new DomainError(
        403,
        "EMPLOYEE_MISMATCH",
        "The employee does not own this timesheet",
      );
    }
    if (timesheet.status === "approved") {
      throw new DomainError(
        409,
        "TIMESHEET_ALREADY_APPROVED",
        "Hours cannot be added to an approved timesheet",
      );
    }
    if (
      body.workDate < timesheet.period.start ||
      body.workDate > timesheet.period.end
    ) {
      throw new DomainError(
        422,
        "DATE_OUTSIDE_PAY_PERIOD",
        "The entry date is outside this pay period",
      );
    }
    if (timesheet.entries.some((entry) => entry.workDate === body.workDate)) {
      throw new DomainError(
        409,
        "ENTRY_ALREADY_EXISTS",
        "An entry already exists for this date",
      );
    }
    if (timesheet.entries.some((entry) => entry.clientId === body.clientId)) {
      throw new DomainError(
        409,
        "CLIENT_ENTRY_ALREADY_EXISTS",
        "This device entry has already been reconciled",
      );
    }
  }

  private refreshTimesheet(timesheet: Timesheet, timestamp: string) {
    const regular = roundHours(
      timesheet.entries.reduce((sum, entry) => sum + entry.regularHours, 0),
    );
    const overtime = roundHours(
      timesheet.entries.reduce((sum, entry) => sum + entry.overtimeHours, 0),
    );
    timesheet.totals = { regular, overtime, all: roundHours(regular + overtime) };
    timesheet.updatedAt = timestamp;
  }

  private appendEvent(
    timesheet: Timesheet,
    event: Omit<TimesheetEvent, "id" | "sequence">,
  ) {
    timesheet.events.push({
      id: randomUUID(),
      sequence: timesheet.events.length + 1,
      ...event,
    });
  }

  private appendRevision(
    timesheet: Timesheet,
    action: string,
    actorId: string | null,
    note: string | null,
    createdAt: string,
  ) {
    timesheet.revision += 1;
    const revision: TimesheetRevision = {
      id: randomUUID(),
      revision: timesheet.revision,
      status: timesheet.status,
      action,
      actorId,
      note,
      createdAt,
    };
    timesheet.revisions.push(revision);
  }
}
