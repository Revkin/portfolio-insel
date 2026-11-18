import { create } from 'zustand';
import type { Lang } from '../content/types.ts';
import { detectInitialLang } from '../content/i18n.ts';

interface GameState {
  lang: Lang;
  setLang: (lang: Lang) => void;

  /** Portal the player is close enough to interact with. */
  nearPortalId: string | null;
  setNearPortal: (id: string | null) => void;

  /** Project whose overlay is open; movement is paused while set. */
  openProjectId: string | null;
  openProject: (id: string) => void;
  closeProject: () => void;

  pointerLocked: boolean;
  setPointerLocked: (locked: boolean) => void;
}

export const useGame = create<GameState>()((set) => ({
  lang: detectInitialLang(),
  setLang: (lang) => set({ lang }),

  nearPortalId: null,
  setNearPortal: (nearPortalId) => set({ nearPortalId }),

  openProjectId: null,
  openProject: (openProjectId) => set({ openProjectId }),
  closeProject: () => set({ openProjectId: null }),

  pointerLocked: false,
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
}));
