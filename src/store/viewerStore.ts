import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SavedSet, ActiveSetDisplay, SavedViewpoint, ProfileLegendEntry } from '../components/Viewer3D/ifc/types'

interface ViewerState {
  savedSets: SavedSet[]
  activeDisplay: ActiveSetDisplay | null
  selectedElementIds: number[]

  // Viewpoints
  savedViewpoints: SavedViewpoint[]
  activeViewpointId: string | null

  // Profiler
  activeProfile: { field: string; legend: ProfileLegendEntry[] } | null

  addSet: (set: SavedSet) => void
  updateSet: (id: string, updates: Partial<SavedSet>) => void
  deleteSet: (id: string) => void
  setActiveDisplay: (display: ActiveSetDisplay | null) => void
  setSelectedElementIds: (ids: number[]) => void
  addToSelection: (ids: number[]) => void
  clearSelection: () => void

  // Viewpoints
  addViewpoint: (vp: SavedViewpoint) => void
  updateViewpoint: (id: string, updates: Partial<SavedViewpoint>) => void
  deleteViewpoint: (id: string) => void
  setActiveViewpointId: (id: string | null) => void

  // Profiler
  setActiveProfile: (profile: { field: string; legend: ProfileLegendEntry[] } | null) => void
}

export const useViewerStore = create<ViewerState>()(
  persist(
    (set) => ({
      savedSets: [],
      activeDisplay: null,
      selectedElementIds: [],
      savedViewpoints: [],
      activeViewpointId: null,
      activeProfile: null,

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

      // Viewpoints
      addViewpoint: (vp) =>
        set((state) => ({ savedViewpoints: [...state.savedViewpoints, vp] })),

      updateViewpoint: (id, updates) =>
        set((state) => ({
          savedViewpoints: state.savedViewpoints.map((v) =>
            v.id === id ? { ...v, ...updates } : v,
          ),
        })),

      deleteViewpoint: (id) =>
        set((state) => ({
          savedViewpoints: state.savedViewpoints.filter((v) => v.id !== id),
          activeViewpointId: state.activeViewpointId === id ? null : state.activeViewpointId,
        })),

      setActiveViewpointId: (id) => set({ activeViewpointId: id }),

      // Profiler
      setActiveProfile: (profile) => set({ activeProfile: profile }),
    }),
    {
      name: 'jens-viewer-sets',
      partialize: (state) => ({
        savedSets: state.savedSets,
        savedViewpoints: state.savedViewpoints,
      }),
    },
  ),
)
