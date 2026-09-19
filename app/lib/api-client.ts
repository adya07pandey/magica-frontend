import {
  DeleteTaskResponseSchema,
  ForkTaskResponseSchema,
  RunDetailSchema,
  RunSnapshotSchema,
  SendMessageResponseSchema,
  TaskMutationResponseSchema,
  TaskResponseSchema,
  TasksResponseSchema,
  UploadParamsSchema,
  DirectUploadResponseSchema,
  AttachmentsResponseSchema,
  SelectAttachmentResponseSchema,
  UserSchema,
  type RunSnapshot,
} from "./api-schemas";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "/backend";

export type GetToken = () => Promise<string | null>;

function apiUrl(path: string) {
  const value = `${API_BASE}${path}`;
  return typeof window === "undefined"
    ? value
    : new URL(value, window.location.origin).toString();
}

async function apiFetch(
  getToken: GetToken,
  path: string,
  init: RequestInit = {},
) {
  const token = await getToken();
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload
        ? String(payload.error)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

export async function uploadFiles(
  getToken: GetToken,
  files: File[],
  taskId?: string,
) {
  const formData = new FormData();
  if (taskId) formData.set("taskId", taskId);
  for (const file of files) formData.append("files", file);

  return DirectUploadResponseSchema.parse(
    await apiFetch(getToken, "/api/uploads/direct", {
      method: "POST",
      body: formData,
    }),
  );
}

export async function getMe(getToken: GetToken) {
  return UserSchema.parse(await apiFetch(getToken, "/api/me"));
}

export async function checkHealth() {
  const response = await fetch(apiUrl("/api/health"));
  if (!response.ok) throw new Error("Backend is unavailable");
  return response.json() as Promise<unknown>;
}

export async function listTasks(
  getToken: GetToken,
  options: { search?: string; cursor?: string; favorite?: boolean } = {},
) {
  const query = new URLSearchParams({ limit: "30" });
  const { search = "", cursor, favorite } = options;
  if (search.trim()) query.set("search", search.trim());
  if (cursor) query.set("cursor", cursor);
  if (favorite) query.set("favorite", "true");
  return TasksResponseSchema.parse(
    await apiFetch(getToken, `/api/tasks?${query.toString()}`),
  );
}

export async function getTask(
  getToken: GetToken,
  taskId: string,
  cursor?: string,
) {
  const query = new URLSearchParams({ limit: "30" });
  if (cursor) query.set("cursor", cursor);
  return TaskResponseSchema.parse(
    await apiFetch(getToken, `/api/tasks/${taskId}?${query.toString()}`),
  );
}

export async function updateTask(
  getToken: GetToken,
  taskId: string,
  input: { title?: string; isFavorite?: boolean },
) {
  return TaskMutationResponseSchema.parse(
    await apiFetch(getToken, `/api/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteTask(getToken: GetToken, taskId: string) {
  return DeleteTaskResponseSchema.parse(
    await apiFetch(getToken, `/api/tasks/${taskId}`, { method: "DELETE" }),
  );
}

export async function forkTask(
  getToken: GetToken,
  taskId: string,
  messageId: string,
) {
  return ForkTaskResponseSchema.parse(
    await apiFetch(getToken, `/api/tasks/${taskId}/fork`, {
      method: "POST",
      body: JSON.stringify({ messageId }),
    }),
  );
}

export async function sendTaskMessage(
  getToken: GetToken,
  input: { taskId?: string; content: string; attachments: string[] },
) {
  const path = input.taskId ? `/api/tasks/${input.taskId}` : "/api/tasks";
  return SendMessageResponseSchema.parse(
    await apiFetch(getToken, path, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        content: input.content,
        attachments: input.attachments,
      }),
    }),
  );
}

export async function stopTask(getToken: GetToken, taskId: string) {
  return apiFetch(getToken, `/api/tasks/${taskId}/stop`, { method: "POST" });
}

export async function getRun(getToken: GetToken, runId: string) {
  return RunDetailSchema.parse(
    await apiFetch(getToken, `/api/v1/runs/${runId}`),
  );
}

export async function resolveWaitpoint(
  getToken: GetToken,
  token: string,
  decision: "approve" | "reject",
) {
  return apiFetch(getToken, `/api/v1/waitpoints/${token}`, {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ decision }),
  });
}

export async function createUploadParams(
  getToken: GetToken,
  input: {
    taskId?: string;
    files: Array<{ filename: string; mimeType: string; sizeBytes: number }>;
  },
) {
  return UploadParamsSchema.parse(
    await apiFetch(getToken, "/api/uploads/transloadit/params", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export async function completeTransloaditUpload(getToken: GetToken, assembly: unknown) {
  return apiFetch(getToken, "/api/uploads/transloadit/complete", {
    method: "POST",
    body: JSON.stringify(assembly),
  });
}

export async function listAttachments(getToken: GetToken) {
  return AttachmentsResponseSchema.parse(await apiFetch(getToken, "/api/attachments"));
}

export async function selectAttachment(getToken: GetToken, attachmentId: string, taskId?: string) {
  return SelectAttachmentResponseSchema.parse(await apiFetch(getToken, `/api/attachments/${attachmentId}`, {
    method: "POST",
    body: JSON.stringify({ taskId }),
  }));
}

export async function subscribeToRun(
  getToken: GetToken,
  runId: string,
  onSnapshot: (snapshot: RunSnapshot) => void,
  signal: AbortSignal,
) {
  const token = await getToken();
  const response = await fetch(apiUrl(`/api/v1/runs/${runId}/events`), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  if (!response.ok || !response.body) throw new Error("Realtime unavailable");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const dataLine = event.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      let payload: unknown;
      try {
        payload = JSON.parse(dataLine.slice(6));
      } catch {
        continue;
      }
      const parsed = RunSnapshotSchema.safeParse(payload);
      if (parsed.success) onSnapshot(parsed.data);
    }
  }
}
