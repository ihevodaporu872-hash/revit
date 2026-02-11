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
  FileSpreadsheet,
  BarChart3,
  CheckCircle2,
} from 'lucide-react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js'
import { Button } from '../ui/Button'
import { useAppStore } from '../../store/appStore'
import { useViewerStore } from '../../store/viewerStore'
import { MotionPage } from '../MotionPage'
import { IFCService } from './ifc/ifcService'
import type { IFCSpatialNode, IFCModelStats, IFCElementInfo, LoadingProgress, DrawingSettings, SavedViewpoint, ClipPlaneState, ClipBoxState, SectionMode, MeasureMode, CoverageSummary, SummaryGroupBy, SummaryData } from './ifc/types'
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
import { useRevitEnrichment } from './useRevitEnrichment'
import { RevitPropertiesPanel } from './RevitPropertiesPanel'
import { useElementMatcher } from './useElementMatcher'
import { MatchingReport } from './MatchingReport'
import { useWireframe } from './useWireframe'
import { ColorPickerPopover } from './ColorPickerPopover'
import { usePropertiesSummary } from './usePropertiesSummary'
import { PropertiesSummaryPanel } from './PropertiesSummaryPanel'
import { useOutlineHighlight } from './useOutlineHighlight'
import { uploadRevitXlsx, processRevitModel } from '../../services/revit-api'
import type { RevitProcessModelResponse } from '../../services/revit-api'
import { RevitUploadModal } from './RevitUploadModal'
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
  tag?: string
  globalId?: string
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
type LeftTab = 'tree' | 'sets' | 'viewpoints' | 'profiler' | 'models' | 'summary'

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let idx = 0
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx += 1
  }
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`
}

// ── Component ──────────────────────────────────────────────────────────

export default function ViewerPage() {
  const { addNotification } = useAppStore()
  const {
    savedSets, activeDisplay, selectedElementIds, setSelectedElementIds,
    setActiveDisplay, addToSelection, addViewpoint, activeProfile, setActiveProfile,
    customColors, setCustomColor, clearCustomColor,
    highlightedSummaryGroup, setHighlightedSummaryGroup,
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
  const revitEnrichment = useRevitEnrichment()
  const elementMatcher = useElementMatcher()
  const setRevitScope = useCallback((projectId: string, modelVersion?: string) => {
    const scope = { projectId, modelVersion }
    setRevitScopeState(scope)
    revitEnrichment.setScope(scope)
  }, [revitEnrichment])

  // Summary state
  const [summaryGroupBy, setSummaryGroupBy] = useState<SummaryGroupBy>('type')
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const propertiesSummary = usePropertiesSummary()
  const outlineHighlight = useOutlineHighlight()

  // Matching state
  const [showMatchReport, setShowMatchReport] = useState(false)
  const [showMatchHighlight, setShowMatchHighlight] = useState(false)
  const matchOverlayRef = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map())
  const [revitScope, setRevitScopeState] = useState<{ projectId: string; modelVersion?: string }>({ projectId: 'default' })
  const [xlsxCoverage, setXlsxCoverage] = useState<CoverageSummary | null>(null)
  const [showRevitUploadModal, setShowRevitUploadModal] = useState(false)

  const setRvtProgress = useCallback((percent: number, message: string, stage: LoadingProgress['stage'] = 'parsing') => {
    const bounded = Math.max(0, Math.min(100, Math.round(percent)))
    setLoadingProgress({ stage, percent: bounded, message })
  }, [])

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

  // Update outline resolution on resize
  useEffect(() => {
    const handleOutlineResize = () => {
      const container = containerRef.current
      if (container) {
        outlineHighlight.updateResolution(container.clientWidth, container.clientHeight)
      }
    }
    window.addEventListener('resize', handleOutlineResize)
    return () => window.removeEventListener('resize', handleOutlineResize)
  }, [outlineHighlight])

  useEffect(() => {
    revitEnrichment.setScope(revitScope)
  }, [revitEnrichment, revitScope])

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
          tag: info.tag,
          globalId: info.globalId,
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
          tag: info.tag,
          globalId: info.globalId,
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

  const loadDaeFromUrl = useCallback(
    async (daeUrl: string, fileName: string, fileSize = 0) => {
      const scene = sceneRef.current
      if (!scene) return

      // For multi-file: if no model loaded yet, create a parent group
      if (!modelGroupRef.current) {
        const parentGroup = new THREE.Group()
        parentGroup.name = 'DAEModels'
        scene.add(parentGroup)
        modelGroupRef.current = parentGroup
      }

      setLoadingProgress({ stage: 'init', percent: 10, message: 'Загрузка DAE модели...' })

      const response = await fetch(daeUrl)
      if (!response.ok) {
        throw new Error(`Failed to load DAE (${response.status})`)
      }
      const daeText = await response.text()
      setLoadingProgress({ stage: 'geometry', percent: 55, message: 'Парсинг DAE...' })

      const loader = new ColladaLoader()
      const collada = loader.parse(daeText, '')
      modelGroupRef.current.add(collada.scene)

      fitToModel(modelGroupRef.current)
      sectionPlanes.initBounds(modelGroupRef.current)

      setModelFile(fileName)
      setIsModelLoaded(true)
      setShowLeftPanel(true)
      setModelStats({
        totalElements: 0,
        types: 0,
        stories: 0,
        materials: 0,
        ifcVersion: 'DAE',
        fileSize: formatBytes(fileSize),
      })
      setLoadingProgress(null)
      setLoadedModels([])
      addNotification('success', 'DAE модель загружена (без IFC свойств)')
    },
    [addNotification, fitToModel, sectionPlanes],
  )

  const handleFileUpload = useCallback(
    async (files: File[], scopeOverride?: { projectId: string; modelVersion?: string }) => {
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

        // Auto-scan summary in background
        const svc = ifcServiceRef.current
        if (svc) {
          propertiesSummary.scanElements(svc).then(() => {
            const data = propertiesSummary.buildSummary(summaryGroupBy)
            setSummaryData(data)
          })
        }

        // Prefetch Revit enrichment data for all GlobalIds + ElementIds in this model
        const service = ifcServiceRef.current
        if (service) {
          const allGlobalIds: string[] = []
          const allElementIds: number[] = []
          const allIfcElements: IFCElementInfo[] = []
          const extractIds = async (node: IFCSpatialNode) => {
            const info = await service.getElementProperties(node.expressID)
            if (info) {
              allIfcElements.push(info)
              if (info.globalId) allGlobalIds.push(info.globalId)
              if (info.tag) {
                const tagNum = parseInt(info.tag, 10)
                if (!isNaN(tagNum)) allElementIds.push(tagNum)
              }
            }
            for (const child of node.children) {
              await extractIds(child)
            }
          }
          // Run in background — don't block UI
          extractIds(result.tree).then(async () => {
            const scope = scopeOverride || revitScope
            if (allGlobalIds.length > 0) await revitEnrichment.prefetchBulk(allGlobalIds, scope)
            if (allElementIds.length > 0) await revitEnrichment.prefetchByElementIds(allElementIds, scope)
            // Auto-run matching if we have Revit data
            const cachedProps = revitEnrichment.getAllCachedProps()
            if (cachedProps.length > 0 && allIfcElements.length > 0) {
              elementMatcher.runMatching(allIfcElements, cachedProps)
            }
          })
        }
      } catch (err) {
        console.error('IFC load error:', err)
        setLoadingProgress(null)
        addNotification('error', `Failed to load IFC: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    },
    [addNotification, fitToModel, sectionPlanes, revitEnrichment, revitScope, elementMatcher, propertiesSummary, summaryGroupBy],
  )

  // ── RVT Upload (auto-convert RVT -> IFC/XLSX/DAE) ───────────────────────

  const handleRvtUpload = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.rvt'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      let convertTicker: ReturnType<typeof setInterval> | null = null
      const stopTicker = () => {
        if (convertTicker) {
          clearInterval(convertTicker)
          convertTicker = null
        }
      }

      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', revitScope.projectId)
      if (revitScope.modelVersion) formData.append('modelVersion', revitScope.modelVersion)
      formData.append('ifcSchema', 'IFC4X3')

      try {
        setRvtProgress(8, 'Шаг 1/4: загрузка Revit модели (.rvt)...', 'init')
        setRvtProgress(14, 'Шаг 2/4: конвертация RVT -> IFC4X3 + Excel + DAE...', 'parsing')

        convertTicker = setInterval(() => {
          setLoadingProgress((prev) => {
            const current = prev?.percent ?? 14
            const next = current < 72
              ? Math.min(72, current + (current < 40 ? 3 : 1))
              : current
            return {
              stage: 'parsing',
              percent: next,
              message: 'Шаг 2/4: конвертация RVT -> IFC4X3 + Excel + DAE...',
            }
          })
        }, 700)

        const result = await processRevitModel(formData)
        stopTicker()

        const nextScope = {
          projectId: result.projectId || revitScope.projectId,
          modelVersion: result.modelVersion || revitScope.modelVersion,
        }
        setRevitScope(nextScope.projectId, nextScope.modelVersion)

        if (result.status === 'fallback') {
          setRvtProgress(100, 'Конвертер недоступен. Используйте режим IFC + Revit XLSX.', 'done')
          setTimeout(() => setLoadingProgress(null), 900)
          addNotification('warning', 'RVT converter unavailable. Use IFC + Revit XLSX upload mode.')
          return
        }

        setRvtProgress(78, 'Шаг 3/4: импорт параметров Revit из сгенерированного Excel...', 'parsing')
        if (result.xlsxImport?.coverage) {
          setXlsxCoverage(result.xlsxImport.coverage)
        }

        const backendBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

        if (!result.outputs?.ifcPath && !result.outputs?.daePath) {
          setLoadingProgress(null)
          addNotification('error', 'RVT processed, but IFC/DAE output is missing.')
          return
        }

        if (result.outputs?.ifcPath) {
          setRvtProgress(90, 'Шаг 4/4: загрузка конвертированной IFC модели в viewer...', 'geometry')
          const ifcUrl = /^https?:\/\//i.test(result.outputs.ifcPath)
            ? result.outputs.ifcPath
            : `${backendBase}${result.outputs.ifcPath}`
          const ifcResponse = await fetch(ifcUrl)
          if (!ifcResponse.ok) {
            throw new Error(`Failed to load converted IFC (${ifcResponse.status})`)
          }
          const ifcBlob = await ifcResponse.blob()
          const ifcFileName = result.outputs.ifcPath.split('/').pop() || `${file.name.replace(/\.rvt$/i, '')}.ifc`
          const ifcFile = new File([ifcBlob], ifcFileName, { type: 'application/octet-stream' })
          await handleFileUpload([ifcFile], nextScope)
        } else if (result.outputs?.daePath) {
          setRvtProgress(90, 'Шаг 4/4: загрузка конвертированной DAE модели в viewer...', 'geometry')
          const daeUrl = /^https?:\/\//i.test(result.outputs.daePath)
            ? result.outputs.daePath
            : `${backendBase}${result.outputs.daePath}`
          const daeFileName = result.outputs.daePath.split('/').pop() || `${file.name.replace(/\.rvt$/i, '')}.dae`
          await loadDaeFromUrl(daeUrl, daeFileName, file.size)
        }
        setRvtProgress(100, 'Готово: связка IFC + Revit Excel построена.', 'done')
        setTimeout(() => setLoadingProgress(null), 800)

        const extras: string[] = []
        if (result.outputs.xlsxPath) extras.push('XLSX')
        if (result.outputs.daePath) extras.push('DAE')
        addNotification('success', `RVT converted to IFC4X3${extras.length ? ` + ${extras.join(' + ')}` : ''}`)
      } catch (err) {
        stopTicker()
        setLoadingProgress(null)
        addNotification('error', `RVT processing failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
    input.click()
  }, [addNotification, handleFileUpload, loadDaeFromUrl, revitScope, setRevitScope, setRvtProgress])

  // ── Revit Upload Modal completion handler ────────────────

  const handleRevitConversionComplete = useCallback(async (result: RevitProcessModelResponse) => {
    setShowRevitUploadModal(false)

    const nextScope = {
      projectId: result.projectId || revitScope.projectId,
      modelVersion: result.modelVersion || revitScope.modelVersion,
    }
    setRevitScope(nextScope.projectId, nextScope.modelVersion)

    if (result.xlsxImport?.coverage) {
      setXlsxCoverage(result.xlsxImport.coverage)
    }

    if (!result.outputs?.ifcPath) {
      addNotification('error', 'RVT processed, but IFC output is missing.')
      return
    }

    try {
      setRvtProgress(90, 'Loading converted IFC model...', 'geometry')
      const backendBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
      const ifcUrl = /^https?:\/\//i.test(result.outputs.ifcPath)
        ? result.outputs.ifcPath
        : `${backendBase}${result.outputs.ifcPath}`
      const ifcResponse = await fetch(ifcUrl)
      if (!ifcResponse.ok) {
        throw new Error(`Failed to load converted IFC (${ifcResponse.status})`)
      }
      const ifcBlob = await ifcResponse.blob()
      const ifcFileName = result.outputs.ifcPath.split('/').pop() || 'model.ifc'
      const ifcFile = new File([ifcBlob], ifcFileName, { type: 'application/octet-stream' })
      await handleFileUpload([ifcFile], nextScope)
      setRvtProgress(100, 'Done', 'done')
      setTimeout(() => setLoadingProgress(null), 800)

      const extras: string[] = []
      if (result.outputs.xlsxPath) extras.push('XLSX')
      if (result.outputs.daePath) extras.push('DAE')
      addNotification('success', `RVT converted to IFC4X3${extras.length ? ` + ${extras.join(' + ')}` : ''}`)
    } catch (err) {
      setLoadingProgress(null)
      addNotification('error', `Failed to load IFC: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [addNotification, handleFileUpload, revitScope, setRevitScope, setRvtProgress, setXlsxCoverage])

  // ── XLSX Upload handler ─────────────────────────────────

  const handleXlsxUpload = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.xls'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', revitScope.projectId)
      if (revitScope.modelVersion) formData.append('modelVersion', revitScope.modelVersion)

      try {
        const data = await uploadRevitXlsx(formData)
        const nextProjectId = data.projectId || revitScope.projectId
        const nextModelVersion = data.modelVersion || revitScope.modelVersion
        setRevitScope(nextProjectId, nextModelVersion)
        setXlsxCoverage(data.coverage || null)

        if (data.status === 'partial_success') {
          addNotification('warning', `Revit import partial: ${data.insertedCount}/${data.parsedRows} rows, errors: ${data.errorCount}`)
        } else {
          addNotification('success', `Revit data imported: ${data.insertedCount} elements`)
        }

        revitEnrichment.invalidateCache()
        const service = ifcServiceRef.current
        if (service) {
          const allGlobalIds: string[] = []
          const allElementIds: number[] = []
          const allIfcElements: IFCElementInfo[] = []
          const tree = treeData

          const extractIds = async (nodes: TreeNode[]) => {
            for (const node of nodes) {
              const info = await service.getElementProperties(node.expressID)
              if (info) {
                allIfcElements.push(info)
                if (info.globalId) allGlobalIds.push(info.globalId)
                if (info.tag) {
                  const tagNum = parseInt(info.tag, 10)
                  if (!isNaN(tagNum)) allElementIds.push(tagNum)
                }
              }
              if (node.children) await extractIds(node.children)
            }
          }
          extractIds(tree).then(async () => {
            const scope = { projectId: nextProjectId, modelVersion: nextModelVersion }
            if (allGlobalIds.length > 0) await revitEnrichment.prefetchBulk(allGlobalIds, scope)
            if (allElementIds.length > 0) await revitEnrichment.prefetchByElementIds(allElementIds, scope)
            const cachedProps = revitEnrichment.getAllCachedProps()
            if (cachedProps.length > 0 && allIfcElements.length > 0) {
              const result = elementMatcher.runMatching(allIfcElements, cachedProps)
              addNotification(
                'info',
                `Matching complete: ${result.totalMatched}/${result.totalIfcElements} (${(result.matchRate * 100).toFixed(1)}%)`,
              )
            }
          })
        }
      } catch (err) {
        addNotification('error', `Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
    input.click()
  }, [addNotification, revitEnrichment, treeData, elementMatcher, revitScope, setRevitScope])

  // ── Match status highlighting ────────────────────────────

  const applyMatchHighlight = useCallback(() => {
    const group = modelGroupRef.current
    if (!group || !elementMatcher.matchResult) return

    const matchMap = elementMatcher.matchResult.matchMap
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.expressID !== undefined) {
        if (!matchOverlayRef.current.has(obj.uuid)) {
          matchOverlayRef.current.set(obj.uuid, obj.material)
        }
        const isMatched = matchMap.has(obj.userData.expressID)
        const mat = (obj.material as THREE.MeshPhysicalMaterial).clone()
        if (isMatched) {
          mat.emissive = new THREE.Color(0x22c55e) // green
          mat.emissiveIntensity = 0.25
        } else {
          mat.emissive = new THREE.Color(0xef4444) // red
          mat.emissiveIntensity = 0.35
        }
        obj.material = mat
      }
    })
    setShowMatchHighlight(true)
  }, [elementMatcher.matchResult])

  const clearMatchHighlight = useCallback(() => {
    const group = modelGroupRef.current
    if (!group) return
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.expressID !== undefined) {
        const original = matchOverlayRef.current.get(obj.uuid)
        if (original) obj.material = original
      }
    })
    matchOverlayRef.current.clear()
    setShowMatchHighlight(false)
  }, [])

  const toggleMatchHighlight = useCallback(() => {
    if (showMatchHighlight) {
      clearMatchHighlight()
    } else {
      applyMatchHighlight()
    }
  }, [showMatchHighlight, applyMatchHighlight, clearMatchHighlight])

  const handleExportMatchReport = useCallback(async () => {
    const result = elementMatcher.matchResult
    if (!result) return
    try {
      const XLSX = (await import('xlsx')).default
      const wb = XLSX.utils.book_new()

      // Summary sheet
      const summaryData = [
        ['Metric', 'Value'],
        ['Total IFC Elements', result.totalIfcElements],
        ['Total Revit Elements', result.totalExcelRows],
        ['Matched (Total)', result.totalMatched],
        ['Match Rate', `${(result.matchRate * 100).toFixed(2)}%`],
        ['Matched by ElementId', result.matchedByElementId],
        ['Matched by GlobalId', result.matchedByGlobalId],
        ['Matched by Type IfcGUID', result.matchedByTypeIfcGuid],
        ['Matched Mixed', result.matchedMixed],
        ['Ambiguous', result.ambiguous.length],
        ['Missing in IFC (Revit-only)', result.missingInIfc.length],
        ['Missing in Excel (IFC-only)', result.missingInExcel.length],
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary')

      // Missing in IFC
      if (result.missingInIfc.length > 0) {
        const missingIfcData = result.missingInIfc.map(r => ({
          GlobalId: r.globalId,
          ElementId: r.revitElementId ?? '',
          Name: r.elementName ?? '',
          Category: r.category ?? '',
          Type: r.elementType ?? '',
        }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(missingIfcData), 'Missing in IFC')
      }

      // Missing in Excel
      if (result.missingInExcel.length > 0) {
        const missingExcelData = result.missingInExcel.map(el => ({
          ExpressID: el.expressID,
          Type: el.type,
          Name: el.name,
          Tag: el.tag ?? '',
          GlobalId: el.globalId ?? '',
        }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(missingExcelData), 'Missing in Excel')
      }

      if (result.ambiguous.length > 0) {
        const ambiguousData = result.ambiguous.map((item) => ({
          ExpressID: item.expressID,
          GlobalId: item.globalId || '',
          Tag: item.tag || '',
          TopScore: item.candidates[0] ? item.candidates[0].score : '',
          TopCandidateGlobalId: item.candidates[0]?.globalId || '',
          TopCandidateElementId: item.candidates[0]?.revitElementId || '',
        }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ambiguousData), 'Ambiguous')
      }

      if (result.diagnostics.length > 0) {
        const diagnosticsData = result.diagnostics.map((d) => ({
          ExpressID: d.expressID,
          Reason: d.reason,
          CandidateCount: d.candidateCount,
          TopScore: d.topScore,
        }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(diagnosticsData), 'Diagnostics')
      }

      // Category breakdown
      const catData = Array.from(result.byCategory.entries()).map(([cat, d]) => ({
        Category: cat,
        IFC: d.ifcCount,
        Revit: d.revitCount,
        Matched: d.matchedCount,
        'Match %': d.ifcCount > 0 ? `${((d.matchedCount / d.ifcCount) * 100).toFixed(1)}%` : '—',
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catData), 'By Category')

      XLSX.writeFile(wb, `matching-report-${new Date().toISOString().slice(0, 10)}.xlsx`)
      addNotification('success', 'Matching report exported')
    } catch (err) {
      addNotification('error', `Export failed: ${err instanceof Error ? err.message : 'Unknown'}`)
    }
  }, [elementMatcher.matchResult, addNotification])

  // ── Summary handlers ────────────────────────────────────

  const handleSummaryScan = useCallback(async () => {
    const service = ifcServiceRef.current
    if (!service) return
    await propertiesSummary.scanElements(service)
    const data = propertiesSummary.buildSummary(summaryGroupBy)
    setSummaryData(data)
  }, [propertiesSummary, summaryGroupBy])

  const handleSummaryGroupByChange = useCallback((g: SummaryGroupBy) => {
    setSummaryGroupBy(g)
    if (propertiesSummary.hasData()) {
      const data = propertiesSummary.buildSummary(g)
      setSummaryData(data)
    }
  }, [propertiesSummary])

  const handleSummaryHighlight = useCallback((expressIDs: number[]) => {
    const service = ifcServiceRef.current
    const scene = sceneRef.current
    const renderer = rendererRef.current
    if (!service || !scene || !renderer) return

    // Find group key by matching expressIDs
    const group = summaryData?.groups.find((g) =>
      g.expressIDs.length === expressIDs.length && g.expressIDs[0] === expressIDs[0]
    )
    setHighlightedSummaryGroup(group?.key ?? null)
    outlineHighlight.highlightGroup(expressIDs, service, scene, renderer)
  }, [summaryData, setHighlightedSummaryGroup, outlineHighlight])

  const handleSummaryClearHighlight = useCallback(() => {
    const scene = sceneRef.current
    if (scene) outlineHighlight.clearHighlight(scene)
    setHighlightedSummaryGroup(null)
  }, [outlineHighlight, setHighlightedSummaryGroup])

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
    { id: 'summary', icon: <FileSpreadsheet size={14} />, label: 'Сводка' },
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
          className="flex items-center gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">3D IFC Viewer</h1>
            <p className="text-muted-foreground mt-0.5">
              {modelFile ? modelFile : 'Upload an IFC file to view and inspect 3D building models'}
            </p>
          </div>
          <Button data-testid="upload-ifc-btn" variant="primary" icon={<Upload size={16} />} onClick={() => {
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
          <Button data-testid="upload-revit-rvt-btn" variant="secondary" icon={<Upload size={16} />} onClick={() => setShowRevitUploadModal(true)}>
            Upload Revit (.rvt auto)
          </Button>
          <Button data-testid="upload-revit-xlsx-btn" variant="secondary" icon={<FileSpreadsheet size={16} />} onClick={handleXlsxUpload}>
            Upload Revit (.xlsx)
          </Button>
          {xlsxCoverage && (
            <div
              data-testid="coverage-panel"
              className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium bg-muted border border-border rounded-lg"
            >
              <span className="text-muted-foreground">Rows:</span>
              <span className="text-foreground">{xlsxCoverage.validRows}/{xlsxCoverage.parsedRows}</span>
              <span className="text-muted-foreground">GlobalId:</span>
              <span className="text-foreground">{xlsxCoverage.withGlobalId}</span>
              <span className="text-muted-foreground">ElementId:</span>
              <span className="text-foreground">{xlsxCoverage.withElementId}</span>
            </div>
          )}
          {elementMatcher.matchResult && (
            <>
              <button
                data-testid="match-badge"
                onClick={() => setShowMatchReport(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors"
              >
                <CheckCircle2 size={14} />
                {elementMatcher.matchResult.totalMatched}/{elementMatcher.matchResult.totalIfcElements} matched
              </button>
              <button
                data-testid="match-highlight-toggle"
                onClick={toggleMatchHighlight}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  showMatchHighlight
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
                title="Toggle match status visualization in 3D"
              >
                <BarChart3 size={14} />
                {showMatchHighlight ? 'Hide Match' : 'Show Match'}
              </button>
            </>
          )}
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
                ) : leftTab === 'summary' ? (
                  <PropertiesSummaryPanel
                    summary={summaryData}
                    groupBy={summaryGroupBy}
                    onGroupByChange={handleSummaryGroupByChange}
                    onScan={handleSummaryScan}
                    onHighlightGroup={handleSummaryHighlight}
                    onClearHighlight={handleSummaryClearHighlight}
                    activeGroupKey={highlightedSummaryGroup}
                    scanProgress={propertiesSummary.scanProgress}
                    isScanning={propertiesSummary.isScanning}
                    scannedCount={propertiesSummary.scannedCount}
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
                                    setSummaryData(null)
                                    propertiesSummary.clear()
                                    outlineHighlight.clearHighlight(scene)
                                    setHighlightedSummaryGroup(null)
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
              data-testid="global-wireframe-toggle"
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
                    </div>
                    {/* Color button */}
                    {selectedElementIds.length >= 1 && (
                      <div className="relative mt-2">
                        <button
                          data-testid="element-color-btn"
                          onClick={() => setShowColorPicker(!showColorPicker)}
                          className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-foreground bg-muted rounded-md hover:bg-muted/80 transition-colors"
                        >
                          <Palette size={10} />
                          <span>{selectedElementIds.length > 1 ? `Color (${selectedElementIds.length})` : 'Color'}</span>
                          {selectedElementIds.length === 1 && customColors[`el-${selectedElement.id}`] && (
                            <div className="w-3 h-3 rounded-sm border border-border" style={{ backgroundColor: customColors[`el-${selectedElement.id}`] }} />
                          )}
                        </button>
                        {showColorPicker && (
                          <ColorPickerPopover
                            currentColor={customColors[`el-${selectedElement.id}`]}
                            onApply={(color) => {
                              const ids = selectedElementIds.length > 1 ? selectedElementIds : [selectedElement.id]
                              for (const id of ids) {
                                setCustomColor(`el-${id}`, color)
                                const mesh = ifcServiceRef.current?.getMesh(id)
                                if (mesh && mesh.material instanceof THREE.MeshPhysicalMaterial) {
                                  const mat = mesh.material.clone()
                                  mat.color.set(color)
                                  mesh.material = mat
                                }
                              }
                            }}
                            onClear={() => {
                              const ids = selectedElementIds.length > 1 ? selectedElementIds : [selectedElement.id]
                              for (const id of ids) {
                                clearCustomColor(`el-${id}`)
                                const entry = selectedMeshesRef.current.get(id)
                                if (entry) {
                                  entry.mesh.material = entry.originalMaterial
                                }
                              }
                            }}
                            onClose={() => setShowColorPicker(false)}
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Revit-enriched properties panel */}
                  <RevitPropertiesPanel
                    revitProps={revitEnrichment.getRevitPropsAny(selectedElement.globalId, selectedElement.tag)}
                    ifcProperties={selectedElement.properties}
                    onUploadXlsx={handleXlsxUpload}
                    matchSource={(() => {
                      const match = elementMatcher.getMatchForExpressId(selectedElement.id)
                      return match?.matchedBy
                    })()}
                    tag={selectedElement.tag}
                  />
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
      <AnimatePresence>
        {showMatchReport && elementMatcher.matchResult && (
          <MatchingReport
            result={elementMatcher.matchResult}
            onClose={() => setShowMatchReport(false)}
            onHighlightMatchStatus={toggleMatchHighlight}
            onExportReport={handleExportMatchReport}
          />
        )}
      </AnimatePresence>
      <RevitUploadModal
        open={showRevitUploadModal}
        onClose={() => setShowRevitUploadModal(false)}
        onComplete={handleRevitConversionComplete}
        projectId={revitScope.projectId}
        modelVersion={revitScope.modelVersion}
      />
    </MotionPage>
  )
}
