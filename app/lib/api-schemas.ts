import { z } from "zod";

export const TaskSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  isFavorite: z.boolean().optional(),
  parentTaskId: z.string().nullable().optional(),
  forkedFromMessageId: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const TasksResponseSchema = z.object({
  tasks: z.array(TaskSummarySchema),
  pagination: z
    .object({
      limit: z.number(),
      hasMore: z.boolean(),
      nextCursor: z.string().nullable(),
    })
    .optional(),
});

export const UserSchema = z.object({
  id: z.string(),
  clerkUserId: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  creditBalance: z.union([z.string(), z.number()]),
});

export const TaskMutationResponseSchema = z.object({
  task: TaskSummarySchema,
});

export const ForkTaskResponseSchema = z.object({
  task: TaskSummarySchema,
  copiedMessages: z.number(),
});

export const DeleteTaskResponseSchema = z.object({ deleted: z.boolean() });

export const AttachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  status: z.string(),
  url: z.string().nullable().optional(),
  sizeBytes: z.union([z.string(), z.number()]).optional(),
  position: z.number().optional(),
});

export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(["USER", "ASSISTANT", "SYSTEM", "TOOL"]),
  status: z.string(),
  contentBlocks: z.unknown(),
  attachments: z.array(AttachmentSchema).optional(),
  createdAt: z.string().optional(),
});

export const RunStepSchema = z.object({
  id: z.string(),
  stepNumber: z.number(),
  type: z.string(),
  name: z.string(),
  status: z.string(),
  durationMs: z.number().nullable().optional(),
  creditsUsed: z.union([z.string(), z.number()]).nullable().optional(),
  output: z.unknown().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
});

export const ToolInvocationSchema = z.object({
  id: z.string(),
  toolName: z.string(),
  status: z.string(),
  durationMs: z.number().nullable().optional(),
  creditsUsed: z.union([z.string(), z.number()]).nullable().optional(),
  output: z.unknown().nullable().optional(),
});

export const ActiveRunSchema = z.object({
  id: z.string(),
  status: z.string(),
  modelRoute: z.string().optional(),
  actualModel: z.string().nullable().optional(),
  stepCount: z.number().optional(),
  estimatedCredits: z.union([z.string(), z.number()]).nullable().optional(),
  reservedCredits: z.union([z.string(), z.number()]).nullable().optional(),
  actualCredits: z.union([z.string(), z.number()]).nullable().optional(),
  totalCreditsUsed: z.union([z.string(), z.number()]).nullable().optional(),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  steps: z.array(RunStepSchema).optional(),
  toolInvocations: z.array(ToolInvocationSchema).optional(),
});

export const TaskResponseSchema = z.object({
  task: TaskSummarySchema.optional(),
  messages: z.array(MessageSchema).optional(),
  activeRun: ActiveRunSchema.nullable().optional(),
  pendingAttachments: z.array(AttachmentSchema).optional(),
  pagination: z
    .object({
      limit: z.number(),
      hasMore: z.boolean(),
      nextCursor: z.string().nullable(),
    })
    .optional(),
});

export const SendMessageResponseSchema = z.object({
  taskId: z.string().optional(),
  messageId: z.string().optional(),
  runId: z.string().optional(),
  status: z.string().optional(),
  existing: z.boolean().optional(),
});

export const UploadParamsSchema = z.object({
  params: z.string(),
  signature: z.string(),
  taskId: z.string(),
  limits: z.object({
    maxFiles: z.number(),
    maxFileBytes: z.number(),
  }),
});

export const DirectUploadResponseSchema = z.object({
  taskId: z.string(),
  attachments: z.array(AttachmentSchema),
});

export const AttachmentsResponseSchema = z.object({ attachments: z.array(AttachmentSchema) });
export const SelectAttachmentResponseSchema = z.object({
  taskId: z.string(),
  attachment: AttachmentSchema,
});

export const RunSnapshotSchema = ActiveRunSchema.passthrough();

export const WaitpointResolutionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("approval"),
    decision: z.enum(["approve", "reject"]),
  }),
  z.object({
    kind: z.literal("option"),
    optionId: z.string(),
  }),
]);

export const WaitpointRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("APPROVAL"),
    question: z.string(),
    importance: z.string(),
    whyItMatters: z.string(),
    expiresInMinutes: z.number(),
  }),
  z.object({
    type: z.literal("OPTIONS"),
    question: z.string(),
    importance: z.string(),
    whyItMatters: z.string(),
    expiresInMinutes: z.number(),
    options: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        description: z.string(),
      }),
    ),
  }),
]);

export const WaitpointSchema = z.object({
  id: z.string(),
  token: z.string(),
  type: z.string(),
  status: z.string(),
  payload: z
    .object({ request: WaitpointRequestSchema })
    .nullable()
    .optional(),
  resolution: WaitpointResolutionSchema.nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  resolvedAt: z.string().nullable().optional(),
});

export const RunDetailSchema = z.object({
  run: RunSnapshotSchema.extend({
    waitpoints: z.array(WaitpointSchema).optional(),
  }),
});

export type TaskSummary = z.infer<typeof TaskSummarySchema>;
export type TasksResponse = z.infer<typeof TasksResponseSchema>;
export type ApiMessage = z.infer<typeof MessageSchema>;
export type TaskResponse = z.infer<typeof TaskResponseSchema>;
export type Attachment = z.infer<typeof AttachmentSchema>;
export type RunSnapshot = z.infer<typeof RunSnapshotSchema>;
export type UserProfile = z.infer<typeof UserSchema>;
export type WaitpointResolution = z.infer<typeof WaitpointResolutionSchema>;
export type WaitpointRequest = z.infer<typeof WaitpointRequestSchema>;
export type Waitpoint = z.infer<typeof WaitpointSchema>;
