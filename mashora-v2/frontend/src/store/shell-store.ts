import { create } from 'zustand'

interface ShellState {
  commandOpen: boolean
  mobileSidebarOpen: boolean
  setCommandOpen: (open: boolean) => void
  setMobileSidebarOpen: (open: boolean) => void
}

export const useShellStore = create<ShellState>((set) => ({
  commandOpen: false,
  mobileSidebarOpen: false,
  setCommandOpen(open) {
    set({ commandOpen: open })
  },
  setMobileSidebarOpen(open) {
    set({ mobileSidebarOpen: open })
  },
}))
