import type {
  ApproveTimesheetBody,
  ConfirmTimeEntryBody,
  CreateTimeEntryBody,
  CreateTimeEntryResponse,
  IdempotencyOperation,
  ReturnTimesheetBody,
  TimeEntry,
  Timesheet,
} from "@shiftproof/contracts";

export type IdempotentCreateResult =
  | {
      kind: "created" | "replayed";
      operation: IdempotencyOperation;
    }
  | {
      kind: "conflict";
      operation: IdempotencyOperation;
    };

export type EntryMutationResult = {
  entry: TimeEntry;
  timesheet: Timesheet;
};

export interface ShiftProofRepository {
  health(): Promise<{ ok: boolean; storage: "memory" | "postgres" }>;
  getOperation(key: string): Promise<IdempotencyOperation | null>;
  createTimeEntryIdempotent(
    body: CreateTimeEntryBody,
    operationKey: string,
    hash: string,
  ): Promise<IdempotentCreateResult>;
  getTimesheet(id: string): Promise<Timesheet | null>;
  confirmTimeEntry(
    id: string,
    body: ConfirmTimeEntryBody,
  ): Promise<EntryMutationResult>;
  approveTimesheet(id: string, body: ApproveTimesheetBody): Promise<Timesheet>;
  returnTimesheet(id: string, body: ReturnTimesheetBody): Promise<Timesheet>;
  close(): Promise<void>;
}

export function createOperation(
  key: string,
  hash: string,
  response: CreateTimeEntryResponse,
  now: string,
): IdempotencyOperation {
  return {
    key,
    requestHash: hash,
    operationType: "CREATE_TIME_ENTRY",
    status: "succeeded",
    responseStatus: 201,
    response,
    createdAt: now,
    updatedAt: now,
  };
}
