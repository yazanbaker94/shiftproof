import { buildApp } from "./app.js";
import { MemoryShiftProofRepository } from "./memory-repository.js";
import { PostgresShiftProofRepository } from "./postgres-repository.js";

const repository = process.env.DATABASE_URL
  ? PostgresShiftProofRepository.fromConnectionString(process.env.DATABASE_URL)
  : new MemoryShiftProofRepository();
const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:8081")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const app = await buildApp({ repository, logger: true, corsOrigins });
const port = Number(process.env.PORT ?? 4100);
const host = process.env.HOST ?? "0.0.0.0";

await app.listen({ port, host });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "Shutting down ShiftProof API");
  await app.close();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
