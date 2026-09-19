import { create } from "zustand";

type ChatUiState = {
  composerByTask: Record<string, string>;
  setComposerForTask: (taskKey: string, value: string) => void;
  clearComposerForTask: (taskKey: string) => void;
  activeCategory: string;
  setActiveCategory: (value: string) => void;
  planMode: boolean;
  togglePlanMode: () => void;
};

export const useChatUiStore = create<ChatUiState>((set) => ({
  composerByTask: {},
  setComposerForTask: (taskKey, composer) =>
    set((state) => ({
      composerByTask: {
        ...state.composerByTask,
        [taskKey]: composer,
      },
    })),
  clearComposerForTask: (taskKey) =>
    set((state) => {
      const { [taskKey]: _removed, ...composerByTask } = state.composerByTask;
      void _removed;
      return { composerByTask };
    }),
  activeCategory: "All",
  setActiveCategory: (activeCategory) =>
    set({ activeCategory }),
  planMode: false,
  togglePlanMode: () => set((state) => ({ planMode: !state.planMode })),
}));
