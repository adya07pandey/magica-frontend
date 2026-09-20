import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  deleteTask,
  listTasks,
  subscribeToRun,
  updateTask,
} from "@/app/lib/api-client";
import type { RunSnapshot } from "@/app/lib/api-schemas";

const getToken = async () => "test-token";
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("API client", () => {
  it("passes task filters and validates the paginated response", async () => {
    server.use(
      http.get("http://localhost:3000/backend/api/tasks", ({ request }) => {
        const url = new URL(request.url);
        expect(request.headers.get("authorization")).toBe("Bearer test-token");
        expect(url.searchParams.get("search")).toBe("launch");
        expect(url.searchParams.get("cursor")).toBe("next-page");
        return HttpResponse.json({
          tasks: [{ id: "task-1", title: "Launch" }],
          pagination: { limit: 30, hasMore: false, nextCursor: null },
        });
      }),
    );

    const result = await listTasks(getToken, {
      search: "launch",
      cursor: "next-page",
    });
    expect(result.tasks).toHaveLength(1);
  });

  it("supports task updates and deletion", async () => {
    server.use(
      http.patch("http://localhost:3000/backend/api/tasks/task-1", async ({ request }) => {
        expect(await request.json()).toEqual({ isFavorite: true });
        return HttpResponse.json({
          task: { id: "task-1", title: "Launch", isFavorite: true },
        });
      }),
      http.delete("http://localhost:3000/backend/api/tasks/task-1", () =>
        HttpResponse.json({ deleted: true }),
      ),
    );

    const updated = await updateTask(getToken, "task-1", { isFavorite: true });
    expect(updated.task.isFavorite).toBe(true);
    await expect(deleteTask(getToken, "task-1")).resolves.toEqual({ deleted: true });
  });

  it("parses run snapshots from the SSE stream", async () => {
    server.use(
      http.get("http://localhost:3000/backend/api/v1/runs/run-1/events", () =>
        new HttpResponse(
          'event: run.snapshot\ndata: {"id":"run-1","status":"COMPLETED","totalCreditsUsed":"270000","steps":[{"id":"step-1","stepNumber":1,"type":"TOOL_CALL","name":"gpt_image_2","status":"COMPLETED","creditsUsed":"270000"}]}\n\n',
          { headers: { "Content-Type": "text/event-stream" } },
        ),
      ),
    );

    const snapshots: RunSnapshot[] = [];
    await subscribeToRun(
      getToken,
      "run-1",
      (snapshot) => snapshots.push(snapshot),
      new AbortController().signal,
    );
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.totalCreditsUsed).toBe("270000");
    expect(snapshots[0]?.steps?.[0]?.creditsUsed).toBe("270000");
  });
});
