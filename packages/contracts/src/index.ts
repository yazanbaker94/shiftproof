import { z } from "zod";

export const DEMO_IDS = {
  employee: "82f14000-0000-4000-8000-000000000002",
  manager: "82f14000-0000-4000-8000-000000000003",
  timesheet: "82f14000-0000-4000-8000-000000000001",
  unusualEntry: "82f14000-0000-4000-8000-000000000014",
} as const;

export const DEMO_REVIEW_THRESHOLD_HOURS = 16;
export const DEMO_REVIEW_REASON = "DEMO_HEURISTIC_16_HOURS" as const;

export const UuidSchema = z.string().uuid();
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD format");
export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export const HoursSchema = z.number().finite().min(0).max(24);

export const EmployeeSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1),
});

export const TimeEntryStatusSchema = z.enum([
  "synced",
  "needs_attention",
  "confirmed",
]);

export const TimeEntrySchema = z.object({
  id: UuidSchema,
  clientId: UuidSchema,
  timesheetId: UuidSchema,
  employeeId: UuidSchema,
  workDate: IsoDateSchema,
  regularMinutes: z.number().int().min(0).max(1_440),
  overtimeMinutes: z.number().int().min(0).max(1_440),
  regularHours: HoursSchema,
  overtimeHours: HoursSchema,
  totalHours: HoursSchema,
  note: z.string().max(500).nullable(),
  status: TimeEntryStatusSchema,
  requiresReview: z.boolean(),
  reviewReason: z.string().nullable(),
  revision: z.number().int().positive(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const TimesheetStatusSchema = z.enum([
  "draft",
  "needs_attention",
  "approved",
  "returned",
]);

export const HoursTotalsSchema = z.object({
  regular: z.number().finite().nonnegative(),
  overtime: z.number().finite().nonnegative(),
  all: z.number().finite().nonnegative(),
});

export const TimesheetEventSchema = z.object({
  id: UuidSchema,
  sequence: z.number().int().positive(),
  type: z.string().min(1),
  actorId: UuidSchema.nullable(),
  payload: z.record(z.unknown()),
  createdAt: IsoDateTimeSchema,
});

export const TimesheetRevisionSchema = z.object({
  id: UuidSchema,
  revision: z.number().int().positive(),
  status: TimesheetStatusSchema,
  action: z.string().min(1),
  actorId: UuidSchema.nullable(),
  note: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
});

export const TimesheetSchema = z.object({
  id: UuidSchema,
  employee: EmployeeSchema,
  period: z.object({
    start: IsoDateSchema,
    end: IsoDateSchema,
    label: z.string().min(1),
  }),
  status: TimesheetStatusSchema,
  totals: HoursTotalsSchema,
  entries: z.array(TimeEntrySchema),
  events: z.array(TimesheetEventSchema),
  revisions: z.array(TimesheetRevisionSchema),
  revision: z.number().int().positive(),
  receiptId: z.string().nullable(),
  approvedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const CreateTimeEntryBodySchema = z
  .object({
    clientId: UuidSchema,
    timesheetId: UuidSchema.default(DEMO_IDS.timesheet),
    employeeId: UuidSchema.default(DEMO_IDS.employee),
    workDate: IsoDateSchema,
    regularMinutes: z.number().int().min(0).max(1_440),
    overtimeMinutes: z.number().int().min(0).max(1_440),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((value, context) => {
    const total = value.regularMinutes + value.overtimeMinutes;
    if (total <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one minute must be recorded",
        path: ["regularMinutes"],
      });
    }
    if (total > 1_440) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Regular and overtime time cannot exceed 24 hours in one day",
        path: ["overtimeMinutes"],
      });
    }
  });

export const ReviewerCreateTimeEntryBodySchema = z
  .object({
    clientId: UuidSchema,
    workDate: IsoDateSchema,
    regularMinutes: z.number().int().min(0).max(1_440),
    overtimeMinutes: z.number().int().min(0).max(1_440),
    note: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const total = value.regularMinutes + value.overtimeMinutes;
    if (total <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one minute must be recorded",
        path: ["regularMinutes"],
      });
    }
    if (total > 1_440) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Regular and overtime time cannot exceed 24 hours in one day",
        path: ["overtimeMinutes"],
      });
    }
  })
  .transform(
    (value): CreateTimeEntryBody => ({
      ...value,
      timesheetId: value.clientId,
      employeeId: DEMO_IDS.employee,
    }),
  );

export const ConfirmTimeEntryBodySchema = z.object({
  employeeId: UuidSchema.default(DEMO_IDS.employee),
  note: z.string().trim().min(3).max(500),
});

export const ApproveTimesheetBodySchema = z.object({
  managerId: UuidSchema.default(DEMO_IDS.manager),
  note: z.string().trim().max(500).optional(),
});

export const ReturnTimesheetBodySchema = z.object({
  managerId: UuidSchema.default(DEMO_IDS.manager),
  note: z.string().trim().min(3).max(500),
});

export const CreateTimeEntryResponseSchema = z.object({
  data: z.object({
    entry: TimeEntrySchema,
    timesheet: TimesheetSchema,
    operationKey: z.string().min(1),
  }),
});

export const TimeEntryMutationResponseSchema = z.object({
  data: z.object({
    entry: TimeEntrySchema,
    timesheet: TimesheetSchema,
  }),
});

export const TimesheetResponseSchema = z.object({ data: TimesheetSchema });

export const IdempotencyOperationSchema = z.object({
  key: z.string().min(1),
  requestHash: z.string().length(64),
  operationType: z.literal("CREATE_TIME_ENTRY"),
  status: z.literal("succeeded"),
  responseStatus: z.number().int().min(200).max(299),
  response: CreateTimeEntryResponseSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const OperationResponseSchema = z.object({ data: IdempotencyOperationSchema });

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
});

export type CreateTimeEntryBody = z.infer<typeof CreateTimeEntryBodySchema>;
export type ReviewerCreateTimeEntryBody = z.infer<
  typeof ReviewerCreateTimeEntryBodySchema
>;
export type ConfirmTimeEntryBody = z.infer<typeof ConfirmTimeEntryBodySchema>;
export type ApproveTimesheetBody = z.infer<typeof ApproveTimesheetBodySchema>;
export type ReturnTimesheetBody = z.infer<typeof ReturnTimesheetBodySchema>;
export type TimeEntry = z.infer<typeof TimeEntrySchema>;
export type Timesheet = z.infer<typeof TimesheetSchema>;
export type TimesheetStatus = z.infer<typeof TimesheetStatusSchema>;
export type TimesheetEvent = z.infer<typeof TimesheetEventSchema>;
export type TimesheetRevision = z.infer<typeof TimesheetRevisionSchema>;
export type IdempotencyOperation = z.infer<typeof IdempotencyOperationSchema>;
export type CreateTimeEntryResponse = z.infer<
  typeof CreateTimeEntryResponseSchema
>;
