import cors from "@fastify/cors";
import {
  ApproveTimesheetBodySchema,
  ConfirmTimeEntryBodySchema,
  CreateTimeEntryBodySchema,
  DEMO_IDS,
  DEMO_REVIEW_THRESHOLD_HOURS,
  ReturnTimesheetBodySchema,
  UuidSchema,
} from "@shiftproof/contracts";
import Fastify from "fastify";
import { ZodError } from "zod";

import { DomainError } from "./errors.js";
import { requestHash } from "./hash.js";
import type { ShiftProofRepository } from "./repository.js";

type BuildAppOptions = {
  repository: ShiftProofRepository;
  logger?: boolean;
  corsOrigins?: string[];
};

function apiError(
  code: string,
  message: string,
  details?: unknown,
): { error: { code: string; message: string; details?: unknown } } {
  return details === undefined
    ? { error: { code, message } }
    : { error: { code, message, details } };
}

export async function buildApp(options: BuildAppOptions) {
  const app = Fastify({ logger: options.logger ?? false });
  const allowedOrigins = options.corsOrigins ?? ["http://localhost:3000"];
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"), false);
    },
  });

  app.get("/health", async () => {
    const repository = await options.repository.health();
    return {
      ok: repository.ok,
      service: "shiftproof-api",
      storage: repository.storage,
      demo: {
        timesheetId: DEMO_IDS.timesheet,
        reviewHeuristic:
          `Daily totals of ${DEMO_REVIEW_THRESHOLD_HOURS} hours or more are flagged for review. ` +
          "This is a product-demo heuristic, not payroll or labour-law advice.",
      },
      time: new Date().toISOString(),
    };
  });

  app.post("/v1/time-entries", async (request, reply) => {
    const rawKey = request.headers["idempotency-key"];
    const operationKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    if (!operationKey || operationKey.length < 8 || operationKey.length > 200) {
      return reply
        .code(400)
        .send(
          apiError(
            "IDEMPOTENCY_KEY_REQUIRED",
            "Idempotency-Key must contain between 8 and 200 characters",
          ),
        );
    }

    const body = CreateTimeEntryBodySchema.parse(request.body);
    const hash = requestHash("POST /v1/time-entries", body);
    const result = await options.repository.createTimeEntryIdempotent(
      body,
      operationKey,
      hash,
    );
    if (result.kind === "conflict") {
      return reply.code(409).send(
        apiError(
          "IDEMPOTENCY_KEY_REUSED",
          "This idempotency key was already used with a different payload",
          { operationKey },
        ),
      );
    }
    if (result.kind === "replayed") {
      reply.header("Idempotent-Replayed", "true");
    }
    return reply
      .code(result.operation.responseStatus)
      .send(result.operation.response);
  });

  app.get<{ Params: { key: string } }>(
    "/v1/operations/:key",
    async (request, reply) => {
      const operation = await options.repository.getOperation(request.params.key);
      if (!operation) {
        return reply
          .code(404)
          .send(apiError("OPERATION_NOT_FOUND", "Operation not found"));
      }
      return { data: operation };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/v1/timesheets/:id",
    async (request, reply) => {
      const id =
        request.params.id === "demo"
          ? DEMO_IDS.timesheet
          : UuidSchema.parse(request.params.id);
      const timesheet = await options.repository.getTimesheet(id);
      if (!timesheet) {
        return reply
          .code(404)
          .send(apiError("TIMESHEET_NOT_FOUND", "Timesheet not found"));
      }
      return { data: timesheet };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/v1/time-entries/:id/confirm",
    async (request) => {
      const body = ConfirmTimeEntryBodySchema.parse(request.body);
      const result = await options.repository.confirmTimeEntry(
        UuidSchema.parse(request.params.id),
        body,
      );
      return { data: result };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/v1/timesheets/:id/approve",
    async (request) => {
      const body = ApproveTimesheetBodySchema.parse(request.body ?? {});
      const id =
        request.params.id === "demo"
          ? DEMO_IDS.timesheet
          : UuidSchema.parse(request.params.id);
      const timesheet = await options.repository.approveTimesheet(id, body);
      return { data: timesheet };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/v1/timesheets/:id/return",
    async (request) => {
      const body = ReturnTimesheetBodySchema.parse(request.body);
      const id =
        request.params.id === "demo"
          ? DEMO_IDS.timesheet
          : UuidSchema.parse(request.params.id);
      const timesheet = await options.repository.returnTimesheet(id, body);
      return { data: timesheet };
    },
  );

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send(
        apiError("INVALID_REQUEST", "Request data is invalid", {
          issues: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        }),
      );
    }
    if (error instanceof DomainError) {
      return reply
        .code(error.statusCode)
        .send(apiError(error.code, error.message, error.details));
    }
    request.log.error({ error }, "Unhandled request error");
    return reply
      .code(500)
      .send(apiError("INTERNAL_ERROR", "An unexpected error occurred"));
  });

  app.addHook("onClose", async () => {
    await options.repository.close();
  });

  return app;
}
