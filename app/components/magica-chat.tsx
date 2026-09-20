"use client";

import { UserButton, useAuth, useClerk, useUser } from "@clerk/nextjs";
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowDown, ArrowUp, BookOpen, CheckCircle2, ChevronDown, CircleHelp,
  Clock3, CopyPlus, Download, Folder, FolderOpen, ImageIcon, Library,
  LoaderCircle, MessageSquare, Mic, MoreVertical, PanelLeft, Paperclip,
  Pencil, PlugZap, PlusCircle, Search, Sparkles, Square, Star, Trash2,
  WandSparkles, Wrench, X, XCircle, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  API_BASE, deleteAttachment, deleteTask, forkTask, getMe, getRun, getTask,
  listAttachments, listTasks,
  resolveWaitpoint, sendTaskMessage, stopTask, subscribeToRun, updateTask,
  selectAttachment,
} from "../lib/api-client";
import type { Waitpoint, WaitpointResolution } from "../lib/api-schemas";
import {
  type ApiMessage, type Attachment, type RunSnapshot, type TaskResponse,
  type TaskSummary, type TasksResponse,
} from "../lib/api-schemas";
import { useChatUiStore } from "../lib/chat-store";
import { AttachmentUploader } from "./attachment-uploader";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

const categories = ["All", "Video", "Image", "Audio", "Writing", "Design"];
const activeStatuses = new Set(["QUEUED", "RUNNING", "WAITING", "STOPPING"]);

