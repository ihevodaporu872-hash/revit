import { useState, useRef, useEffect, useCallback } from 'react'
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
} from 'lucide-react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { useAppStore } from '../../store/appStore'

// ── Types ──────────────────────────────────────────────────────────────

interface ElementProperty {
  name: string
  value: string
}

interface SelectedElement {
  id: number
  type: string
  name: string
  properties: ElementProperty[]
  material?: string
  volume?: string
  area?: string
}

interface TreeNode {
  id: string
  label: string
  type: 'project' | 'site' | 'building' | 'storey' | 'element'
  children?: TreeNode[]
  expanded?: boolean
  visible?: boolean
}

type ToolMode = 'select' | 'pan' | 'rotate' | 'zoom' | 'measure' | 'section'

// ── Mock Data ──────────────────────────────────────────────────────────

const MOCK_SELECTED_ELEMENT: SelectedElement = {
  id: 42871,
  type: 'IfcWall',
  name: 'Basic Wall: Interior - 135mm Partition',
  material: 'Concrete, Cast-in-Place',
  volume: '2.34 m\u00B3',
  area: '18.72 m\u00B2',
  properties: [
    { name: 'GlobalId', value: '3cUkl32yn9qRSPvBJJ$oWG' },
    { name: 'Name', value: 'Basic Wall: Interior - 135mm Partition' },
    { name: 'ObjectType', value: 'Basic Wall:Interior - 135mm Partition:328491' },
    { name: 'Level', value: 'Level 1' },
    { name: 'Base Constraint', value: 'Level 1' },
    { name: 'Top Constraint', value: 'Level 2' },
    { name: 'Unconnected Height', value: '3000 mm' },
    { name: 'Width', value: '135 mm' },
    { name: 'Length', value: '4850 mm' },
    { name: 'Fire Rating', value: '1 hour' },
    { name: 'Structural Usage', value: 'Non-Bearing' },
    { name: 'Phase Created', value: 'New Construction' },
  ],
}

const MOCK_TREE: TreeNode[] = [
  {
    id: 'proj-1',
    label: 'Hospital Phase 2',
    type: 'project',
    expanded: true,
    children: [
      {
        id: 'site-1',
        label: 'Default Site',
        type: 'site',
        expanded: true,
        children: [
          {
            id: 'bldg-1',
            label: 'Main Building',
            type: 'building',
            expanded: true,
            children: [
              { id: 'st-b1', label: 'B1 - Basement', type: 'storey', children: [
                { id: 'el-1', label: 'Foundation Slab (3)', type: 'element' },
                { id: 'el-2', label: 'Retaining Walls (12)', type: 'element' },
                { id: 'el-3', label: 'Columns (24)', type: 'element' },
              ]},
              { id: 'st-00', label: '00 - Ground Floor', type: 'storey', expanded: true, children: [
                { id: 'el-4', label: 'Walls (48)', type: 'element' },
                { id: 'el-5', label: 'Doors (22)', type: 'element' },
                { id: 'el-6', label: 'Windows (16)', type: 'element' },
                { id: 'el-7', label: 'Floors (4)', type: 'element' },
                { id: 'el-8', label: 'Columns (18)', type: 'element' },
              ]},
              { id: 'st-01', label: '01 - First Floor', type: 'storey', children: [
                { id: 'el-9', label: 'Walls (52)', type: 'element' },
                { id: 'el-10', label: 'Doors (28)', type: 'element' },
                { id: 'el-11', label: 'Slabs (6)', type: 'element' },
              ]},
              { id: 'st-02', label: '02 - Second Floor', type: 'storey', children: [
                { id: 'el-12', label: 'Walls (44)', type: 'element' },
                { id: 'el-13', label: 'Roof (2)', type: 'element' },
              ]},
            ],
          },
        ],
      },
    ],
  },
]

const MODEL_STATS = {
  totalElements: 1247,
  types: 23,
  stories: 4,
  materials: 18,
  ifcVersion: 'IFC4',
  fileSize: '45.2 MB',
}

