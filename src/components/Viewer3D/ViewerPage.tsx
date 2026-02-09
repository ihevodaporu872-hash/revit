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
} from 'lucide-react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Button } from '../ui/Button'
import { useAppStore } from '../../store/appStore'
import { useViewerStore } from '../../store/viewerStore'
import { MotionPage } from '../MotionPage'
import { IFCService } from './ifc/ifcService'
import type { IFCSpatialNode, IFCModelStats, LoadingProgress } from './ifc/types'
import { useViewerHighlight } from './useViewerHighlight'
import { useSearchSets } from './useSearchSets'
import { SearchSetsPanel } from './SearchSetsPanel'
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
type LeftTab = 'tree' | 'sets'

// ── Component ──────────────────────────────────────────────────────────

export default function ViewerPage() {
  const { addNotification } = useAppStore()
  const { savedSets, activeDisplay, selectedElementIds, setSelectedElementIds, setActiveDisplay } = useViewerStore()

  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const frameIdRef = useRef<number>(0)
  const ifcServiceRef = useRef<IFCService | null>(null)
  const modelGroupRef = useRef<THREE.Group | null>(null)
  const selectedMeshRef = useRef<THREE.Mesh | null>(null)
  const originalMaterialRef = useRef<THREE.Material | THREE.Material[] | null>(null)

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

  const { applyDisplay, reset: resetHighlight } = useViewerHighlight()
  const { evaluateSearchSet } = useSearchSets()

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

    const gridHelper = new THREE.GridHelper(100, 100, 0x333355, 0x222244)
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
    }
  }, [initScene])

  // ── Apply Search Set display ─────────────────────────────

  useEffect(() => {
    const group = modelGroupRef.current
    if (!group || !isModelLoaded) return

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
  }, [activeDisplay, savedSets, isModelLoaded, applyDisplay, resetHighlight, evaluateSearchSet])

  // ── Convert spatial tree ─────────────────────────────────

  const convertToTreeNodes = (node: IFCSpatialNode, depth = 0): TreeNode => {
    const typeMap: Record<string, TreeNode['type']> = {
      IfcProject: 'project',
      IFCPROJECT: 'project',
      IfcSite: 'site',
      IFCSITE: 'site',
      IfcBuilding: 'building',
      IFCBUILDING: 'building',
      IfcBuildingStorey: 'storey',
      IFCBUILDINGSTOREY: 'storey',
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

  const selectElement = useCallback(async (expressID: number) => {
    const service = ifcServiceRef.current
    if (!service) return

    // Remove previous highlight
    if (selectedMeshRef.current && originalMaterialRef.current) {
      selectedMeshRef.current.material = originalMaterialRef.current
    }

    // Highlight new mesh
    const mesh = service.getMesh(expressID)
    if (mesh) {
      selectedMeshRef.current = mesh
      originalMaterialRef.current = mesh.material
      const mat = (mesh.material as THREE.MeshPhysicalMaterial).clone()
      mat.emissive = new THREE.Color(0x3b82f6)
      mat.emissiveIntensity = 0.5
      mesh.material = mat
    }

    // Load properties
    const info = await service.getElementProperties(expressID)
    if (info) {
      setSelectedElement({
        id: info.expressID,
        type: info.type,
        name: info.name,
        properties: info.properties,
        material: info.material,
        volume: info.volume,
        area: info.area,
      })
      setShowProperties(true)
      setSelectedElementIds([expressID])
    }
  }, [setSelectedElementIds])

  // ── Canvas click handler ────────────────────────────────

  const handleCanvasClick = useCallback(
    (event: MouseEvent) => {
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
          selectElement(expressID)
        }
      } else {
        // Deselect
        if (selectedMeshRef.current && originalMaterialRef.current) {
          selectedMeshRef.current.material = originalMaterialRef.current
          selectedMeshRef.current = null
          originalMaterialRef.current = null
        }
        setSelectedElement(null)
        setShowProperties(false)
      }
    },
    [activeTool, selectElement],
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

      // Remove previous model
      if (modelGroupRef.current) {
        scene.remove(modelGroupRef.current)
        modelGroupRef.current = null
      }
      ifcServiceRef.current?.disposeModel()

      setLoadingProgress({ stage: 'init', percent: 0, message: 'Initializing...' })
      setIsModelLoaded(false)

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

        scene.add(result.group)
        modelGroupRef.current = result.group

        fitToModel(result.group)

        const treeNodes = convertToTreeNodes(result.tree)
        setTreeData([treeNodes])
        setModelStats(result.stats)
        setModelFile(file.name)
        setIsModelLoaded(true)
        setShowLeftPanel(true)
        setLoadingProgress(null)

        addNotification('success', `Model loaded: ${result.stats.totalElements} elements`)
      } catch (err) {
        console.error('IFC load error:', err)
        setLoadingProgress(null)
        addNotification('error', `Failed to load IFC: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    },
    [addNotification, fitToModel],
  )

  // ── Tool handlers ───────────────────────────────────────

  const handleToolClick = (tool: ToolMode) => {
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

    if (tool === 'measure') addNotification('info', 'Click two points to measure distance')
    if (tool === 'section') addNotification('info', 'Click to place section plane')
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
          {/* Left Panel (Tree + Search Sets) */}
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
                  <button
                    onClick={() => setLeftTab('tree')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
                      leftTab === 'tree'
                        ? 'text-foreground border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Layers size={14} />
                    Tree
                  </button>
                  <button
                    onClick={() => setLeftTab('sets')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors ${
                      leftTab === 'sets'
                        ? 'text-foreground border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Bookmark size={14} />
                    Search Sets
                  </button>
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
                ) : (
                  <SearchSetsPanel selectedIds={selectedElementIds} />
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
            </motion.div>

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
    </MotionPage>
  )
}
