import cors from "@fastify/cors";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  ApproveTimesheetBodySchema,
  ConfirmTimeEntryBodySchema,
  CreateTimeEntryBodySchema,
  DEMO_IDS,
  DEMO_REVIEW_THRESHOLD_HOURS,
  ReviewerTimesheetListQuerySchema,
  type ReviewerTimesheetListResponse,
  ReturnTimesheetBodySchema,
  ReviewerCreateTimeEntryBodySchema,
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
  allowSampleMutations?: boolean;
  reviewerAccessToken?: string;
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

function isZodError(
  error: unknown,
): error is { issues: Array<{ path: PropertyKey[]; message: string }> } {
  return (
    error instanceof ZodError ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ZodError" &&
      "issues" in error &&
      Array.isArray(error.issues))
  );
}

function tokensMatch(expected: string, presented: string): boolean {
  const expectedDigest = createHash("sha256").update(expected).digest();
  const presentedDigest = createHash("sha256").update(presented).digest();
  return timingSafeEqual(expectedDigest, presentedDigest);
}

function requireReviewerAccess(
  configuredToken: string | undefined,
  rawHeader: string | string[] | undefined,
): void {
  if (!configuredToken) return;
  const presentedToken = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (!presentedToken || !tokensMatch(configuredToken, presentedToken)) {
    throw new DomainError(
      401,
      "REVIEWER_ACCESS_REQUIRED",
      "A valid reviewer access token is required",
    );
  }
}

export async function buildApp(options: BuildAppOptions) {
  const app = Fastify({ logger: options.logger ?? false });
  const allowedOrigins = options.corsOrigins ?? ["http://localhost:3000"];
  const allowSampleMutations = options.allowSampleMutations ?? false;
  const reviewerAccessToken = options.reviewerAccessToken?.trim() || undefined;
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
      reviewerAccessRequired: Boolean(reviewerAccessToken),
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

  app.post("/v1/reviewer/time-entries", async (request, reply) => {
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

    const body = ReviewerCreateTimeEntryBodySchema.parse(request.body);
    if (body.timesheetId === DEMO_IDS.timesheet) {
      return reply.code(409).send(
        apiError(
          "REVIEWER_RUN_ID_RESERVED",
          "This client ID is reserved for the shared demo",
        ),
      );
    }
    await options.repository.ensureReviewerTimesheet(
      body.timesheetId,
      body.employeeId,
      body.workDate,
    );
    const hash = requestHash("POST /v1/reviewer/time-entries", body);
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

  app.get<{
    Querystring: { limit?: string };
    Reply: ReviewerTimesheetListResponse;
  }>(
    "/v1/reviewer/timesheets",
    async (request) => {
      const { limit } = ReviewerTimesheetListQuerySchema.parse(request.query);
      return { data: await options.repository.listReviewerTimesheets(limit) };
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
      const id =
        request.params.id === "demo"
          ? DEMO_IDS.timesheet
          : UuidSchema.parse(request.params.id);
      if (id === DEMO_IDS.timesheet && !allowSampleMutations) {
        throw new DomainError(
          403,
          "SAMPLE_READ_ONLY",
          "The shared sample timesheet is read-only",
        );
      }
      if (id !== DEMO_IDS.timesheet) {
        requireReviewerAccess(
          reviewerAccessToken,
          request.headers["x-shiftproof-reviewer-token"],
        );
      }
      const body = ApproveTimesheetBodySchema.parse(request.body ?? {});
      const timesheet = await options.repository.approveTimesheet(id, body);
      return { data: timesheet };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/v1/timesheets/:id/return",
    async (request) => {
      const id =
        request.params.id === "demo"
          ? DEMO_IDS.timesheet
          : UuidSchema.parse(request.params.id);
      if (id === DEMO_IDS.timesheet && !allowSampleMutations) {
        throw new DomainError(
          403,
          "SAMPLE_READ_ONLY",
          "The shared sample timesheet is read-only",
        );
      }
      if (id !== DEMO_IDS.timesheet) {
        requireReviewerAccess(
          reviewerAccessToken,
          request.headers["x-shiftproof-reviewer-token"],
        );
      }
      const body = ReturnTimesheetBodySchema.parse(request.body);
      const timesheet = await options.repository.returnTimesheet(id, body);
      return { data: timesheet };
    },
  );

  app.setErrorHandler((error, request, reply) => {
    if (isZodError(error)) {
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