// ── Component ──────────────────────────────────────────────────────────

export default function ViewerPage() {
  const { addNotification } = useAppStore()

  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const frameIdRef = useRef<number>(0)

  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [activeTool, setActiveTool] = useState<ToolMode>('select')
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null)
  const [showTree, setShowTree] = useState(false)
  const [showProperties, setShowProperties] = useState(false)
  const [treeData, setTreeData] = useState<TreeNode[]>(MOCK_TREE)
  const [modelFile, setModelFile] = useState<string | null>(null)

  // ── Three.js Initialization ─────────────────────────────

  const initScene = useCallback(() => {
    if (!containerRef.current || rendererRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf0f2f5)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 10000)
    camera.position.set(30, 20, 30)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.1
    controls.screenSpacePanning = true
    controls.maxPolarAngle = Math.PI
    controls.minDistance = 1
    controls.maxDistance = 500
    controlsRef.current = controls

    // Grid
    const gridHelper = new THREE.GridHelper(100, 100, 0xcccccc, 0xe5e5e5)
    scene.add(gridHelper)

    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    // Directional light with shadow
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

    // Hemisphere light for softer fills
    const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x0f0e0d, 0.3)
    scene.add(hemiLight)

    // Animate
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Resize handler
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
    return cleanup
  }, [initScene])

  // ── Load a demo model (placeholder geometry) ────────────

  const loadDemoModel = useCallback(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Remove previous model objects (keep lights and grid)
    const toRemove: THREE.Object3D[] = []
    scene.traverse((obj) => {
      if (obj.userData.isModelPart) toRemove.push(obj)
    })
    toRemove.forEach((obj) => scene.remove(obj))

    // Create placeholder building geometry
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x8899aa,
      roughness: 0.6,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9,
    })

    // Foundation slab
    const slab = new THREE.Mesh(new THREE.BoxGeometry(20, 0.5, 15), new THREE.MeshPhysicalMaterial({ color: 0x999999, roughness: 0.8 }))
    slab.position.y = 0.25
    slab.castShadow = true
    slab.receiveShadow = true
    slab.userData.isModelPart = true
    scene.add(slab)

    // Walls
    const wallGeom = new THREE.BoxGeometry(0.2, 4, 15)
    const leftWall = new THREE.Mesh(wallGeom, material.clone())
    leftWall.position.set(-10, 2.5, 0)
    leftWall.castShadow = true
    leftWall.userData.isModelPart = true
    scene.add(leftWall)

    const rightWall = new THREE.Mesh(wallGeom, material.clone())
    rightWall.position.set(10, 2.5, 0)
    rightWall.castShadow = true
    rightWall.userData.isModelPart = true
    scene.add(rightWall)

    const backWallGeom = new THREE.BoxGeometry(20, 4, 0.2)
    const backWall = new THREE.Mesh(backWallGeom, material.clone())
    backWall.position.set(0, 2.5, -7.5)
    backWall.castShadow = true
    backWall.userData.isModelPart = true
    scene.add(backWall)

    // Columns
    const colGeom = new THREE.BoxGeometry(0.4, 4, 0.4)
    const colMat = new THREE.MeshPhysicalMaterial({ color: 0x667788, roughness: 0.5 })
    for (let x = -8; x <= 8; x += 4) {
      const col = new THREE.Mesh(colGeom, colMat)
      col.position.set(x, 2.5, 0)
      col.castShadow = true
      col.userData.isModelPart = true
      scene.add(col)
    }

    // Roof slab
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(21, 0.3, 16),
      new THREE.MeshPhysicalMaterial({ color: 0x556677, roughness: 0.7 }),
    )
    roof.position.y = 4.65
    roof.castShadow = true
    roof.receiveShadow = true
    roof.userData.isModelPart = true
    scene.add(roof)

    // Second floor slab
    const floor2 = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.25, 15),
      new THREE.MeshPhysicalMaterial({ color: 0x999999, roughness: 0.8 }),
    )
    floor2.position.y = 4.5
    floor2.userData.isModelPart = true
    scene.add(floor2)

    // Upper walls
    const upperWallL = new THREE.Mesh(wallGeom, material.clone())
    upperWallL.position.set(-10, 6.75, 0)
    upperWallL.castShadow = true
    upperWallL.userData.isModelPart = true
    scene.add(upperWallL)

    const upperWallR = new THREE.Mesh(wallGeom, material.clone())
    upperWallR.position.set(10, 6.75, 0)
    upperWallR.castShadow = true
    upperWallR.userData.isModelPart = true
    scene.add(upperWallR)

    setIsModelLoaded(true)
    setModelFile('Hospital_Phase2.ifc')
    addNotification('success', 'Demo model loaded successfully')
  }, [addNotification])

  // ── Tool handlers ───────────────────────────────────────

  const handleToolClick = (tool: ToolMode) => {
    setActiveTool(tool)
    const controls = controlsRef.current
    if (!controls) return

    switch (tool) {
      case 'pan':
        controls.mouseButtons = { LEFT: THREE.MOUSE.PAN as any, MIDDLE: THREE.MOUSE.DOLLY as any, RIGHT: THREE.MOUSE.ROTATE as any }
        break
      case 'rotate':
        controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE as any, MIDDLE: THREE.MOUSE.DOLLY as any, RIGHT: THREE.MOUSE.PAN as any }
        break
      case 'zoom':
        controls.mouseButtons = { LEFT: THREE.MOUSE.DOLLY as any, MIDDLE: THREE.MOUSE.DOLLY as any, RIGHT: THREE.MOUSE.PAN as any }
        break
      case 'select':
      default:
        controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE as any, MIDDLE: THREE.MOUSE.DOLLY as any, RIGHT: THREE.MOUSE.PAN as any }
        break
    }

    if (tool === 'measure') {
      addNotification('info', 'Click two points to measure distance')
    }
    if (tool === 'section') {
      addNotification('info', 'Click to place section plane')
    }
  }

  const fitToView = () => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!camera || !controls) return

    camera.position.set(30, 20, 30)
    controls.target.set(0, 3, 0)
    controls.update()
    addNotification('info', 'View reset to fit model')
  }

  const handleMockSelect = () => {
    setSelectedElement(MOCK_SELECTED_ELEMENT)
    setShowProperties(true)
  }

  const handleFileUpload = (_files: File[]) => {
    addNotification('info', 'IFC file uploaded. Loading model...')
    // In real implementation: parse with web-ifc and load into scene
    setTimeout(() => loadDemoModel(), 500)
  }

  // ── Tree toggle ──────────────────────────────────────────

  const toggleTreeNode = (nodeId: string) => {
    const toggle = (nodes: TreeNode[]): TreeNode[] =>
      nodes.map((n) => ({
        ...n,
        expanded: n.id === nodeId ? !n.expanded : n.expanded,
        children: n.children ? toggle(n.children) : undefined,
      }))
    setTreeData(toggle(treeData))
  }

  // ── Render tree recursively ──────────────────────────────

  const renderTreeNode = (node: TreeNode, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0
    const iconMap = {
      project: <Building2 size={14} className="text-primary" />,
      site: <Grid3x3 size={14} className="text-green-600" />,
      building: <Building2 size={14} className="text-amber-600" />,
      storey: <Layers size={14} className="text-blue-500" />,
      element: <Box size={14} className="text-text-secondary" />,
    }

    return (
      <div key={node.id}>
        <button
          className="flex items-center gap-1.5 w-full px-2 py-1.5 text-left text-sm hover:bg-surface-alt rounded transition-colors"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (hasChildren) toggleTreeNode(node.id)
            if (node.type === 'element') handleMockSelect()
          }}
        >
          {hasChildren ? (
            node.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : (
            <span className="w-3" />
          )}
          {iconMap[node.type]}
          <span className="truncate text-text">{node.label}</span>
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
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">3D IFC Viewer</h1>
          <p className="text-text-secondary mt-0.5">
            {modelFile ? modelFile : 'Upload an IFC file to view and inspect 3D building models'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isModelLoaded && (
            <Button variant="outline" icon={<Box size={16} />} onClick={loadDemoModel}>
              Load Demo Model
            </Button>
          )}
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
      </div>

      {/* Main viewer area */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Selection Tree Panel */}
        {showTree && (
          <div className="w-72 flex flex-col border border-border rounded-xl bg-surface overflow-hidden shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-text">Selection Tree</h3>
              <button onClick={() => setShowTree(false)} className="p-1 hover:bg-surface-alt rounded">
                <X size={14} className="text-text-secondary" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {treeData.map((node) => renderTreeNode(node))}
            </div>
            {/* Model stats at bottom */}
            <div className="border-t border-border p-3 space-y-1.5">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Model Info</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-text-secondary">Elements</span>
                <span className="text-text font-medium">{MODEL_STATS.totalElements.toLocaleString()}</span>
                <span className="text-text-secondary">Types</span>
                <span className="text-text font-medium">{MODEL_STATS.types}</span>
                <span className="text-text-secondary">Stories</span>
                <span className="text-text font-medium">{MODEL_STATS.stories}</span>
                <span className="text-text-secondary">Materials</span>
                <span className="text-text font-medium">{MODEL_STATS.materials}</span>
                <span className="text-text-secondary">IFC Version</span>
                <span className="text-text font-medium">{MODEL_STATS.ifcVersion}</span>
                <span className="text-text-secondary">File Size</span>
                <span className="text-text font-medium">{MODEL_STATS.fileSize}</span>
              </div>
            </div>
          </div>
        )}

        {/* Viewport */}
        <div className="flex-1 relative rounded-xl border border-border overflow-hidden bg-surface">
          {/* Toolbar */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-surface/90 backdrop-blur-sm rounded-lg border border-border shadow-sm p-1">
            {tools.map((tool) => (
              <button
                key={tool.id}
                title={tool.label}
                onClick={() => handleToolClick(tool.id)}
                className={`p-2 rounded-md transition-colors ${
                  activeTool === tool.id
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:bg-surface-alt hover:text-text'
                }`}
              >
                {tool.icon}
              </button>
            ))}
            <div className="w-px h-6 bg-border mx-1" />
            <button
              title="Fit to View"
              onClick={fitToView}
              className="p-2 rounded-md text-text-secondary hover:bg-surface-alt hover:text-text transition-colors"
            >
              <Maximize size={18} />
            </button>
            <button
              title="Zoom In"
              onClick={() => {
                const cam = cameraRef.current
                if (cam) { cam.position.multiplyScalar(0.85); controlsRef.current?.update() }
              }}
              className="p-2 rounded-md text-text-secondary hover:bg-surface-alt hover:text-text transition-colors"
            >
              <ZoomIn size={18} />
            </button>
            <button
              title="Zoom Out"
              onClick={() => {
                const cam = cameraRef.current
                if (cam) { cam.position.multiplyScalar(1.15); controlsRef.current?.update() }
              }}
              className="p-2 rounded-md text-text-secondary hover:bg-surface-alt hover:text-text transition-colors"
            >
              <ZoomOut size={18} />
            </button>
          </div>

          {/* Side buttons */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
            <button
              title={showTree ? 'Hide Tree' : 'Show Tree'}
              onClick={() => setShowTree(!showTree)}
              className="p-2 rounded-lg bg-surface/90 backdrop-blur-sm border border-border shadow-sm text-text-secondary hover:text-text transition-colors"
            >
              {showTree ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>
            <button
              title="Model Info"
              onClick={() => addNotification('info', `Model: ${MODEL_STATS.totalElements} elements, ${MODEL_STATS.types} types, ${MODEL_STATS.stories} stories`)}
              className="p-2 rounded-lg bg-surface/90 backdrop-blur-sm border border-border shadow-sm text-text-secondary hover:text-text transition-colors"
            >
              <Info size={18} />
            </button>
            <button
              title="Toggle Visibility"
              onClick={() => addNotification('info', 'Toggle element visibility')}
              className="p-2 rounded-lg bg-surface/90 backdrop-blur-sm border border-border shadow-sm text-text-secondary hover:text-text transition-colors"
            >
              {isModelLoaded ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>

          {/* Mock select button (temporary - click to simulate element selection) */}
          {isModelLoaded && (
            <button
              onClick={handleMockSelect}
              className="absolute bottom-3 left-3 z-10 px-3 py-1.5 text-xs bg-surface/90 backdrop-blur-sm border border-border rounded-lg shadow-sm text-text-secondary hover:text-text transition-colors"
            >
              Click to simulate element selection
            </button>
          )}

          {/* Upload overlay when no model */}
          {!isModelLoaded && (
            <div className="absolute inset-0 z-5 flex items-center justify-center pointer-events-none">
              <div className="text-center pointer-events-auto">
                <Box size={48} className="mx-auto text-text-secondary/30 mb-3" />
                <p className="text-text-secondary text-sm">No model loaded</p>
                <p className="text-text-secondary/60 text-xs mt-1">Upload an IFC file or load the demo model</p>
              </div>
            </div>
          )}

          {/* Three.js container */}
          <div ref={containerRef} className="w-full h-full" />
        </div>

        {/* Properties Panel */}
        {showProperties && selectedElement && (
          <div className="w-80 flex flex-col border border-border rounded-xl bg-surface overflow-hidden shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <h3 className="text-sm font-semibold text-text">Element Properties</h3>
                <p className="text-xs text-text-secondary mt-0.5">{selectedElement.type}</p>
              </div>
              <button onClick={() => { setShowProperties(false); setSelectedElement(null) }} className="p-1 hover:bg-surface-alt rounded">
                <X size={14} className="text-text-secondary" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Element summary */}
              <div className="px-4 py-3 border-b border-border bg-surface-alt/50">
                <p className="text-sm font-medium text-text">{selectedElement.name}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-surface rounded-lg p-2 border border-border">
                    <p className="text-text-secondary">Express ID</p>
                    <p className="font-medium text-text">{selectedElement.id}</p>
                  </div>
                  <div className="bg-surface rounded-lg p-2 border border-border">
                    <p className="text-text-secondary">Type</p>
                    <p className="font-medium text-text">{selectedElement.type}</p>
                  </div>
                  {selectedElement.volume && (
                    <div className="bg-surface rounded-lg p-2 border border-border">
                      <p className="text-text-secondary">Volume</p>
                      <p className="font-medium text-text">{selectedElement.volume}</p>
                    </div>
                  )}
                  {selectedElement.area && (
                    <div className="bg-surface rounded-lg p-2 border border-border">
                      <p className="text-text-secondary">Area</p>
                      <p className="font-medium text-text">{selectedElement.area}</p>
                    </div>
                  )}
                </div>
                {selectedElement.material && (
                  <div className="mt-2 text-xs">
                    <span className="text-text-secondary">Material: </span>
                    <span className="text-text font-medium">{selectedElement.material}</span>
                  </div>
                )}
              </div>

              {/* Property table */}
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">All Properties</p>
                <div className="space-y-0">
                  {selectedElement.properties.map((prop, i) => (
                    <div
                      key={i}
                      className={`flex justify-between items-start py-2 text-xs ${
                        i < selectedElement.properties.length - 1 ? 'border-b border-border/50' : ''
                      }`}
                    >
                      <span className="text-text-secondary shrink-0 mr-3">{prop.name}</span>
                      <span className="text-text font-medium text-right break-all">{prop.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
