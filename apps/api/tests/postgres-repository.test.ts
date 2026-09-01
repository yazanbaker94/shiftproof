import { DEMO_IDS } from "@shiftproof/contracts";
import { describe, expect, it, vi } from "vitest";

import { PostgresShiftProofRepository } from "../src/postgres-repository.js";

describe("Postgres reviewer inbox", () => {
  it("loads bounded summaries with one aggregate query", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "c0000000-0000-4000-8000-000000000001",
          employee_id: DEMO_IDS.employee,
          employee_name: "Sarah Chen",
          period_start: "2026-09-01",
          period_end: "2026-09-01",
          period_label: "Reviewer run / 2026-09-01",
          status: "draft",
          regular_hours: "8.00",
          overtime_hours: "1.50",
          entry_count: 1,
          created_at: "2026-09-01T10:00:00.000Z",
          updated_at: "2026-09-01T10:01:00.000Z",
        },
      ],
    });
    const repository = new PostgresShiftProofRepository({ query } as never);

    const summaries = await repository.listReviewerTimesheets(7);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain("COUNT(entry.id)::integer");
    expect(query.mock.calls[0]?.[0]).toContain("LIMIT $2");
    expect(query.mock.calls[0]?.[1]).toEqual([DEMO_IDS.timesheet, 7]);
    expect(summaries).toEqual([
      {
        id: "c0000000-0000-4000-8000-000000000001",
        employee: { id: DEMO_IDS.employee, name: "Sarah Chen" },
        period: {
          start: "2026-09-01",
          end: "2026-09-01",
          label: "Reviewer run / 2026-09-01",
        },
        status: "draft",
        totals: { regular: 8, overtime: 1.5, all: 9.5 },
        entryCount: 1,
        createdAt: "2026-09-01T10:00:00.000Z",
        updatedAt: "2026-09-01T10:01:00.000Z",
      },
    ]);
  });
});
