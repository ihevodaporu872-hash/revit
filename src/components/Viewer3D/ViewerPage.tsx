import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ZoomIn,
  ZoomOut,
  Move,
  RotateCcw,
  Ruler,
  Scissors,
  Maximize,
  Upload,
  ChevronRight,
  ChevronDown,
  Layers,
  Info,
  X,
  Box,
  Building2,
  Grid3x3,
  Eye,
  EyeOff,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Bookmark,
  Loader2,
  Camera,
  Pencil,
  Focus,
  Palette,
  Download,
} from 'lucide-react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Button } from '../ui/Button'
import { useAppStore } from '../../store/appStore'
import { useViewerStore } from '../../store/viewerStore'
import { MotionPage } from '../MotionPage'
import { IFCService } from './ifc/ifcService'
import type { IFCSpatialNode, IFCModelStats, LoadingProgress, DrawingSettings, SavedViewpoint, ClipPlaneState, ClipBoxState, SectionMode, MeasureMode } from './ifc/types'
import { useViewerHighlight } from './useViewerHighlight'
import { useSearchSets } from './useSearchSets'
import { SearchSetsPanel } from './SearchSetsPanel'
import { useZoomToSelected } from './useZoomToSelected'
import { useAnnotations } from './useAnnotations'
import { AnnotationCanvas } from './AnnotationCanvas'
import { DrawingToolbar } from './DrawingToolbar'
import { ViewpointsPanel } from './ViewpointsPanel'
import { SaveViewpointDialog } from './SaveViewpointDialog'
import { useSectionPlanes } from './useSectionPlanes'
import { SectionPanel } from './SectionPanel'
import { useMeasureTool } from './useMeasureTool'
import { MeasurePanel } from './MeasurePanel'
import { useAppearanceProfiler } from './useAppearanceProfiler'
import { AppearanceProfilerPanel } from './AppearanceProfilerPanel'
import { useExcelExport } from './useExcelExport'
import { ExportDialog } from './ExportDialog'
import { useBoxSelect } from './useBoxSelect'
import { useWireframe } from './useWireframe'
import { ColorPickerPopover } from './ColorPickerPopover'
import {
  fadeInUp,
  fadeInLeft,
  fadeInRight,
  scaleIn,
  shimmer,
} from '../../lib/animations'

// ── Types ──────────────────────────────────────────────────────────────

interface SelectedElement {
  id: number
  type: string
  name: string
  properties: { name: string; value: string }[]
  material?: string
  volume?: string
  area?: string
}

interface TreeNode {
  id: string
  expressID: number
  label: string
  type: 'project' | 'site' | 'building' | 'storey' | 'element'
  children?: TreeNode[]
  expanded?: boolean
}

type ToolMode = 'select' | 'pan' | 'rotate' | 'zoom' | 'measure' | 'section'
type LeftTab = 'tree' | 'sets' | 'viewpoints' | 'profiler' | 'models'

// ── Component ──────────────────────────────────────────────────────────

