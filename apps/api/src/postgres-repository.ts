import { randomUUID } from "node:crypto";

import {
  DEMO_IDS,
  DEMO_REVIEW_REASON,
  DEMO_REVIEW_THRESHOLD_HOURS,
  IdempotencyOperationSchema,
  TimesheetSchema,
  type ApproveTimesheetBody,
  type ConfirmTimeEntryBody,
  type CreateTimeEntryBody,
  type IdempotencyOperation,
  type ReturnTimesheetBody,
  type TimeEntry,
  type Timesheet,
} from "@shiftproof/contracts";
import { Pool, type PoolClient } from "pg";

import { DomainError } from "./errors.js";
import {
  createOperation,
  type EntryMutationResult,
  type IdempotentCreateResult,
  type ShiftProofRepository,
} from "./repository.js";

type Queryable = Pool | PoolClient;

type TimesheetRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  period_start: string | Date;
  period_end: string | Date;
  period_label: string;
  status: Timesheet["status"];
  revision: number;
  receipt_id: string | null;
  approved_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type EntryRow = {
  id: string;
  client_id: string;
  timesheet_id: string;
  employee_id: string;
  entry_date: string | Date;
  regular_hours: string | number;
  overtime_hours: string | number;
  note: string | null;
  status: TimeEntry["status"];
  requires_review: boolean;
  review_reason: string | null;
  revision: number;
  created_at: string | Date;
  updated_at: string | Date;
};

type EventRow = {
  id: string;
  sequence: number;
  event_type: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: string | Date;
};

type RevisionRow = {
  id: string;
  revision: number;
  status: Timesheet["status"];
  action: string;
  actor_id: string | null;
  note: string | null;
  created_at: string | Date;
};

type OperationRow = {
  operation_key: string;
  request_hash: string;
  operation_type: "CREATE_TIME_ENTRY";
  status: "pending" | "succeeded";
  response_status: number | null;
  response: unknown;
  created_at: string | Date;
  updated_at: string | Date;
};