export function MagicaChat({ taskId }: { taskId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { openSignIn } = useClerk();
  const { user } = useUser();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);
  const {
    composerByTask, setComposerForTask, clearComposerForTask, activeCategory,
    setActiveCategory, planMode, togglePlanMode,
  } = useChatUiStore();
  const composerKey = taskId ?? "__new_task__";
  const composer = composerByTask[composerKey] ?? "";
  const setComposer = (value: string) => setComposerForTask(composerKey, value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const meQuery = useQuery({
    queryKey: ["me"],
    enabled: isLoaded && Boolean(isSignedIn),
    queryFn: () => getMe(getToken),
  });

  const tasksQuery = useInfiniteQuery({
    queryKey: ["tasks", debouncedSearch],
    enabled: isLoaded && Boolean(isSignedIn),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      listTasks(getToken, { search: debouncedSearch, cursor: pageParam }),
    getNextPageParam: (page) => page.pagination?.nextCursor ?? undefined,
  });

  const taskQuery = useInfiniteQuery({
    queryKey: ["task", taskId],
    enabled: isLoaded && Boolean(isSignedIn && taskId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getTask(getToken, taskId!, pageParam),
    getNextPageParam: (page) => page.pagination?.nextCursor ?? undefined,
  });

  const taskData = useMemo<TaskResponse | undefined>(() => {
    const pages = taskQuery.data?.pages;
    if (!pages?.length) return undefined;
    const latest = pages[0];
    return {
      ...latest,
      messages: pages
        .slice()
        .reverse()
        .flatMap((page) => page.messages ?? []),
    };
  }, [taskQuery.data]);

  const activeRunId = taskData?.activeRun?.id;
  const runQuery = useQuery({
    queryKey: ["run", activeRunId],
    enabled: Boolean(
      activeRunId && taskData?.activeRun?.status === "WAITING",
    ),
    queryFn: () => getRun(getToken, activeRunId!),
    refetchInterval:
      taskData?.activeRun?.status === "WAITING" ? 2_000 : false,
  });

  useEffect(() => {
    if (!activeRunId || !taskId || !isSignedIn) return;
    const controller = new AbortController();
    let terminal = false;

    const connect = async () => {
      while (!controller.signal.aborted && !terminal) {
        try {
          await subscribeToRun(
            getToken,
            activeRunId,
            (snapshot) => {
              queryClient.setQueriesData(
                { queryKey: ["task", taskId] },
                (current: InfiniteData<TaskResponse, string | undefined> | undefined) =>
                  current
                    ? {
                        ...current,
                        pages: current.pages.map((page, index) =>
                          index === 0 ? { ...page, activeRun: snapshot } : page,
                        ),
                      }
                    : current,
              );
              terminal = !activeStatuses.has(snapshot.status);
              if (terminal) {
                void queryClient.invalidateQueries({ queryKey: ["task", taskId] });
                void queryClient.invalidateQueries({ queryKey: ["tasks"] });
                void queryClient.invalidateQueries({ queryKey: ["me"] });
              }
            },
            controller.signal,
          );
        } catch {
          if (!controller.signal.aborted) {
            void queryClient.invalidateQueries({ queryKey: ["task", taskId] });
          }
        }

        if (!controller.signal.aborted && !terminal) {
          await new Promise((resolve) => window.setTimeout(resolve, 1_000));
        }
      }
    };

    void connect();
    return () => controller.abort();
  }, [activeRunId, getToken, isSignedIn, queryClient, taskId]);

  const sendMutation = useMutation({
    mutationFn: (input: { content: string; attachments: string[] }) =>
      sendTaskMessage(getToken, { taskId, ...input }),
    onSuccess: async (data) => {
      clearComposerForTask(composerKey);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (!taskId && data.taskId) {
        router.push(`/chat/${data.taskId}`);
      } else if (taskId) {
        void queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      }
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => stopTask(getToken, taskId!),
    onMutate: () => {
      queryClient.setQueriesData(
        { queryKey: ["task", taskId] },
        (current: InfiniteData<TaskResponse, string | undefined> | undefined) =>
          current
            ? {
                ...current,
                pages: current.pages.map((page, index) =>
                  index === 0 && page.activeRun
                    ? { ...page, activeRun: { ...page.activeRun, status: "STOPPING" } }
                    : page,
                ),
              }
            : current,
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: {
      id: string;
      input: { title?: string; isFavorite?: boolean };
    }) => updateTask(getToken, id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (taskId) await queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask(getToken, id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousTasks =
        queryClient.getQueriesData<InfiniteData<TasksResponse, string | undefined>>({
          queryKey: ["tasks"],
        });
      queryClient.setQueriesData<InfiniteData<TasksResponse, string | undefined>>(
        { queryKey: ["tasks"] },
        (current) =>
          current
            ? {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  tasks: page.tasks.filter((task) => task.id !== id),
                })),
              }
            : current,
      );
      if (id === taskId) router.push("/chat");
      return { previousTasks };
    },
    onError: (_error, _id, context) => {
      for (const [queryKey, data] of context?.previousTasks ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const forkMutation = useMutation({
    mutationFn: ({ id, messageId }: { id: string; messageId: string }) =>
      forkTask(getToken, id, messageId),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      router.push(`/chat/${result.task.id}`);
    },
  });

  const approvalMutation = useMutation({
    mutationFn: ({
      token,
      resolution,
    }: {
      token: string;
      resolution: WaitpointResolution;
    }) => resolveWaitpoint(getToken, token, resolution),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["run", activeRunId] });
      await queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    },
  });

  const assetsQuery = useQuery({
    queryKey: ["attachments"],
    enabled: isLoaded && Boolean(isSignedIn && assetLibraryOpen),
    queryFn: () => listAttachments(getToken),
  });
  const selectAssetMutation = useMutation({
    mutationFn: (attachmentId: string) => selectAttachment(getToken, attachmentId, taskId),
    onSuccess: async (data) => {
      setAssetLibraryOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["task", data.taskId] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (!taskId) router.push(`/chat/${data.taskId}`);
    },
  });
  const removeAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      deleteAttachment(getToken, attachmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      await queryClient.invalidateQueries({ queryKey: ["attachments"] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = composer.trim();
    if (!content || sendMutation.isPending) return;
    if (!isLoaded) return;
    if (!isSignedIn) {
      void openSignIn();
      return;
    }
    const attachments =
      taskData?.pendingAttachments?.map((item) => item.id) ?? [];
    sendMutation.mutate({
      content: planMode ? `[Plan mode] ${content}` : content,
      attachments,
    });
  }

  const tasks = tasksQuery.data?.pages.flatMap((page) => page.tasks) ?? [];
  const error =
    stopMutation.error instanceof Error
      ? `Could not stop the run. ${stopMutation.error.message}`
      : sendMutation.error instanceof Error
      ? sendMutation.error.message
      : taskQuery.error instanceof Error
        ? taskQuery.error.message
        : updateMutation.error instanceof Error
          ? updateMutation.error.message
          : deleteMutation.error instanceof Error
            ? `Could not delete task. ${deleteMutation.error.message}`
            : removeAttachmentMutation.error instanceof Error
              ? `Could not remove attachment. ${removeAttachmentMutation.error.message}`
              : forkMutation.error instanceof Error
                ? forkMutation.error.message
                : null;

  return (
    <main className={`magica-app ${isSignedIn ? "" : "guest"}`}>
      <Sidebar
        tasks={tasks}
        activeTaskId={taskId}
        accountName={user?.fullName ?? user?.firstName ?? "Account"}
        isSignedIn={Boolean(isSignedIn)}
        search={search}
        searchOpen={searchOpen}
        setSearch={setSearch}
        setSearchOpen={setSearchOpen}
        onNewTask={() => router.push("/chat")}
        onOpenTask={(id) => router.push(`/chat/${id}`)}
        onFavorite={(task) =>
          updateMutation.mutate({
            id: task.id,
            input: { isFavorite: !task.isFavorite },
          })
        }
        onRename={(task) => {
          const title = window.prompt("Rename task", task.title)?.trim();
          if (title && title !== task.title) {
            updateMutation.mutate({ id: task.id, input: { title } });
          }
        }}
        onDelete={(task) => {
          if (window.confirm(`Delete “${task.title}”? This cannot be undone.`)) {
            deleteMutation.reset();
            deleteMutation.mutate(task.id);
          }
        }}
        deletingTaskId={deleteMutation.variables}
        hasMore={tasksQuery.hasNextPage}
        loadingMore={tasksQuery.isFetchingNextPage}
        onLoadMore={() => void tasksQuery.fetchNextPage()}
      />
      <section className="workspace">
        <TopBar
          userName={meQuery.data?.name ?? user?.firstName ?? undefined}
          creditBalance={meQuery.data?.creditBalance}
          isSignedIn={Boolean(isSignedIn)}
        />
        <div
          className={`workspace-scroll ${taskId ? "task-workspace" : "home-workspace"}`}
        >
          {!taskId ? (
            <HomePanel
              composer={composer}
              setComposer={setComposer}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              planMode={planMode}
              togglePlanMode={togglePlanMode}
              isSending={sendMutation.isPending}
              error={error}
              onAttach={() => setAttachmentMenuOpen((open) => !open)}
              attachmentMenuOpen={attachmentMenuOpen}
              onUpload={() => { setAttachmentMenuOpen(false); setUploaderOpen(true); }}
              onSelectAsset={() => { setAttachmentMenuOpen(false); setAssetLibraryOpen(true); }}
              onRemoveAttachment={(attachmentId) =>
                removeAttachmentMutation.mutate(attachmentId)
              }
              removingAttachmentId={removeAttachmentMutation.variables}
              onSubmit={submit}
            />
          ) : (
            <TaskPanel
              data={taskData}
              loading={taskQuery.isLoading}
              composer={composer}
              setComposer={setComposer}
              planMode={planMode}
              togglePlanMode={togglePlanMode}
              isSending={sendMutation.isPending}
              error={error}
              onAttach={() => setAttachmentMenuOpen((open) => !open)}
              attachmentMenuOpen={attachmentMenuOpen}
              onUpload={() => { setAttachmentMenuOpen(false); setUploaderOpen(true); }}
              onSelectAsset={() => { setAttachmentMenuOpen(false); setAssetLibraryOpen(true); }}
              onRemoveAttachment={(attachmentId) =>
                removeAttachmentMutation.mutate(attachmentId)
              }
              removingAttachmentId={removeAttachmentMutation.variables}
              onSubmit={submit}
              onStop={() => stopMutation.mutate()}
              stopping={stopMutation.isPending}
              waitpoints={runQuery.data?.run.waitpoints ?? []}
              onDecision={(token, resolution) =>
                approvalMutation.mutate({ token, resolution })
              }
              resolving={approvalMutation.isPending}
              hasOlder={taskQuery.hasNextPage}
              loadingOlder={taskQuery.isFetchingNextPage}
              onLoadOlder={() => void taskQuery.fetchNextPage()}
              onFork={(messageId) =>
                forkMutation.mutate({ id: taskId, messageId })
              }
              forking={forkMutation.isPending}
            />
          )}
        </div>
      </section>
      <AttachmentUploader
        open={uploaderOpen}
        taskId={taskId}
        getToken={getToken}
        onClose={() => setUploaderOpen(false)}
        onUploaded={async (uploadedTaskId) => {
          setUploaderOpen(false);
          await queryClient.invalidateQueries({ queryKey: ["tasks"] });
          await queryClient.invalidateQueries({
            queryKey: ["task", uploadedTaskId],
          });
          if (!taskId) router.push(`/chat/${uploadedTaskId}`);
        }}
      />
      {assetLibraryOpen && (
        <div className="asset-library-overlay" role="dialog" aria-modal="true" aria-label="Select asset">
          <section className="asset-library">
            <div className="asset-library-header"><strong>Select asset</strong><button onClick={() => setAssetLibraryOpen(false)} aria-label="Close asset library">x</button></div>
            {assetsQuery.isLoading && <p>Loading your assets...</p>}
            {assetsQuery.data?.attachments.length === 0 && <p>Your library is empty.</p>}
            <div className="asset-library-grid">
              {assetsQuery.data?.attachments.map((asset) => (
                <button key={asset.id} type="button" onClick={() => selectAssetMutation.mutate(asset.id)} disabled={selectAssetMutation.isPending}>
                  <AttachmentPreview attachment={asset} />
                  <span>{asset.filename}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {sendMutation.isPending && !taskId && (
        <div className="operation-toast" role="status">
          <LoaderCircle size={17} className="spin" />
          Creating task and starting the agent
        </div>
      )}
      {error && (
        <div className="operation-toast error" role="alert">
          <XCircle size={17} /> {error}
        </div>
      )}
    </main>
  );
}

function Sidebar({
  tasks, activeTaskId, accountName, search, searchOpen, setSearch,
  setSearchOpen, onNewTask, onOpenTask, onFavorite, onRename, onDelete,
  deletingTaskId, hasMore, loadingMore, onLoadMore, isSignedIn,
}: {
  tasks: TaskSummary[];
  activeTaskId?: string;
  accountName: string;
  search: string;
  searchOpen: boolean;
  setSearch: (value: string) => void;
  setSearchOpen: (value: boolean) => void;
  onNewTask: () => void;
  onOpenTask: (id: string) => void;
  onFavorite: (task: TaskSummary) => void;
  onRename: (task: TaskSummary) => void;
  onDelete: (task: TaskSummary) => void;
  deletingTaskId?: string;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  isSignedIn: boolean;
}) {
  return (
    <aside className="sidebar">
      <div className="brand-row">
        <div className="brand">Magica</div>
        <Button
          className="icon-button"
          variant="ghost"
          size="icon"
          aria-label="Search"
          onClick={() => setSearchOpen(!searchOpen)}
        >
          <Search size={20} />
        </Button>
        <Button
          className="icon-button"
          variant="ghost"
          size="icon"
          aria-label="Toggle sidebar"
        >
          <PanelLeft size={20} />
        </Button>
      </div>
      {searchOpen && (
        <input
          className="task-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search tasks"
          autoFocus
        />
      )}
      <nav className="main-nav" aria-label="Main">
        <SidebarItem label="New task" icon={PlusCircle} onClick={onNewTask} />
        <SidebarItem label="Tasks" icon={MessageSquare} />
        <SidebarItem label="Projects" icon={Folder} />
        <SidebarItem label="Library" icon={Library} />
        <SidebarItem label="Tools" icon={Wrench} />
        <SidebarItem label="API / MCP" icon={BookOpen} />
        <SidebarItem label="Help & Support" icon={CircleHelp} />
        <SidebarItem label="Unfair Advantage" icon={Sparkles} />
      </nav>
      {tasks.length > 0 && <div className="recent-title">Recent tasks</div>}
      <div className="recent-list">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={
              task.id === activeTaskId ? "recent-row active" : "recent-row"
            }
          >
            <button
              type="button"
              className="recent-item"
              onClick={() => onOpenTask(task.id)}
            >
              {task.isFavorite && <Star size={14} fill="currentColor" />}
              <span>{task.title}</span>
            </button>
            <details className="task-menu">
              <summary aria-label={`Actions for ${task.title}`}>
                <MoreVertical size={17} />
              </summary>
              <div className="task-menu-popover">
                <button type="button" onClick={() => onFavorite(task)}>
                  <Star size={15} /> {task.isFavorite ? "Unfavorite" : "Favorite"}
                </button>
                <button type="button" onClick={() => onRename(task)}>
                  <Pencil size={15} /> Rename
                </button>
                <button
                  className="danger"
                  type="button"
                  onClick={() => onDelete(task)}
                  disabled={deletingTaskId === task.id}
                >
                  {deletingTaskId === task.id ? (
                    <LoaderCircle size={15} className="spin" />
                  ) : (
                    <Trash2 size={15} />
                  )}
                  {deletingTaskId === task.id ? "Deleting" : "Delete"}
                </button>
              </div>
            </details>
          </div>
        ))}
        {hasMore && (
          <button
            type="button"
            className="load-more"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore && <LoaderCircle size={15} className="spin" />}
            {loadingMore ? "Loading" : "More tasks"}
          </button>
        )}
      </div>
      <div className="sidebar-footer">
        <button className="more-button" type="button">
          <MoreVertical size={20} /> More
        </button>
        {isSignedIn ? (
          <div className="account-pill" title={accountName}>
            <span className="avatar-dot" />
            <span>{accountName}</span>
          </div>
        ) : (
          <Link href="/sign-in" className="sidebar-sign-in">Sign in</Link>
        )}
      </div>
    </aside>
  );
}

function SidebarItem({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="sidebar-item" onClick={onClick}>
      <span className="nav-mark"><Icon size={19} /></span>
      {label}
    </button>
  );
}

function TopBar({
  userName,
  creditBalance,
  isSignedIn,
}: {
  userName?: string;
  creditBalance?: string | number;
  isSignedIn: boolean;
}) {
  const formattedCredits = creditBalance === undefined
    ? "Credits"
    : new Intl.NumberFormat("en", {
        notation: "compact",
        maximumFractionDigits: 2,
      }).format(Number(creditBalance));

  return (
    <header className="topbar">
      <div className="model-select">
        <span className="model-icon">M</span>
        <span>Magica Auto</span>
        <ChevronDown size={16} />
      </div>
      <div className="topbar-actions">
        <Button
          className="round-action"
          variant="outline"
          size="icon"
          aria-label="Files"
        >
          <FolderOpen size={20} />
        </Button>
        <div
          className="credit-pill"
          title={userName ? `Signed in as ${userName}` : "Available credits"}
        >
          <WandSparkles size={17} /> {formattedCredits}
        </div>
        {isSignedIn ? (
          <UserButton />
        ) : (
          <div className="auth-links">
            <Link href="/sign-in" className="sign-in-link">Sign in</Link>
            <Link href="/sign-up" className="sign-up-link">Sign up</Link>
          </div>
        )}
      </div>
    </header>
  );
}

type ComposerProps = {
  composer: string;
  setComposer: (value: string) => void;
  planMode: boolean;
  togglePlanMode: () => void;
  isSending: boolean;
  error: string | null;
  onAttach: () => void;
  attachmentMenuOpen?: boolean;
  onUpload?: () => void;
  onSelectAsset?: () => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  removingAttachmentId?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function HomePanel(
  props: ComposerProps & {
    activeCategory: string;
    setActiveCategory: (value: string) => void;
  },
) {
  return (
    <div className="home-panel">
      <div className="hero-center">
        <div className="mascot" aria-hidden="true"><span /><span /></div>
        <div className="clock">Ready when you are</div>
        <h1>Your AI worker</h1>
        <p>Work at the speed of thought.</p>
      </div>
      <Composer
        {...props}
        variant="home"
        placeholder="Assign a task or ask anything..."
      />
      <div className="category-row" aria-label="Categories">
        {categories.map((category) => (
          <button
            key={category}
            className={
              category === props.activeCategory
                ? "category-pill selected"
                : "category-pill"
            }
            type="button"
            onClick={() => props.setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}

function TaskPanel({
  data, loading, onStop, stopping, waitpoints, onDecision, resolving, hasOlder,
  loadingOlder, onLoadOlder, onFork, forking, ...composerProps
}: ComposerProps & {
  data?: TaskResponse;
  loading: boolean;
  onStop: () => void;
  stopping: boolean;
  waitpoints: Waitpoint[];
  onDecision: (token: string, resolution: WaitpointResolution) => void;
  resolving: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onFork: (messageId: string) => void;
  forking: boolean;
}) {
  const active =
    data?.activeRun && activeStatuses.has(data.activeRun.status);
  return (
    <div className="task-panel">
      <div className="conversation">
        {hasOlder && (
          <button
            type="button"
            className="load-older"
            onClick={onLoadOlder}
            disabled={loadingOlder}
          >
            {loadingOlder && <LoaderCircle size={16} className="spin" />}
            {loadingOlder ? "Loading history" : "Load older messages"}
          </button>
        )}
        {loading && (
          <ConversationState icon={Clock3} title="Loading conversation" />
        )}
        {!loading && !data?.messages?.length && (
          <ConversationState
            icon={MessageSquare}
            title="This conversation is empty"
          />
        )}
        {data?.messages?.map((message) => (
          <MessageView
            key={message.id}
            message={message}
            onFork={onFork}
            forking={forking}
          />
        ))}
        {data?.activeRun && <RunActivity run={data.activeRun} />}
        {waitpoints
          .filter((waitpoint) => waitpoint.status === "PENDING")
          .map((waitpoint) => (
            <ApprovalCard
              key={waitpoint.token}
              waitpoint={waitpoint}
              onDecision={onDecision}
              resolving={resolving}
            />
          ))}
      </div>
      <Composer
        {...composerProps}
        variant="task"
        placeholder="Send a message..."
        active={Boolean(active)}
        onStop={onStop}
        stopping={stopping}
        attachments={data?.pendingAttachments}
      />
    </div>
  );
}

function ConversationState({
  icon: Icon,
  title,
}: {
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="conversation-state">
      <Icon size={22} />
      <span>{title}</span>
    </div>
  );
}

function MessageView({
  message,
  onFork,
  forking,
}: {
  message: ApiMessage;
  onFork: (messageId: string) => void;
  forking: boolean;
}) {
  const blocks = Array.isArray(message.contentBlocks)
    ? message.contentBlocks
    : [];
  const hasGeneratedAsset = blocks.some((block) => {
    if (!block || typeof block !== "object") return false;
    return (block as Record<string, unknown>).type === "generated_asset";
  });
  const executionBlocks = blocks.filter(isExecutionBlock);
  const firstExecutionIndex = blocks.findIndex(isExecutionBlock);
  return (
    <article
      className={`chat-message ${message.role.toLowerCase()} ${message.status.toLowerCase()}`}
    >
      <div className="message-content">
        {blocks.map((block, index) => {
          if (isExecutionBlock(block)) {
            return index === firstExecutionIndex ? (
              <ExecutionSteps
                key={`${message.id}-steps`}
                blocks={executionBlocks}
                hasGeneratedAsset={hasGeneratedAsset}
              />
            ) : null;
          }

          return (
            <ContentBlock
              key={`${message.id}-${index}`}
              block={block}
              hasGeneratedAsset={hasGeneratedAsset}
              renderMarkdown={message.role === "ASSISTANT"}
            />
          );
        })}
        {message.attachments?.length && !hasGeneratedAsset ? (
          <AttachmentGrid attachments={message.attachments} />
        ) : null}
      </div>
      {message.status === "FAILED" && (
        <div className="message-status error">
          <XCircle size={15} /> Failed
        </div>
      )}
      {message.status === "CANCELLED" && (
        <div className="message-status"><Square size={14} /> Cancelled</div>
      )}
      {message.role === "ASSISTANT" && message.status === "COMPLETED" && (
        <div className="message-actions">
          <button
            type="button"
            aria-label="Fork conversation from this message"
            title="Fork conversation"
            onClick={() => onFork(message.id)}
            disabled={forking}
          >
            <CopyPlus size={16} />
          </button>
        </div>
      )}
    </article>
  );
}

function ContentBlock({
  block,
  hasGeneratedAsset = false,
  renderMarkdown = false,
}: {
  block: unknown;
  hasGeneratedAsset?: boolean;
  renderMarkdown?: boolean;
}) {
  if (!block || typeof block !== "object") return null;
  const value = block as Record<string, unknown>;
  if (value.type === "text" && typeof value.text === "string") {
    const text = hasGeneratedAsset
      ? cleanGeneratedAssetText(value.text)
      : value.text;
    if (!text) return null;
    return renderMarkdown ? (
      <MarkdownText text={text} />
    ) : (
      <p className="message-text">{text}</p>
    );
  }
  if (
    value.type === "generated_asset" &&
    typeof value.url === "string"
  ) {
    return (
      <GeneratedAsset
        url={value.url}
        assetType={value.assetType === "video" ? "video" : "image"}
      />
    );
  }
  if (
    (value.type === "thinking" || value.type === "reasoning") &&
    typeof value.text === "string"
  ) {
    return (
      <details className="thinking-block">
        <summary>Thinking</summary>
        <p>{value.text}</p>
      </details>
    );
  }
  return null;
}

export function MarkdownText({ text }: { text: string }) {
  return (
    <div className="message-text markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

type ExecutionEntry = {
  id: string;
  call?: Record<string, unknown>;
  result?: Record<string, unknown>;
};

function isExecutionBlock(block: unknown) {
  if (!block || typeof block !== "object") return false;
  const type = (block as Record<string, unknown>).type;
  return type === "tool_call" || type === "tool_result";
}

export function ExecutionSteps({
  blocks,
  hasGeneratedAsset,
}: {
  blocks: unknown[];
  hasGeneratedAsset: boolean;
}) {
  const entries: ExecutionEntry[] = [];
  const byId = new Map<string, ExecutionEntry>();

  for (const block of blocks) {
    const value = block as Record<string, unknown>;
    const id = String(value.toolCallId ?? `${value.toolName}-${entries.length}`);
    let entry = byId.get(id);
    if (!entry) {
      entry = { id };
      byId.set(id, entry);
      entries.push(entry);
    }
    if (value.type === "tool_call") entry.call = value;
    if (value.type === "tool_result") entry.result = value;
  }

  const failed = entries.some((entry) => entry.result?.status === "FAILED");
  const completed = entries.filter((entry) => entry.result?.status === "COMPLETED").length;

  return (
    <details className="execution-steps">
      <summary>
        <span className={`execution-status ${failed ? "failed" : ""}`}>
          {failed ? <XCircle size={17} /> : <CheckCircle2 size={17} />}
        </span>
        <strong>Steps</strong>
        <span>{completed} of {entries.length} completed</span>
        <ChevronDown className="execution-chevron" size={17} />
      </summary>
      <div className="execution-step-list">
        {entries.map((entry, index) => (
          <ExecutionStep
            key={entry.id}
            entry={entry}
            number={index + 1}
            hasGeneratedAsset={hasGeneratedAsset}
          />
        ))}
      </div>
    </details>
  );
}

function ExecutionStep({
  entry,
  number,
  hasGeneratedAsset,
}: {
  entry: ExecutionEntry;
  number: number;
  hasGeneratedAsset: boolean;
}) {
  const toolName = String(entry.call?.toolName ?? entry.result?.toolName ?? "Tool");
  const failed = entry.result?.status === "FAILED";
  const output = entry.result?.output ?? entry.result?.error;
  const outputRecord = output && typeof output === "object"
    ? output as Record<string, unknown>
    : undefined;
  const fallbackImageUrl = !hasGeneratedAsset
    ? typeof outputRecord?.image_url === "string"
      ? outputRecord.image_url
      : Array.isArray(outputRecord?.image_urls) && typeof outputRecord.image_urls[0] === "string"
        ? outputRecord.image_urls[0]
        : null
    : null;
  const fallbackVideoUrl = !hasGeneratedAsset && typeof outputRecord?.video_url === "string"
    ? outputRecord.video_url
    : null;
  const displayOutput = formatToolOutput(toolName, entry.call?.input, output);
  const credits = Number(entry.result?.creditsUsed ?? 0);

  return (
    <section className={`execution-step ${failed ? "failed" : ""}`}>
      <div className="execution-step-heading">
        <span className="execution-step-number">{number}</span>
        <Wrench size={17} />
        <strong>{humanize(toolName)}</strong>
        <span className="execution-step-state">
          {entry.result ? (failed ? "Failed" : "Completed") : "Running"}
        </span>
        {credits > 0 && <small>{credits.toLocaleString()} credits</small>}
      </div>
      <div className="execution-fields">
        <PrettyFields value={entry.call?.input} />
        {displayOutput !== undefined && (
          <div className="execution-output">
            <span className="execution-label">Result</span>
            <PrettyValue value={displayOutput} />
          </div>
        )}
      </div>
      {fallbackImageUrl && <GeneratedAsset url={fallbackImageUrl} assetType="image" />}
      {fallbackVideoUrl && <GeneratedAsset url={fallbackVideoUrl} assetType="video" />}
    </section>
  );
}

function PrettyFields({ value }: { value: unknown }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value == null ? null : <PrettyValue value={value} />;
  }

  return (
    <dl className="pretty-fields">
      {Object.entries(value as Record<string, unknown>)
        .filter(([key, fieldValue]) =>
          fieldValue !== undefined &&
          fieldValue !== null &&
          !/(^id$|id$|token$)/i.test(key),
        )
        .map(([key, fieldValue]) => (
          <div key={key}>
            <dt>{humanize(key)}</dt>
            <dd><PrettyValue value={fieldValue} /></dd>
          </div>
        ))}
    </dl>
  );
}

function PrettyValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <ul className="pretty-list">
        {value.map((item, index) => <li key={index}><PrettyValue value={item} /></li>)}
      </ul>
    );
  }
  if (value && typeof value === "object") {
    return <PrettyFields value={value} />;
  }
  if (typeof value === "boolean") return <>{value ? "Yes" : "No"}</>;
  if (typeof value === "string" && /^https?:\/\//i.test(value)) {
    return <a href={value} target="_blank" rel="noreferrer">{friendlyUrlLabel(value)}</a>;
  }
  return <>{String(value ?? "")}</>;
}

function formatToolOutput(toolName: string, input: unknown, output: unknown) {
  if (toolName !== "request_user_input" || !output || typeof output !== "object") {
    return output;
  }

  const result = output as Record<string, unknown>;
  const resolution = result.resolution;
  if (!resolution || typeof resolution !== "object") return output;
  const optionId = (resolution as Record<string, unknown>).optionId;
  const request = input && typeof input === "object" ? input as Record<string, unknown> : undefined;
  const options = Array.isArray(request?.options) ? request.options : [];
  const selected = options.find((option) =>
    option && typeof option === "object" && (option as Record<string, unknown>).id === optionId,
  ) as Record<string, unknown> | undefined;

  return {
    status: result.status,
    selected: selected?.label ?? optionId ?? "Response received",
  };
}

function friendlyUrlLabel(value: string) {
  try {
    const filename = decodeURIComponent(new URL(value).pathname.split("/").filter(Boolean).at(-1) ?? "");
    return filename ? filename.replaceAll("_", " ") : "Open link";
  } catch {
    return "Open link";
  }
}

function AttachmentGrid({
  attachments,
  onRemove,
  removingAttachmentId,
}: {
  attachments: Attachment[];
  onRemove?: (attachmentId: string) => void;
  removingAttachmentId?: string;
}) {
  return (
    <div className="attachment-grid">
      {attachments.map((attachment) => (
        <div className="attachment-card" key={attachment.id}>
          <AttachmentPreview attachment={attachment} />
          <span>{attachment.filename}</span>
          {onRemove && (
            <button
              type="button"
              className="attachment-remove"
              aria-label={`Remove ${attachment.filename}`}
              title="Remove attachment"
              disabled={removingAttachmentId === attachment.id}
              onClick={() => onRemove(attachment.id)}
            >
              {removingAttachmentId === attachment.id ? (
                <LoaderCircle size={13} className="spin" />
              ) : (
                <X size={14} />
              )}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const url = attachment.url ?? `${API_BASE}/api/attachments/${attachment.id}`;
  return (
    <>
      {attachment.mimeType.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={attachment.filename} />
          ) : attachment.mimeType.startsWith("video/") ? (
            <video
              src={url}
              controls
              aria-label={attachment.filename}
            />
          ) : attachment.mimeType.startsWith("audio/") ? (
            <audio
              src={url}
              controls
              aria-label={attachment.filename}
            />
          ) : (
            <ImageIcon size={28} />
          )}
    </>
  );
}

function GeneratedAsset({
  url,
  assetType,
}: {
  url: string;
  assetType: "image" | "video";
}) {
  return (
    <div className="generated-asset">
      {assetType === "video" ? (
        <video src={url} controls />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Generated output" />
      )}
      <a href={url} download aria-label="Download generated output">
        <Download size={18} />
      </a>
    </div>
  );
}

export function RunActivity({ run }: { run: RunSnapshot }) {
  const isActive = activeStatuses.has(run.status);
  const hasToolActivity = Boolean(
    run.toolInvocations?.length ||
      run.steps?.some((step) => step.type === "TOOL_CALL"),
  );
  const streamedText = run.steps
    ?.map((step) => extractStepText(step.output))
    .filter(Boolean)
    .at(-1);

  if (isActive && !hasToolActivity) {
    if (streamedText) {
      return (
        <section className="streaming-response" aria-live="polite">
          <MarkdownText text={streamedText} />
          <span aria-hidden="true" className="streaming-caret" />
        </section>
      );
    }

    return (
      <section className="run-activity thinking" aria-live="polite">
        <div className="run-heading">
          <LoaderCircle size={18} className="spin" />
          <strong>Thinking</strong>
        </div>
      </section>
    );
  }

  return (
    <section className="run-activity" aria-live="polite">
      <div className="run-heading">
        {isActive ? (
          <LoaderCircle size={18} className="spin" />
        ) : (
          <Sparkles size={18} />
        )}
        <strong>{humanize(run.status)}</strong>
        <span>{run.actualModel ?? run.modelRoute ?? "openrouter/free"}</span>
      </div>
      {run.steps?.map((step) => (
        <div className="run-step" key={step.id}>
          {step.status === "COMPLETED" ? (
            <CheckCircle2 size={16} />
          ) : (
            <Clock3 size={16} />
          )}
          <span>{step.name}</span>
          {step.durationMs != null && (
            <small>{(step.durationMs / 1000).toFixed(1)}s</small>
          )}
        </div>
      ))}
      {run.toolInvocations?.map((invocation) => {
        const output = (invocation as Record<string, unknown>).output as Record<string, unknown> | undefined;
        const imageUrl = typeof output?.image_url === "string"
          ? output.image_url
          : Array.isArray(output?.image_urls) && typeof output.image_urls[0] === "string"
            ? output.image_urls[0]
            : null;
        const videoUrl = typeof output?.video_url === "string" ? output.video_url : null;

        return (
          <div className="run-step tool" key={invocation.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {invocation.status === "COMPLETED" ? (
                <CheckCircle2 size={16} />
              ) : (
                <LoaderCircle size={16} className="spin" />
              )}
              <span>{humanize(invocation.toolName)}</span>
              <small>{humanize(invocation.status)}</small>
            </div>
            {imageUrl && (
              <GeneratedAsset url={imageUrl} assetType="image" />
            )}
            {videoUrl && (
              <GeneratedAsset url={videoUrl} assetType="video" />
            )}
          </div>
        );
      })}
      {isActive && streamedText && (
        <p className="streaming-text">
          {streamedText}<span aria-hidden="true" className="streaming-caret" />
        </p>
      )}
      {run.errorMessage && <div className="run-error">{run.errorMessage}</div>}
    </section>
  );
}

function cleanGeneratedAssetText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^!\[[^\]]*]\([^)]+\)$/.test(line)) return false;
      if (/^here'?s\s+(an?\s+)?(image|video|generated)/i.test(line)) return false;
      if (/^this is an?\s+generated\s+(image|video)/i.test(line)) return false;
      if (/^(the\s+)?(image|video)\s+has\s+been\s+(created|generated)/i.test(line)) {
        return false;
      }
      return true;
    })
    .join("\n")
    .trim();
}

function ApprovalCard({
  waitpoint,
  onDecision,
  resolving,
}: {
  waitpoint: Waitpoint;
  onDecision: (token: string, resolution: WaitpointResolution) => void;
  resolving: boolean;
}) {
  const request = waitpoint.payload?.request;

  if (!request) return null;

  return (
    <section className="approval-card">
      <div>
        <strong>{request.question}</strong>
        <p>{request.whyItMatters}</p>
      </div>
      <div className="approval-actions">
        {request.type === "APPROVAL" ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={resolving}
              onClick={() =>
                onDecision(waitpoint.token, {
                  kind: "approval",
                  decision: "reject",
                })
              }
            >
              Reject
            </Button>
            <Button
              type="button"
              disabled={resolving}
              onClick={() =>
                onDecision(waitpoint.token, {
                  kind: "approval",
                  decision: "approve",
                })
              }
            >
              Approve
            </Button>
          </>
        ) : (
          request.options.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant="outline"
              className="approval-option"
              disabled={resolving}
              title={option.description}
              onClick={() =>
                onDecision(waitpoint.token, {
                  kind: "option",
                  optionId: option.id,
                })
              }
            >
              {option.label}
            </Button>
          ))
        )}
      </div>
    </section>
  );
}

function Composer({
  variant, composer, setComposer, planMode, togglePlanMode, isSending, error,
  onAttach, onSubmit, placeholder, active = false, onStop, stopping = false,
  attachmentMenuOpen = false, onUpload, onSelectAsset,
  attachments = [], onRemoveAttachment, removingAttachmentId,
}: ComposerProps & {
  variant: "home" | "task";
  placeholder: string;
  active?: boolean;
  onStop?: () => void;
  stopping?: boolean;
  attachments?: Attachment[];
}) {
  return (
    <form className={`composer ${variant}`} onSubmit={onSubmit}>
      {attachments.length > 0 && (
        <AttachmentGrid
          attachments={attachments}
          onRemove={onRemoveAttachment}
          removingAttachmentId={removingAttachmentId}
        />
      )}
      <Textarea
        value={composer}
        onChange={(event) => setComposer(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder={placeholder}
        disabled={isSending || active}
        maxLength={32000}
      />
      <div className="composer-bottom">
        <div className="composer-tools">
          <div className="attachment-menu-wrap">
            <button type="button" aria-label="Attach files" onClick={onAttach}><Paperclip size={20} /></button>
            {attachmentMenuOpen && <div className="attachment-menu">
              <span>Add a file from your device or select one from your library</span>
              <button type="button" onClick={onSelectAsset}><Library size={18} />Select asset</button>
              <button type="button" onClick={onUpload}><PlusCircle size={18} />Upload</button>
            </div>}
          </div>
          <button type="button" aria-label="Open tools">
            <PlugZap size={20} />
          </button>
          <button
            type="button"
            className={planMode ? "mode-toggle active" : "mode-toggle"}
            onClick={togglePlanMode}
          >
            Plan
          </button>
        </div>
        <div className="composer-actions">
          <button type="button" aria-label="Voice input">
            <Mic size={20} />
          </button>
          {active ? (
            <StopButton stopping={stopping} onStop={onStop} />
          ) : (
            <button
              type="submit"
              className="send-button"
              disabled={isSending || !composer.trim()}
              aria-label="Send"
            >
              {isSending ? <ArrowDown size={19} /> : <ArrowUp size={19} />}
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="composer-error" role="alert">{error}</div>
      )}
    </form>
  );
}

export function StopButton({
  stopping,
  onStop,
}: {
  stopping: boolean;
  onStop?: () => void;
}) {
  return (
    <button
      type="button"
      className="stop-button running"
      onClick={onStop}
      disabled={stopping}
      aria-label={stopping ? "Stopping run" : "Stop generating"}
      title={stopping ? "Stopping" : "Stop generating"}
    >
      {stopping ? (
        <LoaderCircle size={17} className="spin" />
      ) : (
        <Square size={14} fill="currentColor" />
      )}
    </button>
  );
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function extractStepText(output: unknown) {
  if (!output || typeof output !== "object") return "";
  const content = (output as Record<string, unknown>).content;
  return typeof content === "string" ? content.trim() : "";
}
