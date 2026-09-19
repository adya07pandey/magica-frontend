import { describe, expect, it } from "vitest";
import {
  SendMessageResponseSchema,
  TasksResponseSchema,
} from "@/app/lib/api-schemas";

describe("API response schemas", () => {
  it("accepts the task list contract", () => {
    const result = TasksResponseSchema.parse({
      tasks: [{ id: "task-1", title: "Create a launch concept" }],
    });

    expect(result.tasks[0]?.title).toBe("Create a launch concept");
  });

  it("rejects malformed send responses", () => {
    expect(() => SendMessageResponseSchema.parse({ taskId: 42 })).toThrow();
  });
});