export default function ViewerPage() {
  const { addNotification } = useAppStore()
  const {
    savedSets, activeDisplay, selectedElementIds, setSelectedElementIds,
    setActiveDisplay, addToSelection, addViewpoint, activeProfile, setActiveProfile,
    customColors, setCustomColor, clearCustomColor,
  } = useViewerStore()

  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const frameIdRef = useRef<number>(0)
  const ifcServiceRef = useRef<IFCService | null>(null)
  const modelGroupRef = useRef<THREE.Group | null>(null)
  const selectedMeshesRef = useRef<Map<number, { mesh: THREE.Mesh; originalMaterial: THREE.Material | THREE.Material[] }>>(new Map())
  const annotationCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [activeTool, setActiveTool] = useState<ToolMode>('select')
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null)
  const [showLeftPanel, setShowLeftPanel] = useState(false)
  const [leftTab, setLeftTab] = useState<LeftTab>('tree')
  const [showProperties, setShowProperties] = useState(false)
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [modelFile, setModelFile] = useState<string | null>(null)
  const [modelStats, setModelStats] = useState<IFCModelStats | null>(null)
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress | null>(null)
  const [loadedModels, setLoadedModels] = useState<{ modelID: number; fileName: string; visible: boolean }[]>([])

  // Drawing / Annotations state
  const [isDrawingMode, setIsDrawingMode] = useState(false)
  const [drawingSettings, setDrawingSettings] = useState<DrawingSettings>({
    tool: 'pen', color: '#ef4444', lineWidth: 4, fontSize: 16,
  })
  const [saveViewpointOpen, setSaveViewpointOpen] = useState(false)

  // Export state
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  // Measure mode state
  const [measureMode, setMeasureMode] = useState<MeasureMode>('distance')

  // Wireframe state
  const [isWireframe, setIsWireframe] = useState(false)

  // Color picker state
  const [showColorPicker, setShowColorPicker] = useState(false)

  // Profiler state
  const [isProfilerProcessing, setIsProfilerProcessing] = useState(false)

  const { applyDisplay, reset: resetHighlight } = useViewerHighlight()
  const { evaluateSearchSet } = useSearchSets()

  // ── Hooks ─────────────────────────────────────────────────

  const { zoomToSelected } = useZoomToSelected({
    cameraRef, controlsRef, ifcServiceRef, selectedElementIds,
  })

  const annotations = useAnnotations({
    canvasRef: annotationCanvasRef,
    active: isDrawingMode,
    tool: drawingSettings.tool,
    color: drawingSettings.color,
    lineWidth: drawingSettings.lineWidth,
    fontSize: drawingSettings.fontSize,
  })

  const sectionPlanes = useSectionPlanes({
    rendererRef, sceneRef,
  })

  const measureTool = useMeasureTool({
    sceneRef, cameraRef, modelGroupRef, containerRef,
  })

  const { buildProfile, clearProfile } = useAppearanceProfiler()

  const { exportToExcel } = useExcelExport()
  const wireframe = useWireframe()

  const clearAllSelections = useCallback(() => {
    selectedMeshesRef.current.forEach(({ mesh, originalMaterial }) => {
      mesh.material = originalMaterial
    })
    selectedMeshesRef.current.clear()
  }, [])

  const highlightMesh = useCallback((expressID: number, mesh: THREE.Mesh) => {
    if (selectedMeshesRef.current.has(expressID)) return
    selectedMeshesRef.current.set(expressID, { mesh, originalMaterial: mesh.material })
    const mat = (mesh.material as THREE.MeshPhysicalMaterial).clone()
    mat.emissive = new THREE.Color(0x3b82f6)
    mat.emissiveIntensity = 0.5
    mesh.material = mat
  }, [])

  const handleBoxSelect = useCallback((ids: number[], additive: boolean) => {
    if (!additive) {
      clearAllSelections()
      setSelectedElementIds(ids)
    } else {
      addToSelection(ids)
    }

    // Visually highlight all selected meshes
    const service = ifcServiceRef.current
    if (service) {
      ids.forEach((id) => {
        const mesh = service.getMesh(id)
        if (mesh) highlightMesh(id, mesh)
      })
    }

    if (ids.length > 0) {
      setShowProperties(true)
      const totalSelected = additive ? selectedElementIds.length + ids.length : ids.length
      setSelectedElement({
        id: ids[0],
        type: `${totalSelected} elements selected`,
        name: `Multi-selection (${totalSelected})`,
        properties: [],
      })
    }
  }, [addToSelection, setSelectedElementIds, clearAllSelections, highlightMesh, selectedElementIds])

  useBoxSelect({
    containerRef,
    cameraRef,
    modelGroupRef,
    enabled: activeTool === 'select' && !isDrawingMode && isModelLoaded,
    onSelect: handleBoxSelect,
  })

  // ── Three.js Initialization ─────────────────────────────

  const initScene = useCallback(() => {
    if (!containerRef.current || rendererRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 10000)
    camera.position.set(30, 20, 30)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.localClippingEnabled = true
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.1
    controls.screenSpacePanning = true
    controls.maxPolarAngle = Math.PI
    controls.minDistance = 1
    controls.maxDistance = 500
    controlsRef.current = controls

    const gridHelper = new THREE.GridHelper(100, 100, 0x555588, 0x444466)
    scene.add(gridHelper)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(50, 80, 50)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 2048
    dirLight.shadow.mapSize.height = 2048
    dirLight.shadow.camera.near = 0.5
    dirLight.shadow.camera.far = 500
    dirLight.shadow.camera.left = -100
    dirLight.shadow.camera.right = 100
    dirLight.shadow.camera.top = 100
    dirLight.shadow.camera.bottom = -100
    scene.add(dirLight)

    const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x1a1a2e, 0.3)
    scene.add(hemiLight)

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      if (!container || !camera || !renderer) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(frameIdRef.current)
      renderer.dispose()
      controls.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
      rendererRef.current = null
    }
  }, [])

  useEffect(() => {
    const cleanup = initScene()
    return () => {
      cleanup?.()
      ifcServiceRef.current?.dispose()
      sectionPlanes.dispose()
      measureTool.clearAllMeasurements()
    }
  }, [initScene]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Apply Search Set display ─────────────────────────────

  useEffect(() => {
    const group = modelGroupRef.current
    if (!group || !isModelLoaded) return
    // Skip if profiler is active
    if (activeProfile) return

    if (!activeDisplay) {
      resetHighlight(group)
      return
    }

    const set = savedSets.find((s) => s.id === activeDisplay.setId)
    if (!set) return

    const applyIds = async () => {
      let ids: number[] = []
      if (set.type === 'selection' && set.expressIDs) {
        ids = set.expressIDs
      } else if (set.type === 'search' && set.criteria && ifcServiceRef.current) {
        ids = await evaluateSearchSet(ifcServiceRef.current, set.criteria, set.logic || 'AND')
      }
      resetHighlight(group)
      applyDisplay(group, new Set(ids), activeDisplay, set.color)
    }
    applyIds()
  }, [activeDisplay, savedSets, isModelLoaded, applyDisplay, resetHighlight, evaluateSearchSet, activeProfile])

  // ── Drawing mode keyboard shortcuts ─────────────────────

  useEffect(() => {
    if (!isDrawingMode) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      const keyMap: Record<string, () => void> = {
        p: () => setDrawingSettings((s) => ({ ...s, tool: 'pen' })),
        l: () => setDrawingSettings((s) => ({ ...s, tool: 'line' })),
        r: () => setDrawingSettings((s) => ({ ...s, tool: 'rectangle' })),
        c: () => setDrawingSettings((s) => ({ ...s, tool: 'circle' })),
        a: () => setDrawingSettings((s) => ({ ...s, tool: 'arrow' })),
        t: () => setDrawingSettings((s) => ({ ...s, tool: 'text' })),
        e: () => setDrawingSettings((s) => ({ ...s, tool: 'eraser' })),
        Escape: () => setIsDrawingMode(false),
        Delete: () => annotations.clearAll(),
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault()
        annotations.undo()
        return
      }
      const action = keyMap[e.key]
      if (action) action()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isDrawingMode, annotations])

  // Toggle OrbitControls when drawing mode changes
  useEffect(() => {
    const controls = controlsRef.current
    if (controls) controls.enabled = !isDrawingMode
  }, [isDrawingMode])

  // Auto-clear annotations on orbit start (if not drawing)
  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const handleOrbitStart = () => {
      if (!isDrawingMode && annotations.hasAnnotations()) {
        annotations.clearAll()
        addNotification('info', 'Annotations cleared — save as viewpoint to keep')
      }
    }
    controls.addEventListener('start', handleOrbitStart)
    return () => controls.removeEventListener('start', handleOrbitStart)
  }, [isDrawingMode, annotations, addNotification])

  // ── Convert spatial tree ─────────────────────────────────

  const convertToTreeNodes = (node: IFCSpatialNode, depth = 0): TreeNode => {
    const typeMap: Record<string, TreeNode['type']> = {
      IfcProject: 'project', IFCPROJECT: 'project',
      IfcSite: 'site', IFCSITE: 'site',
      IfcBuilding: 'building', IFCBUILDING: 'building',
      IfcBuildingStorey: 'storey', IFCBUILDINGSTOREY: 'storey',
    }
    const nodeType = typeMap[node.type] || 'element'

    return {
      id: `ifc-${node.expressID}`,
      expressID: node.expressID,
      label: node.type.replace(/^Ifc/, '').replace(/^IFC/, ''),
      type: nodeType,
      expanded: depth < 2,
      children: node.children.length > 0
        ? node.children.map((c) => convertToTreeNodes(c, depth + 1))
        : undefined,
    }
  }

  // ── Fit camera to model ─────────────────────────────────

  const fitToModel = useCallback((group: THREE.Group) => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return

    const box = new THREE.Box3().setFromObject(group)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = camera.fov * (Math.PI / 180)
    const distance = maxDim / (2 * Math.tan(fov / 2)) * 1.5

    camera.position.set(center.x + distance * 0.5, center.y + distance * 0.5, center.z + distance * 0.5)
    controls.target.copy(center)
    controls.update()
  }, [])

  // ── Select element by raycasting ────────────────────────

  const selectElement = useCallback(async (expressID: number, ctrlKey = false) => {
    const service = ifcServiceRef.current
    if (!service) return

    if (!ctrlKey) {
      clearAllSelections()
    }

    // Highlight mesh
    const mesh = service.getMesh(expressID)
    if (mesh) {
      highlightMesh(expressID, mesh)
    }

    // Load properties
    const info = await service.getElementProperties(expressID)
    if (info) {
      if (ctrlKey) {
        const newIds = [...new Set([...selectedElementIds, expressID])]
        setSelectedElementIds(newIds)
        setSelectedElement({
          id: info.expressID,
          type: newIds.length > 1 ? `${newIds.length} elements selected` : info.type,
          name: newIds.length > 1 ? `Multi-selection (${newIds.length})` : info.name,
          properties: newIds.length > 1 ? [] : info.properties,
          material: newIds.length > 1 ? undefined : info.material,
          volume: newIds.length > 1 ? undefined : info.volume,
          area: newIds.length > 1 ? undefined : info.area,
        })
      } else {
        setSelectedElement({
          id: info.expressID,
          type: info.type,
          name: info.name,
          properties: info.properties,
          material: info.material,
          volume: info.volume,
          area: info.area,
        })
        setSelectedElementIds([expressID])
      }
      setShowProperties(true)
    }
  }, [setSelectedElementIds, selectedElementIds, clearAllSelections, highlightMesh])

  // ── Canvas click handler ────────────────────────────────

  const handleCanvasClick = useCallback(
    (event: MouseEvent) => {
      if (isDrawingMode) return

      // Measure tool click
      if (activeTool === 'measure') {
        if (event.detail === 2) {
          measureTool.handleMeasureDoubleClick(event)
        } else {
          measureTool.handleMeasureClick(event)
        }
        return
      }

      if (activeTool !== 'select') return
      const container = containerRef.current
      const camera = cameraRef.current
      const group = modelGroupRef.current
      if (!container || !camera || !group) return

      const rect = container.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      )

      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(group.children, true)

      if (intersects.length > 0) {
        const hit = intersects[0].object
        const expressID = hit.userData.expressID
        if (expressID !== undefined) {
          selectElement(expressID, event.ctrlKey || event.metaKey)
        }
      } else {
        // Deselect all
        clearAllSelections()
        setSelectedElement(null)
        setShowProperties(false)
        setSelectedElementIds([])
      }
    },
    [activeTool, selectElement, isDrawingMode, measureTool, clearAllSelections, setSelectedElementIds],
  )

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return
    const canvas = renderer.domElement
    canvas.addEventListener('click', handleCanvasClick)
    return () => canvas.removeEventListener('click', handleCanvasClick)
  }, [handleCanvasClick])

  // ── Handle real IFC file upload ─────────────────────────

  const handleFileUpload = useCallback(
    async (files: File[]) => {
      const file = files[0]
      if (!file) return

      const scene = sceneRef.current
      if (!scene) return

      // For multi-file: if no model loaded yet, create a parent group
      if (!modelGroupRef.current) {
        const parentGroup = new THREE.Group()
        parentGroup.name = 'IFCModels'
        scene.add(parentGroup)
        modelGroupRef.current = parentGroup
      }

      setLoadingProgress({ stage: 'init', percent: 0, message: 'Initializing...' })

      try {
        // Init service if needed
        if (!ifcServiceRef.current) {
          ifcServiceRef.current = new IFCService()
          await ifcServiceRef.current.init()
        }

        setLoadingProgress({ stage: 'init', percent: 5, message: 'WASM ready' })

        const result = await ifcServiceRef.current.loadFile(file, (p) => {
          setLoadingProgress(p)
        })

        modelGroupRef.current.add(result.group)

        fitToModel(modelGroupRef.current)
        sectionPlanes.initBounds(modelGroupRef.current)

        const treeNodes = convertToTreeNodes(result.tree)
        setTreeData((prev) => [...prev, treeNodes])
        setModelStats(result.stats)
        setModelFile(file.name)
        setIsModelLoaded(true)
        setShowLeftPanel(true)
        setLoadingProgress(null)
        setLoadedModels(ifcServiceRef.current.getLoadedModels())

        addNotification('success', `Model loaded: ${result.stats.totalElements} elements`)
      } catch (err) {
        console.error('IFC load error:', err)
        setLoadingProgress(null)
        addNotification('error', `Failed to load IFC: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    },
    [addNotification, fitToModel, sectionPlanes],
  )

  // ── Tool handlers ───────────────────────────────────────

  const handleToolClick = (tool: ToolMode) => {
    // Cancel pending states when switching tools
    if (activeTool === 'measure' && tool !== 'measure') {
      measureTool.cancelPending()
    }

    setActiveTool(tool)
    const controls = controlsRef.current
    if (!controls) return

    switch (tool) {
      case 'pan':
        controls.mouseButtons = { LEFT: THREE.MOUSE.PAN as number, MIDDLE: THREE.MOUSE.DOLLY as number, RIGHT: THREE.MOUSE.ROTATE as number }
        break
      case 'rotate':
        controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE as number, MIDDLE: THREE.MOUSE.DOLLY as number, RIGHT: THREE.MOUSE.PAN as number }
        break
      case 'zoom':
        controls.mouseButtons = { LEFT: THREE.MOUSE.DOLLY as number, MIDDLE: THREE.MOUSE.DOLLY as number, RIGHT: THREE.MOUSE.PAN as number }
        break
      case 'select':
      default:
        controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE as number, MIDDLE: THREE.MOUSE.DOLLY as number, RIGHT: THREE.MOUSE.PAN as number }
        break
    }
  }

  const fitToView = () => {
    const group = modelGroupRef.current
    if (group) {
      fitToModel(group)
    } else {
      const camera = cameraRef.current
      const controls = controlsRef.current
      if (camera && controls) {
        camera.position.set(30, 20, 30)
        controls.target.set(0, 3, 0)
        controls.update()
      }
    }
    addNotification('info', 'View reset to fit model')
  }

  // ── Viewpoint handlers ──────────────────────────────────

  const handleSaveViewpoint = (name: string) => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    const renderer = rendererRef.current
    if (!camera || !controls || !renderer) return

    const annotationDataURL = annotations.getCanvasDataURL()

    // Create composite thumbnail
    let thumbnail = ''
    try {
      const threeCanvas = renderer.domElement
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = 320
      tempCanvas.height = 180
      const ctx = tempCanvas.getContext('2d')!
      ctx.drawImage(threeCanvas, 0, 0, 320, 180)
      // Overlay annotations if any
      if (annotationCanvasRef.current) {
        ctx.drawImage(annotationCanvasRef.current, 0, 0, 320, 180)
      }
      thumbnail = tempCanvas.toDataURL('image/jpeg', 0.7)
    } catch {
      // thumbnail generation may fail in some contexts
    }

    const viewpoint: SavedViewpoint = {
      id: Date.now().toString(),
      name,
      thumbnail,
      cameraState: {
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
        zoom: camera.zoom,
        fov: camera.fov,
      },
      annotationDataURL,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    addViewpoint(viewpoint)
    addNotification('success', `Viewpoint "${name}" saved`)
  }

  const handleRestoreViewpoint = (vp: SavedViewpoint) => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return

    camera.position.set(vp.cameraState.position.x, vp.cameraState.position.y, vp.cameraState.position.z)
    controls.target.set(vp.cameraState.target.x, vp.cameraState.target.y, vp.cameraState.target.z)
    camera.zoom = vp.cameraState.zoom
    camera.fov = vp.cameraState.fov
    camera.updateProjectionMatrix()
    controls.update()

    // Restore annotations
    if (vp.annotationDataURL) {
      annotations.restoreFromDataURL(vp.annotationDataURL)
    } else {
      annotations.clearAll()
    }
  }

  // ── Profiler handlers ───────────────────────────────────

  const handleApplyProfile = async (field: string) => {
    const service = ifcServiceRef.current
    const group = modelGroupRef.current
    if (!service || !group) return

    setIsProfilerProcessing(true)
    try {
      const legend = await buildProfile(service, field as 'type' | 'name' | 'material' | 'objectType', group)
      setActiveProfile({ field, legend })
    } finally {
      setIsProfilerProcessing(false)
    }
  }

  const handleClearProfile = () => {
    const group = modelGroupRef.current
    if (group) clearProfile(group)
    setActiveProfile(null)
  }

  // ── Export handlers ─────────────────────────────────────

  const handleExport = async (scope: 'all' | 'selected' | 'set', setId?: string) => {
    const service = ifcServiceRef.current
    if (!service) return

    setIsExporting(true)
    setExportProgress(0)

    try {
      const set = setId ? savedSets.find((s) => s.id === setId) : undefined
      await exportToExcel(service, modelFile || 'model', {
        scope,
        selectedIds: selectedElementIds,
        set,
        evaluateSearchSet,
      }, setExportProgress)
      addNotification('success', 'Excel export complete')
      setShowExportDialog(false)
    } catch (err) {
      addNotification('error', `Export failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    } finally {
      setIsExporting(false)
      setExportProgress(0)
    }
  }

  // ── Section update handler ──────────────────────────────

  const handleSectionUpdate = useCallback((mode: SectionMode, planes: ClipPlaneState[], box: ClipBoxState) => {
    sectionPlanes.updateClipping(mode, planes, box)
  }, [sectionPlanes])

  // ── Tree toggle & click ─────────────────────────────────

  const toggleTreeNode = (nodeId: string) => {
    const toggle = (nodes: TreeNode[]): TreeNode[] =>
      nodes.map((n) => ({
        ...n,
        expanded: n.id === nodeId ? !n.expanded : n.expanded,
        children: n.children ? toggle(n.children) : undefined,
      }))
    setTreeData(toggle(treeData))
  }

  const handleTreeClick = (node: TreeNode) => {
    if (node.children && node.children.length > 0) {
      toggleTreeNode(node.id)
    }
    if (node.expressID > 0) {
      selectElement(node.expressID)
    }
  }

  // ── Render tree ─────────────────────────────────────────

  const renderTreeNode = (node: TreeNode, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0
    const iconMap: Record<string, React.ReactNode> = {
      project: <Building2 size={14} className="text-primary" />,
      site: <Grid3x3 size={14} className="text-success" />,
      building: <Building2 size={14} className="text-warning" />,
      storey: <Layers size={14} className="text-primary" />,
      element: <Box size={14} className="text-muted-foreground" />,
    }

    return (
      <div key={node.id}>
        <button
          className="flex items-center gap-1.5 w-full px-2 py-1.5 text-left text-sm hover:bg-muted rounded transition-colors"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => handleTreeClick(node)}
        >
          {hasChildren ? (
            node.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : (
            <span className="w-3" />
          )}
          {iconMap[node.type]}
          <span className="truncate text-foreground">{node.label}</span>
          {node.children && (
            <span className="text-[10px] text-muted-foreground ml-auto">({node.children.length})</span>
          )}
        </button>
        {hasChildren && node.expanded && node.children!.map((child) => renderTreeNode(child, depth + 1))}
      </div>
    )
  }

  // ── Toolbar buttons ─────────────────────────────────────

  const tools: { id: ToolMode; icon: React.ReactNode; label: string }[] = [
    { id: 'select', icon: <MousePointer2 size={18} />, label: 'Select' },
    { id: 'pan', icon: <Move size={18} />, label: 'Pan' },
    { id: 'rotate', icon: <RotateCcw size={18} />, label: 'Rotate' },
    { id: 'zoom', icon: <ZoomIn size={18} />, label: 'Zoom' },
    { id: 'measure', icon: <Ruler size={18} />, label: 'Measure' },
    { id: 'section', icon: <Scissors size={18} />, label: 'Section' },
  ]

  // ── Left panel tabs config ──────────────────────────────

  const leftTabs: { id: LeftTab; icon: React.ReactNode; label: string }[] = [
    { id: 'tree', icon: <Layers size={14} />, label: 'Tree' },
    { id: 'sets', icon: <Bookmark size={14} />, label: 'Sets' },
    { id: 'viewpoints', icon: <Camera size={14} />, label: 'Views' },
    { id: 'profiler', icon: <Palette size={14} />, label: 'Profiler' },
    { id: 'models', icon: <Box size={14} />, label: 'Models' },
  ]

  // ── Render ──────────────────────────────────────────────

  return (
    <MotionPage>
      <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
        {/* Header */}
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">3D IFC Viewer</h1>
            <p className="text-muted-foreground mt-0.5">
              {modelFile ? modelFile : 'Upload an IFC file to view and inspect 3D building models'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label>
              <Button variant="primary" icon={<Upload size={16} />} onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = '.ifc'
                input.onchange = (e) => {
                  const files = (e.target as HTMLInputElement).files
                  if (files) handleFileUpload(Array.from(files))
                }
                input.click()
              }}>
                Upload IFC
              </Button>
            </label>
          </div>
        </motion.div>

        {/* Main viewer area */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left Panel (Tree + Search Sets + Viewpoints + Profiler) */}
          <AnimatePresence mode="wait">
            {showLeftPanel && (
              <motion.div
                key="left-panel"
                variants={fadeInLeft}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="w-72 flex flex-col border border-border rounded-xl bg-card overflow-hidden shrink-0"
              >
                {/* Tabs */}
                <div className="flex items-center border-b border-border">
                  {leftTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setLeftTab(tab.id)}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-2.5 text-[11px] font-medium transition-colors ${
                        leftTab === tab.id
                          ? 'text-foreground border-b-2 border-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                {leftTab === 'tree' ? (
                  <>
                    <div className="flex-1 overflow-y-auto py-2">
                      {treeData.length > 0 ? (
                        treeData.map((node) => renderTreeNode(node))
                      ) : (
                        <p className="px-4 py-6 text-xs text-muted-foreground/60 text-center">
                          Load an IFC file to see the spatial tree
                        </p>
                      )}
                    </div>
                    {/* Model stats at bottom */}
                    {modelStats && (
                      <div className="border-t border-border p-3 space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Model Info</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <span className="text-muted-foreground">Elements</span>
                          <span className="text-foreground font-medium">{modelStats.totalElements.toLocaleString()}</span>
                          <span className="text-muted-foreground">Types</span>
                          <span className="text-foreground font-medium">{modelStats.types}</span>
                          <span className="text-muted-foreground">Stories</span>
                          <span className="text-foreground font-medium">{modelStats.stories}</span>
                          <span className="text-muted-foreground">Materials</span>
                          <span className="text-foreground font-medium">{modelStats.materials}</span>
                          <span className="text-muted-foreground">IFC Version</span>
                          <span className="text-foreground font-medium">{modelStats.ifcVersion}</span>
                          <span className="text-muted-foreground">File Size</span>
                          <span className="text-foreground font-medium">{modelStats.fileSize}</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : leftTab === 'sets' ? (
                  <SearchSetsPanel selectedIds={selectedElementIds} />
                ) : leftTab === 'viewpoints' ? (
                  <ViewpointsPanel onRestore={handleRestoreViewpoint} />
                ) : leftTab === 'profiler' ? (
                  <AppearanceProfilerPanel
                    activeProfile={activeProfile}
                    onApply={handleApplyProfile}
                    onClear={handleClearProfile}
                    isProcessing={isProfilerProcessing}
                  />
                ) : (
                  /* Models tab */
                  <div className="flex-1 overflow-y-auto py-2">
                    {loadedModels.length === 0 ? (
                      <p className="px-4 py-6 text-xs text-muted-foreground/60 text-center">
                        No models loaded
                      </p>
                    ) : (
                      <div className="space-y-1 px-2">
                        {loadedModels.map((model) => (
                          <div key={model.modelID} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted group">
                            <Box size={14} className="text-primary shrink-0" />
                            <span className="flex-1 text-xs font-medium text-foreground truncate">{model.fileName}</span>
                            <button
                              title={model.visible ? 'Hide' : 'Show'}
                              onClick={() => {
                                ifcServiceRef.current?.setModelVisibility(model.modelID, !model.visible)
                                setLoadedModels(ifcServiceRef.current?.getLoadedModels() || [])
                              }}
                              className="p-1 rounded text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                            >
                              {model.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>
                            <button
                              title="Remove model"
                              onClick={() => {
                                const scene = sceneRef.current
                                if (scene && ifcServiceRef.current) {
                                  ifcServiceRef.current.removeModel(model.modelID, scene)
                                  setLoadedModels(ifcServiceRef.current.getLoadedModels())
                                  if (ifcServiceRef.current.getLoadedModels().length === 0) {
                                    setIsModelLoaded(false)
                                    setTreeData([])
                                    setModelFile(null)
                                    setModelStats(null)
                                    if (modelGroupRef.current) {
                                      scene.remove(modelGroupRef.current)
                                      modelGroupRef.current = null
                                    }
                                  }
                                  addNotification('info', `Removed: ${model.fileName}`)
                                }
                              }}
                              className="p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Viewport */}
          <div className="flex-1 relative rounded-xl border border-border overflow-hidden bg-card">
            {/* Toolbar */}
            <motion.div
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              className="absolute top-3 left-3 z-10 flex items-center gap-1 backdrop-blur-md bg-card/80 ring-1 ring-border rounded-lg shadow-lg p-1"
            >
              {tools.map((tool) => (
                <motion.button
                  key={tool.id}
                  title={tool.label}
                  onClick={() => handleToolClick(tool.id)}
                  whileTap={{ scale: 0.95 }}
                  className={`p-2 rounded-md transition-colors ${
                    activeTool === tool.id
                      ? 'bg-primary text-white ring-1 ring-primary/50'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {tool.icon}
                </motion.button>
              ))}
              <div className="w-px h-6 bg-border mx-1" />
              <motion.button
                title="Fit to View"
                onClick={fitToView}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Maximize size={18} />
              </motion.button>
              <motion.button
                title="Zoom to Selected"
                onClick={zoomToSelected}
                whileTap={{ scale: 0.95 }}
                disabled={selectedElementIds.length === 0}
                className={`p-2 rounded-md transition-colors ${
                  selectedElementIds.length === 0
                    ? 'text-muted-foreground/30 cursor-not-allowed'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Focus size={18} />
              </motion.button>
              <motion.button
                title="Zoom In"
                onClick={() => {
                  const cam = cameraRef.current
                  if (cam) { cam.position.multiplyScalar(0.85); controlsRef.current?.update() }
                }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ZoomIn size={18} />
              </motion.button>
              <motion.button
                title="Zoom Out"
                onClick={() => {
                  const cam = cameraRef.current
                  if (cam) { cam.position.multiplyScalar(1.15); controlsRef.current?.update() }
                }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ZoomOut size={18} />
              </motion.button>
            </motion.div>

            {/* Side buttons */}
            <motion.div
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              className="absolute top-3 right-3 z-10 flex flex-col gap-1"
            >
              <motion.button
                title={showLeftPanel ? 'Hide Panel' : 'Show Panel'}
                onClick={() => setShowLeftPanel(!showLeftPanel)}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg backdrop-blur-md bg-card/80 ring-1 ring-border shadow-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                {showLeftPanel ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
              </motion.button>
              <motion.button
                title="Model Info"
                onClick={() => {
                  if (modelStats) {
                    addNotification('info', `Model: ${modelStats.totalElements} elements, ${modelStats.types} types, ${modelStats.stories} stories`)
                  } else {
                    addNotification('info', 'No model loaded')
                  }
                }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg backdrop-blur-md bg-card/80 ring-1 ring-border shadow-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                <Info size={18} />
              </motion.button>
              <motion.button
                title="Toggle Visibility"
                onClick={() => addNotification('info', 'Toggle element visibility')}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg backdrop-blur-md bg-card/80 ring-1 ring-border shadow-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                {isModelLoaded ? <Eye size={18} /> : <EyeOff size={18} />}
              </motion.button>
              <motion.button
                title={isWireframe ? 'Solid Mode' : 'Wireframe Mode'}
                onClick={() => {
                  const next = !isWireframe
                  setIsWireframe(next)
                  wireframe.toggle(modelGroupRef.current, next)
                }}
                whileTap={{ scale: 0.95 }}
                disabled={!isModelLoaded}
                className={`p-2 rounded-lg backdrop-blur-md ring-1 shadow-lg transition-colors ${
                  isWireframe
                    ? 'bg-primary text-white ring-primary/50'
                    : isModelLoaded
                      ? 'bg-card/80 ring-border text-muted-foreground hover:text-foreground'
                      : 'bg-card/80 ring-border text-muted-foreground/30 cursor-not-allowed'
                }`}
              >
                <Grid3x3 size={18} />
              </motion.button>
              <motion.button
                title={isDrawingMode ? 'Exit Drawing Mode' : 'Drawing Mode'}
                onClick={() => setIsDrawingMode(!isDrawingMode)}
                whileTap={{ scale: 0.95 }}
                className={`p-2 rounded-lg backdrop-blur-md ring-1 shadow-lg transition-colors ${
                  isDrawingMode
                    ? 'bg-primary text-white ring-primary/50'
                    : 'bg-card/80 ring-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <Pencil size={18} />
              </motion.button>
              <motion.button
                title="Export to Excel"
                onClick={() => setShowExportDialog(true)}
                whileTap={{ scale: 0.95 }}
                disabled={!isModelLoaded}
                className={`p-2 rounded-lg backdrop-blur-md bg-card/80 ring-1 ring-border shadow-lg transition-colors ${
                  isModelLoaded
                    ? 'text-muted-foreground hover:text-foreground'
                    : 'text-muted-foreground/30 cursor-not-allowed'
                }`}
              >
                <Download size={18} />
              </motion.button>
            </motion.div>

            {/* Annotation canvas overlay */}
            <AnnotationCanvas
              canvasRef={annotationCanvasRef}
              active={isDrawingMode}
              containerRef={containerRef}
            />

            {/* Drawing toolbar (bottom center when drawing mode active) */}
            <AnimatePresence>
              {isDrawingMode && (
                <DrawingToolbar
                  settings={drawingSettings}
                  onSettingsChange={(s) => setDrawingSettings((prev) => ({ ...prev, ...s }))}
                  onUndo={annotations.undo}
                  onClear={annotations.clearAll}
                  onSaveViewpoint={() => setSaveViewpointOpen(true)}
                />
              )}
            </AnimatePresence>

            {/* Measure panel */}
            {activeTool === 'measure' && (
              <MeasurePanel
                getMeasurements={measureTool.getMeasurements}
                hasPendingPoint={measureTool.hasPendingPoint}
                onDelete={measureTool.deleteMeasurement}
                onClearAll={measureTool.clearAllMeasurements}
                mode={measureMode}
                onModeChange={(m) => { setMeasureMode(m); measureTool.setMode(m) }}
              />
            )}

            {/* Section panel */}
            {activeTool === 'section' && (
              <SectionPanel onUpdate={handleSectionUpdate} />
            )}

            {/* Loading overlay */}
            <AnimatePresence>
              {loadingProgress && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                >
                  <div className="text-center">
                    <Loader2 size={40} className="mx-auto text-primary animate-spin mb-4" />
                    <p className="text-sm font-medium text-foreground mb-2">{loadingProgress.message}</p>
                    <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${loadingProgress.percent}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">{loadingProgress.percent}%</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* No model placeholder */}
            <AnimatePresence>
              {!isModelLoaded && !loadingProgress && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-[5] flex items-center justify-center pointer-events-none"
                >
                  <div className="text-center pointer-events-auto">
                    <div className="flex flex-col items-center gap-3 mb-4">
                      <motion.div
                        variants={shimmer}
                        initial="hidden"
                        animate="visible"
                        className="w-32 h-24 rounded-lg bg-muted/40"
                      />
                      <div className="flex gap-2">
                        <motion.div
                          variants={shimmer}
                          initial="hidden"
                          animate="visible"
                          className="w-16 h-3 rounded bg-muted/30"
                        />
                        <motion.div
                          variants={shimmer}
                          initial="hidden"
                          animate="visible"
                          className="w-24 h-3 rounded bg-muted/30"
                        />
                      </div>
                    </div>
                    <Box size={48} className="mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">No model loaded</p>
                    <p className="text-muted-foreground/60 text-xs mt-1">Upload an IFC file to view and inspect 3D building models</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Three.js container */}
            <div ref={containerRef} className="w-full h-full" />
          </div>

          {/* Properties Panel */}
          <AnimatePresence mode="wait">
            {showProperties && selectedElement && (
              <motion.div
                key="properties-panel"
                variants={fadeInRight}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="w-80 flex flex-col border border-border rounded-xl bg-card overflow-hidden shrink-0"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Element Properties</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedElement.type}</p>
                  </div>
                  <button onClick={() => { setShowProperties(false); setSelectedElement(null) }} className="p-1 hover:bg-muted rounded">
                    <X size={14} className="text-muted-foreground" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div className="px-4 py-3 border-b border-border bg-muted/50">
                    <p className="text-sm font-medium text-foreground">{selectedElement.name}</p>
                    {selectedElementIds.length > 1 && (
                      <button
                        onClick={() => { setShowLeftPanel(true); setLeftTab('sets') }}
                        className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                      >
                        <Bookmark size={12} />
                        Create Search Set ({selectedElementIds.length})
                      </button>
                    )}
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-card rounded-lg p-2 border border-border">
                        <p className="text-muted-foreground">Express ID</p>
                        <p className="font-medium text-foreground">{selectedElement.id}</p>
                      </div>
                      <div className="bg-card rounded-lg p-2 border border-border">
                        <p className="text-muted-foreground">Type</p>
                        <p className="font-medium text-foreground">{selectedElement.type}</p>
                      </div>
                      {selectedElement.volume && (
                        <div className="bg-card rounded-lg p-2 border border-border">
                          <p className="text-muted-foreground">Volume</p>
                          <p className="font-medium text-foreground">{selectedElement.volume}</p>
                        </div>
                      )}
                      {selectedElement.area && (
                        <div className="bg-card rounded-lg p-2 border border-border">
                          <p className="text-muted-foreground">Area</p>
                          <p className="font-medium text-foreground">{selectedElement.area}</p>
                        </div>
                      )}
                    </div>
                    {selectedElement.material && (
                      <div className="mt-2 text-xs">
                        <span className="text-muted-foreground">Material: </span>
                        <span className="text-foreground font-medium">{selectedElement.material}</span>
                      </div>
                    )}
                    {/* Color button */}
                    {selectedElementIds.length === 1 && (
                      <div className="relative mt-2">
                        <button
                          onClick={() => setShowColorPicker(!showColorPicker)}
                          className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-foreground bg-muted rounded-md hover:bg-muted/80 transition-colors"
                        >
                          <Palette size={10} />
                          <span>Color</span>
                          {customColors[`el-${selectedElement.id}`] && (
                            <div className="w-3 h-3 rounded-sm border border-border" style={{ backgroundColor: customColors[`el-${selectedElement.id}`] }} />
                          )}
                        </button>
                        {showColorPicker && (
                          <ColorPickerPopover
                            currentColor={customColors[`el-${selectedElement.id}`]}
                            onApply={(color) => {
                              setCustomColor(`el-${selectedElement.id}`, color)
                              // Apply color visually to mesh
                              const mesh = ifcServiceRef.current?.getMesh(selectedElement.id)
                              if (mesh && mesh.material instanceof THREE.MeshPhysicalMaterial) {
                                const mat = mesh.material.clone()
                                mat.color.set(color)
                                mesh.material = mat
                              }
                            }}
                            onClear={() => {
                              clearCustomColor(`el-${selectedElement.id}`)
                              // Restore original — re-select to refresh
                              const entry = selectedMeshesRef.current.get(selectedElement.id)
                              if (entry) {
                                entry.mesh.material = entry.originalMaterial
                              }
                            }}
                            onClose={() => setShowColorPicker(false)}
                          />
                        )}
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">All Properties</p>
                    <div className="space-y-0">
                      {selectedElement.properties.map((prop, i) => (
                        <div
                          key={i}
                          className={`flex justify-between items-start py-2 px-2 rounded text-xs ${
                            i % 2 === 0 ? 'bg-muted/30' : ''
                          } ${
                            i < selectedElement.properties.length - 1 ? 'border-b border-border/50' : ''
                          }`}
                        >
                          <span className="text-muted-foreground shrink-0 mr-3">{prop.name}</span>
                          <span className="text-foreground font-medium text-right break-all">{prop.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Dialogs */}
      <SaveViewpointDialog
        open={saveViewpointOpen}
        onClose={() => setSaveViewpointOpen(false)}
        onSave={handleSaveViewpoint}
      />
      <ExportDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={handleExport}
        selectedCount={selectedElementIds.length}
        savedSets={savedSets}
        isExporting={isExporting}
        exportProgress={exportProgress}
      />
    </MotionPage>
  )
}
