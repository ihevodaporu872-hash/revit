import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SavedSet, ActiveSetDisplay } from '../components/Viewer3D/ifc/types'

interface ViewerState {
  savedSets: SavedSet[]
  activeDisplay: ActiveSetDisplay | null
  selectedElementIds: number[]

  addSet: (set: SavedSet) => void
  updateSet: (id: string, updates: Partial<SavedSet>) => void
  deleteSet: (id: string) => void
  setActiveDisplay: (display: ActiveSetDisplay | null) => void
  setSelectedElementIds: (ids: number[]) => void
  addToSelection: (ids: number[]) => void
  clearSelection: () => void
}

export const useViewerStore = create<ViewerState>()(
  persist(
    (set) => ({
      savedSets: [],
      activeDisplay: null,
      selectedElementIds: [],

      addSet: (newSet) =>
        set((state) => ({ savedSets: [...state.savedSets, newSet] })),

      updateSet: (id, updates) =>
        set((state) => ({
          savedSets: state.savedSets.map((s) =>
            s.id === id ? { ...s, ...updates } : s,
          ),
        })),

      deleteSet: (id) =>
        set((state) => ({
          savedSets: state.savedSets.filter((s) => s.id !== id),
          activeDisplay: state.activeDisplay?.setId === id ? null : state.activeDisplay,
        })),

      setActiveDisplay: (display) => set({ activeDisplay: display }),

      setSelectedElementIds: (ids) => set({ selectedElementIds: ids }),

      addToSelection: (ids) =>
        set((state) => ({
          selectedElementIds: [...new Set([...state.selectedElementIds, ...ids])],
        })),

      clearSelection: () => set({ selectedElementIds: [] }),
    }),
    {
      name: 'jens-viewer-sets',
      partialize: (state) => ({ savedSets: state.savedSets }),
    },
  ),
)
