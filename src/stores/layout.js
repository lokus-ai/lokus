import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export const useLayoutStore = create(
  subscribeWithSelector((set) => ({
    showLeft: true,
    showRight: true,
    leftW: 280,
    rightW: 280,
    bottomPanelHeight: 250,
    bottomPanelTab: 'terminal',
    showTerminalPanel: false,
    showOutputPanel: false,

    toggleLeft: () => set((s) => ({ showLeft: !s.showLeft })),
    toggleRight: () => set((s) => ({ showRight: !s.showRight })),
    setLeftW: (px) => set({ leftW: px }),
    setRightW: (px) => set({ rightW: px }),
    setBottomHeight: (px) => set({ bottomPanelHeight: px }),
    setBottomTab: (tab) => set({ bottomPanelTab: tab }),
    setTerminalPanel: (v) => set({ showTerminalPanel: v }),
    setOutputPanel: (v) => set({ showOutputPanel: v }),
  }))
);