function toIso(value: string | Date): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function toDateOnly(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

function toEntry(row: EntryRow): TimeEntry {
  const regularHours = Number(row.regular_hours);
  const overtimeHours = Number(row.overtime_hours);
  return {
    id: row.id,
    clientId: row.client_id,
    timesheetId: row.timesheet_id,
    employeeId: row.employee_id,
    workDate: toDateOnly(row.entry_date),
    regularMinutes: Math.round(regularHours * 60),
    overtimeMinutes: Math.round(overtimeHours * 60),
    regularHours,
    overtimeHours,
    totalHours: roundHours(regularHours + overtimeHours),
    note: row.note,
    status: row.status,
    requiresReview: row.requires_review,
    reviewReason: row.review_reason,
    revision: row.revision,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapOperation(row: OperationRow): IdempotencyOperation {
  if (row.status !== "succeeded" || row.response_status === null) {
    throw new DomainError(
      409,
      "OPERATION_IN_PROGRESS",
      "This operation has not completed yet",
    );
  }
  return IdempotencyOperationSchema.parse({
    key: row.operation_key,
    requestHash: row.request_hash.trim(),
    operationType: row.operation_type,
    status: row.status,
    responseStatus: row.response_status,
    response: row.response,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  });
}

export class PostgresShiftProofRepository implements ShiftProofRepository {
  constructor(private readonly pool: Pool) {}

  static fromConnectionString(connectionString: string) {
    return new PostgresShiftProofRepository(new Pool({ connectionString }));
  }

  async health() {
    await this.pool.query("SELECT 1");
    return { ok: true, storage: "postgres" as const };
  }

  async getOperation(key: string) {
    return this.getOperationWith(this.pool, key);
  }

  async ensureReviewerTimesheet(
    id: string,
    employeeId: string,
    workDate: string,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const timestamp = new Date().toISOString();
      await client.query(
        `INSERT INTO timesheets (
           id, employee_id, period_start, period_end, period_label, status,
           revision, created_at, updated_at
         ) VALUES ($1,$2,$3,$3,$4,'draft',1,$5,$5)
         ON CONFLICT (id) DO NOTHING`,
        [id, employeeId, workDate, `Reviewer run / ${workDate}`, timestamp],
      );
      await client.query(
        `INSERT INTO timesheet_revisions (
           id, timesheet_id, revision, status, action, actor_id, note, created_at
         ) VALUES ($1,$2,1,'draft','REVIEWER_RUN_CREATED',$3,$4,$5)
         ON CONFLICT (timesheet_id, revision) DO NOTHING`,
        [
          randomUUID(),
          id,
          employeeId,
          "Isolated mobile reviewer run",
          timestamp,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createTimeEntryIdempotent(
    body: CreateTimeEntryBody,
    operationKey: string,
    hash: string,
  ): Promise<IdempotentCreateResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const timestamp = new Date().toISOString();
      const reservation = await client.query<{ operation_key: string }>(
        `INSERT INTO idempotency_operations (
           operation_key, request_hash, operation_type, status, created_at, updated_at
         ) VALUES ($1, $2, 'CREATE_TIME_ENTRY', 'pending', $3, $3)
         ON CONFLICT (operation_key) DO NOTHING
         RETURNING operation_key`,
        [operationKey, hash, timestamp],
      );

      if (reservation.rowCount === 0) {
        const existing = await this.getOperationWith(client, operationKey);
        if (!existing) {
          throw new Error("Idempotency reservation disappeared");
        }
        await client.query("COMMIT");
        return {
          kind: existing.requestHash === hash ? "replayed" : "conflict",
          operation: existing,
        };
      }

      await client.query("SELECT id FROM timesheets WHERE id = $1 FOR UPDATE", [
        body.timesheetId,
      ]);
      const timesheet = await this.getTimesheetWith(client, body.timesheetId);
      if (!timesheet) {
        throw new DomainError(404, "TIMESHEET_NOT_FOUND", "Timesheet not found");
      }
      this.assertEntryCanBeCreated(timesheet, body);

      const entryId = randomUUID();
      const regularHours = roundHours(body.regularMinutes / 60);
      const overtimeHours = roundHours(body.overtimeMinutes / 60);
      const totalHours = roundHours(
        (body.regularMinutes + body.overtimeMinutes) / 60,
      );
      const requiresReview = totalHours >= DEMO_REVIEW_THRESHOLD_HOURS;
      const status = requiresReview ? "needs_attention" : "synced";
      const reviewReason = requiresReview ? DEMO_REVIEW_REASON : null;

      await client.query(
        `INSERT INTO time_entries (
           id, client_id, timesheet_id, employee_id, entry_date,
           regular_hours, overtime_hours, note, status, requires_review,
           review_reason, revision, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1,$12,$12)`,
        [
          entryId,
          body.clientId,
          body.timesheetId,
          body.employeeId,
          body.workDate,
          regularHours,
          overtimeHours,
          body.note?.trim() || null,
          status,
          requiresReview,
          reviewReason,
          timestamp,
        ],
      );
      await client.query(
        `INSERT INTO time_entry_revisions (
           id, time_entry_id, revision, regular_hours, overtime_hours, note,
           status, requires_review, review_reason, actor_id, action, created_at
         ) VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8,$9,'TIME_ENTRY_CREATED',$10)`,
        [
          randomUUID(),
          entryId,
          regularHours,
          overtimeHours,
          body.note?.trim() || null,
          status,
          requiresReview,
          reviewReason,
          body.employeeId,
          timestamp,
        ],
      );

      const update = await client.query<{
        revision: number;
        status: Timesheet["status"];
      }>(
        `UPDATE timesheets
           SET status = CASE
                 WHEN $2::boolean THEN 'needs_attention'
                 WHEN status = 'returned' THEN 'draft'
                 ELSE status
               END,
               revision = revision + 1,
               updated_at = $3
         WHERE id = $1
         RETURNING revision, status`,
        [body.timesheetId, requiresReview, timestamp],
      );

      await this.insertEvent(client, body.timesheetId, {
        type: requiresReview ? "UNUSUAL_HOURS_FLAGGED" : "TIME_ENTRY_SYNCED",
        actorId: body.employeeId,
        payload: {
          entryId,
          clientId: body.clientId,
          workDate: body.workDate,
          totalHours,
          ...(requiresReview
            ? {
                reviewReason: DEMO_REVIEW_REASON,
                explanation:
                  "Demo heuristic: a daily total of 16 hours or more needs a human review.",
              }
            : {}),
        },
        timestamp,
      });
      const changedTimesheet = update.rows[0];
      if (!changedTimesheet) throw new Error("Timesheet update failed");
      await this.insertTimesheetRevision(client, {
        timesheetId: body.timesheetId,
        revision: changedTimesheet.revision,
        status: changedTimesheet.status,
        action: "TIME_ENTRY_CREATED",
        actorId: body.employeeId,
        note: body.note?.trim() || null,
        timestamp,
      });

      const current = await this.getTimesheetWith(client, body.timesheetId);
      if (!current) throw new Error("Timesheet disappeared after entry creation");
      const entry = current.entries.find((candidate) => candidate.id === entryId);
      if (!entry) throw new Error("Created entry could not be loaded");
      const response = {
        data: { entry, timesheet: current, operationKey },
      };
      await client.query(
        `UPDATE idempotency_operations
            SET status = 'succeeded', response_status = 201, response = $2::jsonb,
                updated_at = $3
          WHERE operation_key = $1`,
        [operationKey, JSON.stringify(response), timestamp],
      );
      const operation = createOperation(operationKey, hash, response, timestamp);
      await client.query("COMMIT");
      return { kind: "created", operation };
    } catch (error) {
      await client.query("ROLLBACK");
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        throw new DomainError(
          409,
          "ENTRY_ALREADY_EXISTS",
          "An entry already exists for this date or device record",
        );
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async getTimesheet(id: string) {
    return this.getTimesheetWith(this.pool, id);
  }

  async confirmTimeEntry(
    id: string,
    body: ConfirmTimeEntryBody,
  ): Promise<EntryMutationResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query<
        EntryRow & { timesheet_status: Timesheet["status"] }
      >(
        `SELECT te.*, ts.status AS timesheet_status
           FROM time_entries te
           JOIN timesheets ts ON ts.id = te.timesheet_id
          WHERE te.id = $1
          FOR UPDATE OF te, ts`,
        [id],
      );
      const row = locked.rows[0];
      if (!row) {
        throw new DomainError(404, "TIME_ENTRY_NOT_FOUND", "Time entry not found");
      }
      if (row.employee_id !== body.employeeId) {
        throw new DomainError(
          403,
          "EMPLOYEE_MISMATCH",
          "Only the employee who owns this entry can confirm it",
        );
      }
      if (!row.requires_review) {
        throw new DomainError(
          409,
          "ENTRY_NOT_REVIEWABLE",
          "This entry does not require an unusual-hours confirmation",
        );
      }
      if (row.status === "confirmed") {
        const current = await this.getTimesheetWith(client, row.timesheet_id);
        if (!current) throw new Error("Timesheet disappeared");
        await client.query("COMMIT");
        return {
          entry: current.entries.find((entry) => entry.id === id)!,
          timesheet: current,
        };
      }

      const timestamp = new Date().toISOString();
      const entryUpdate = await client.query<EntryRow>(
        `UPDATE time_entries
            SET status = 'confirmed', revision = revision + 1, updated_at = $2
          WHERE id = $1
          RETURNING *`,
        [id, timestamp],
      );
      const changedEntry = entryUpdate.rows[0];
      if (!changedEntry) throw new Error("Time entry update failed");
      await this.insertEntryRevision(
        client,
        changedEntry,
        body.employeeId,
        "UNUSUAL_HOURS_CONFIRMED",
        timestamp,
      );
      const update = await this.bumpTimesheet(
        client,
        row.timesheet_id,
        timestamp,
      );
      await this.insertEvent(client, row.timesheet_id, {
        type: "UNUSUAL_HOURS_CONFIRMED",
        actorId: body.employeeId,
        payload: { entryId: id, note: body.note },
        timestamp,
      });
      await this.insertTimesheetRevision(client, {
        timesheetId: row.timesheet_id,
        revision: update.revision,
        status: update.status,
        action: "UNUSUAL_HOURS_CONFIRMED",
        actorId: body.employeeId,
        note: body.note,
        timestamp,
      });
      const current = await this.getTimesheetWith(client, row.timesheet_id);
      if (!current) throw new Error("Timesheet disappeared");
      await client.query("COMMIT");
      return {
        entry: current.entries.find((entry) => entry.id === id)!,
        timesheet: current,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async approveTimesheet(id: string, body: ApproveTimesheetBody) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query<TimesheetRow>(
        "SELECT * FROM timesheets WHERE id = $1 FOR UPDATE",
        [id],
      );
      const row = locked.rows[0];
      if (!row) {
        throw new DomainError(404, "TIMESHEET_NOT_FOUND", "Timesheet not found");
      }
      if (row.status === "approved") {
        const current = await this.getTimesheetWith(client, id);
        if (!current) throw new Error("Timesheet disappeared");
        await client.query("COMMIT");
        return current;
      }

      const timestamp = new Date().toISOString();
      const receiptId =
        id === DEMO_IDS.timesheet
          ? "SP-82F14"
          : `SP-${id.replaceAll("-", "").slice(0, 5).toUpperCase()}`;
      const update = await client.query<{
        revision: number;
        status: Timesheet["status"];
      }>(
        `UPDATE timesheets
            SET status = 'approved', approved_at = $2, receipt_id = $3,
                revision = revision + 1, updated_at = $2
          WHERE id = $1
          RETURNING revision, status`,
        [id, timestamp, receiptId],
      );
      const changed = update.rows[0];
      if (!changed) throw new Error("Timesheet update failed");
      await this.insertEvent(client, id, {
        type: "TIMESHEET_APPROVED",
        actorId: body.managerId,
        payload: { receiptId, note: body.note ?? null },
        timestamp,
      });
      await this.insertTimesheetRevision(client, {
        timesheetId: id,
        revision: changed.revision,
        status: changed.status,
        action: "TIMESHEET_APPROVED",
        actorId: body.managerId,
        note: body.note?.trim() || null,
        timestamp,
      });
      const current = await this.getTimesheetWith(client, id);
      if (!current) throw new Error("Timesheet disappeared");
      await client.query("COMMIT");
      return current;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async returnTimesheet(id: string, body: ReturnTimesheetBody) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query<TimesheetRow>(
        "SELECT * FROM timesheets WHERE id = $1 FOR UPDATE",
        [id],
      );
      const row = locked.rows[0];
      if (!row) {
        throw new DomainError(404, "TIMESHEET_NOT_FOUND", "Timesheet not found");
      }
      if (row.status === "approved") {
        throw new DomainError(
          409,
          "TIMESHEET_ALREADY_APPROVED",
          "An approved timesheet cannot be returned",
        );
      }

      const timestamp = new Date().toISOString();
      const update = await client.query<{
        revision: number;
        status: Timesheet["status"];
      }>(
        `UPDATE timesheets
            SET status = 'returned', revision = revision + 1, updated_at = $2
          WHERE id = $1
          RETURNING revision, status`,
        [id, timestamp],
      );
      const changed = update.rows[0];
      if (!changed) throw new Error("Timesheet update failed");
      await this.insertEvent(client, id, {
        type: "TIMESHEET_RETURNED",
        actorId: body.managerId,
        payload: { note: body.note },
        timestamp,
      });
      await this.insertTimesheetRevision(client, {
        timesheetId: id,
        revision: changed.revision,
        status: changed.status,
        action: "TIMESHEET_RETURNED",
        actorId: body.managerId,
        note: body.note,
        timestamp,
      });
      const current = await this.getTimesheetWith(client, id);
      if (!current) throw new Error("Timesheet disappeared");
      await client.query("COMMIT");
      return current;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }

  private async getOperationWith(queryable: Queryable, key: string) {
    const result = await queryable.query<OperationRow>(
      `SELECT operation_key, request_hash, operation_type, status,
              response_status, response, created_at, updated_at
         FROM idempotency_operations
        WHERE operation_key = $1`,
      [key],
    );
    const row = result.rows[0];
    return row ? mapOperation(row) : null;
  }

  private async getTimesheetWith(
    queryable: Queryable,
    id: string,
  ): Promise<Timesheet | null> {
    const headerResult = await queryable.query<TimesheetRow>(
      `SELECT ts.*, e.name AS employee_name
         FROM timesheets ts
         JOIN employees e ON e.id = ts.employee_id
        WHERE ts.id = $1`,
      [id],
    );
    const header = headerResult.rows[0];
    if (!header) return null;

    const [entryResult, eventResult, revisionResult] = await Promise.all([
      queryable.query<EntryRow>(
        "SELECT * FROM time_entries WHERE timesheet_id = $1 ORDER BY entry_date, created_at",
        [id],
      ),
      queryable.query<EventRow>(
        `SELECT id, sequence, event_type, actor_id, payload, created_at
           FROM timesheet_events WHERE timesheet_id = $1 ORDER BY sequence`,
        [id],
      ),
      queryable.query<RevisionRow>(
        `SELECT id, revision, status, action, actor_id, note, created_at
           FROM timesheet_revisions WHERE timesheet_id = $1 ORDER BY revision`,
        [id],
      ),
    ]);
    const entries = entryResult.rows.map(toEntry);
    const regular = roundHours(
      entries.reduce((sum, entry) => sum + entry.regularHours, 0),
    );
    const overtime = roundHours(
      entries.reduce((sum, entry) => sum + entry.overtimeHours, 0),
    );
    return TimesheetSchema.parse({
      id: header.id,
      employee: { id: header.employee_id, name: header.employee_name },
      period: {
        start: toDateOnly(header.period_start),
        end: toDateOnly(header.period_end),
        label: header.period_label,
      },
      status: header.status,
      totals: { regular, overtime, all: roundHours(regular + overtime) },
      entries,
      events: eventResult.rows.map((event) => ({
        id: event.id,
        sequence: Number(event.sequence),
        type: event.event_type,
        actorId: event.actor_id,
        payload: event.payload,
        createdAt: toIso(event.created_at),
      })),
      revisions: revisionResult.rows.map((revision) => ({
        id: revision.id,
        revision: revision.revision,
        status: revision.status,
        action: revision.action,
        actorId: revision.actor_id,
        note: revision.note,
        createdAt: toIso(revision.created_at),
      })),
      revision: header.revision,
      receiptId: header.receipt_id,
      approvedAt: header.approved_at ? toIso(header.approved_at) : null,
      createdAt: toIso(header.created_at),
      updatedAt: toIso(header.updated_at),
    });
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

  private async insertEntryRevision(
    client: PoolClient,
    entry: EntryRow,
    actorId: string,
    action: string,
    timestamp: string,
  ) {
    await client.query(
      `INSERT INTO time_entry_revisions (
         id, time_entry_id, revision, regular_hours, overtime_hours, note,
         status, requires_review, review_reason, actor_id, action, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        randomUUID(),
        entry.id,
        entry.revision,
        entry.regular_hours,
        entry.overtime_hours,
        entry.note,
        entry.status,
        entry.requires_review,
        entry.review_reason,
        actorId,
        action,
        timestamp,
      ],
    );
  }

  private async insertEvent(
    client: PoolClient,
    timesheetId: string,
    event: {
      type: string;
      actorId: string;
      payload: Record<string, unknown>;
      timestamp: string;
    },
  ) {
    await client.query(
      `INSERT INTO timesheet_events (
         id, timesheet_id, sequence, event_type, actor_id, payload, created_at
       )
       SELECT $1, $2, COALESCE(MAX(sequence), 0) + 1, $3, $4, $5::jsonb, $6
         FROM timesheet_events WHERE timesheet_id = $2`,
      [
        randomUUID(),
        timesheetId,
        event.type,
        event.actorId,
        JSON.stringify(event.payload),
        event.timestamp,
      ],
    );
  }

  private async insertTimesheetRevision(
    client: PoolClient,
    revision: {
      timesheetId: string;
      revision: number;
      status: Timesheet["status"];
      action: string;
      actorId: string;
      note: string | null;
      timestamp: string;
    },
  ) {
    await client.query(
      `INSERT INTO timesheet_revisions (
         id, timesheet_id, revision, status, action, actor_id, note, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        randomUUID(),
        revision.timesheetId,
        revision.revision,
        revision.status,
        revision.action,
        revision.actorId,
        revision.note,
        revision.timestamp,
      ],
    );
  }

  private async bumpTimesheet(
    client: PoolClient,
    timesheetId: string,
    timestamp: string,
  ) {
    const result = await client.query<{
      revision: number;
      status: Timesheet["status"];
    }>(
      `UPDATE timesheets SET revision = revision + 1, updated_at = $2
        WHERE id = $1 RETURNING revision, status`,
      [timesheetId, timestamp],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Timesheet update failed");
    return row;
  }
}
