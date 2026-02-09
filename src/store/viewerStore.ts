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

  // Custom colors
  customColors: Record<string, string>

  addSet: (set: SavedSet) => void
  updateSet: (id: string, updates: Partial<SavedSet>) => void
  deleteSet: (id: string) => void
  addElementsToSet: (setId: string, ids: number[]) => void
  removeElementsFromSet: (setId: string, ids: number[]) => void
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

  // Custom colors
  setCustomColor: (key: string, color: string) => void
  clearCustomColor: (key: string) => void
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
      customColors: {},

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

      addElementsToSet: (setId, ids) =>
        set((state) => ({
          savedSets: state.savedSets.map((s) => {
            if (s.id !== setId || s.type !== 'selection') return s
            const existing = new Set(s.expressIDs || [])
            ids.forEach((id) => existing.add(id))
            return { ...s, expressIDs: Array.from(existing) }
          }),
        })),

      removeElementsFromSet: (setId, ids) =>
        set((state) => ({
          savedSets: state.savedSets.map((s) => {
            if (s.id !== setId || s.type !== 'selection') return s
            const removeSet = new Set(ids)
            return { ...s, expressIDs: (s.expressIDs || []).filter((id) => !removeSet.has(id)) }
          }),
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

      // Custom colors
      setCustomColor: (key, color) =>
        set((state) => ({ customColors: { ...state.customColors, [key]: color } })),
      clearCustomColor: (key) =>
        set((state) => {
          const { [key]: _, ...rest } = state.customColors
          return { customColors: rest }
        }),
    }),
    {
      name: 'jens-viewer-sets',
      partialize: (state) => ({
        savedSets: state.savedSets,
        savedViewpoints: state.savedViewpoints,
        customColors: state.customColors,
      }),
    },
  ),
)
