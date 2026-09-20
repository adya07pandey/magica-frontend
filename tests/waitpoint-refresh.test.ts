import { describe, expect, it } from "vitest";

import { RunDetailSchema } from "../app/lib/api-schemas";

describe("waitpoint refresh recovery", () => {
  it("reconstructs a pending option request from the canonical run response", () => {
    const parsed = RunDetailSchema.parse({
      run: {
        id: "run-1",
        taskId: "task-1",
        messageId: "message-1",
        status: "WAITING",
        modelRoute: "openrouter/free",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        stepCount: 0,
        createdAt: "2026-09-20T12:00:00.000Z",
        updatedAt: "2026-09-20T12:00:00.000Z",
        steps: [],
        toolInvocations: [],
        skills: [],
        waitpoints: [
          {
            id: "wait-1",
            token: "public-token",
            type: "OPTIONS",
            status: "PENDING",
            payload: {
              request: {
                type: "OPTIONS",
                question: "Which source should be permanently replaced?",
                importance: "IRREVERSIBLE_ACTION",
                whyItMatters: "The selected source cannot be restored.",
                expiresInMinutes: 30,
                options: [
                  { id: "a", label: "A", description: "Replace A" },
                  { id: "b", label: "B", description: "Replace B" },
                ],
              },
            },
          },
        ],
      },
    });

    expect(parsed.run.status).toBe("WAITING");
    expect(parsed.run.waitpoints?.[0]?.status).toBe("PENDING");
    expect(parsed.run.waitpoints?.[0]?.payload?.request.type).toBe("OPTIONS");
  });
});
