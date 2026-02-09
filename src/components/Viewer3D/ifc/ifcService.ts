import * as THREE from 'three'
import type { IFCSpatialNode, IFCElementInfo, IFCModelStats, LoadingProgress, IFCLoadResult } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let WebIFC: any = null
async function getWebIFC() {
  if (!WebIFC) WebIFC = await import('web-ifc')
  return WebIFC
}

interface LoadedModel {
  modelID: number
  fileName: string
  group: THREE.Group
  visible: boolean
}

export class IFCService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private api: any = null
  private models = new Map<number, LoadedModel>()
  private elementMap = new Map<number, THREE.Mesh>()
  private disposed = false

  // Legacy single-model accessor (returns first model ID)
  private get modelID(): number {
    if (this.models.size === 0) return -1
    return this.models.keys().next().value!
  }

  async init(): Promise<void> {
    const wif = await getWebIFC()
    this.api = new wif.IfcAPI()
    this.api.SetWasmPath('/')
    await this.api.Init()
  }

  async loadFile(
    file: File,
    onProgress?: (p: LoadingProgress) => void,
  ): Promise<IFCLoadResult> {
    if (!this.api) throw new Error('IFCService not initialized')

    onProgress?.({ stage: 'parsing', percent: 10, message: 'Reading IFC file...' })

    const buffer = await file.arrayBuffer()
    const data = new Uint8Array(buffer)

    onProgress?.({ stage: 'parsing', percent: 20, message: 'Parsing IFC data...' })

    const modelID = this.api.OpenModel(data, {
      COORDINATE_TO_ORIGIN: true,
      CIRCLE_SEGMENTS: 16,
    })

    if (modelID === -1) throw new Error('Failed to open IFC model')

    onProgress?.({ stage: 'geometry', percent: 30, message: 'Loading geometry...' })

    const group = new THREE.Group()
    group.name = `IFCModel-${file.name}`

    // Stream all meshes
    const flatMeshes = this.api.LoadAllGeometry(modelID)
    const totalMeshes = flatMeshes.size()

    for (let i = 0; i < totalMeshes; i++) {
      const flatMesh = flatMeshes.get(i)
      const expressID = flatMesh.expressID

      const percent = 30 + Math.round((i / totalMeshes) * 50)
      if (i % 50 === 0) {
        onProgress?.({ stage: 'building', percent, message: `Building meshes (${i}/${totalMeshes})...` })
      }

      const placedGeometries = flatMesh.geometries
      for (let j = 0; j < placedGeometries.size(); j++) {
        const placed = placedGeometries.get(j)
        const geometry = this.api.GetGeometry(modelID, placed.geometryExpressID)

        const verts = this.api.GetVertexArray(
          geometry.GetVertexData(),
          geometry.GetVertexDataSize(),
        )
        const indices = this.api.GetIndexArray(
          geometry.GetIndexData(),
          geometry.GetIndexDataSize(),
        )

        // Deinterleave vertex data: 6 floats per vertex (x,y,z, nx,ny,nz)
        const positions = new Float32Array((verts.length / 6) * 3)
        const normals = new Float32Array((verts.length / 6) * 3)

        for (let k = 0; k < verts.length / 6; k++) {
          positions[k * 3] = verts[k * 6]
          positions[k * 3 + 1] = verts[k * 6 + 1]
          positions[k * 3 + 2] = verts[k * 6 + 2]
          normals[k * 3] = verts[k * 6 + 3]
          normals[k * 3 + 1] = verts[k * 6 + 4]
          normals[k * 3 + 2] = verts[k * 6 + 5]
        }

        const bufferGeometry = new THREE.BufferGeometry()
        bufferGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        bufferGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
        bufferGeometry.setIndex(new THREE.BufferAttribute(indices, 1))

        const color = placed.color
        const material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(color.x, color.y, color.z),
          roughness: 0.6,
          metalness: 0.1,
          transparent: color.w < 1,
          opacity: color.w,
          side: THREE.DoubleSide,
        })

        const mesh = new THREE.Mesh(bufferGeometry, material)

        // Apply transformation matrix
        const matrix = new THREE.Matrix4()
        matrix.fromArray(placed.flatTransformation)
        mesh.applyMatrix4(matrix)

        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData.expressID = expressID
        mesh.userData.modelID = modelID
        mesh.userData.isModelPart = true

        group.add(mesh)
        this.elementMap.set(expressID, mesh)

        geometry.delete()
      }
    }

    onProgress?.({ stage: 'building', percent: 85, message: 'Building spatial tree...' })

    const tree = await this.getSpatialTreeForModel(modelID)

    onProgress?.({ stage: 'building', percent: 90, message: 'Calculating statistics...' })

    const stats = await this.calculateStatsForModel(modelID, file)

    onProgress?.({ stage: 'done', percent: 100, message: 'Model loaded!' })

    // Register in models map
    this.models.set(modelID, { modelID, fileName: file.name, group, visible: true })

    return { group, stats, tree, elementMap: this.elementMap }
  }

  async getElementProperties(expressID: number): Promise<IFCElementInfo | null> {
    if (!this.api) return null

    // Find which model this element belongs to
    const mesh = this.elementMap.get(expressID)
    const mid = mesh?.userData.modelID ?? this.modelID
    if (mid === -1) return null

    try {
      const props = await this.api.properties.getItemProperties(mid, expressID, false)
      if (!props) return null

      const typeName = this.api.GetNameFromTypeCode(props.type) || 'Unknown'
      const name = props.Name?.value || props.LongName?.value || typeName

      const properties: { name: string; value: string }[] = []

      // Basic properties
      if (props.GlobalId?.value) properties.push({ name: 'GlobalId', value: String(props.GlobalId.value) })
      if (props.Name?.value) properties.push({ name: 'Name', value: String(props.Name.value) })
      if (props.ObjectType?.value) properties.push({ name: 'ObjectType', value: String(props.ObjectType.value) })
      if (props.Description?.value) properties.push({ name: 'Description', value: String(props.Description.value) })
      if (props.Tag?.value) properties.push({ name: 'Tag', value: String(props.Tag.value) })

      // Property sets
      let material: string | undefined
      let volume: string | undefined
      let area: string | undefined

      try {
        const psets = await this.api.properties.getPropertySets(mid, expressID, true)
        for (const pset of psets) {
          const psetName = pset.Name?.value || 'PropertySet'
          if (pset.HasProperties) {
            for (const prop of pset.HasProperties) {
              if (prop?.Name?.value && prop?.NominalValue?.value !== undefined) {
                const val = String(prop.NominalValue.value)
                properties.push({ name: `${psetName} / ${prop.Name.value}`, value: val })

                const pName = prop.Name.value.toLowerCase()
                if (pName.includes('volume')) volume = val
                if (pName.includes('area') && !area) area = val
              }
            }
          }
          if (pset.Quantities) {
            for (const qty of pset.Quantities) {
              if (qty?.Name?.value) {
                const val = qty.AreaValue?.value ?? qty.VolumeValue?.value ?? qty.LengthValue?.value ?? qty.CountValue?.value ?? qty.WeightValue?.value
                if (val !== undefined) {
                  properties.push({ name: `${psetName} / ${qty.Name.value}`, value: String(val) })
                  const qName = qty.Name.value.toLowerCase()
                  if (qName.includes('volume')) volume = String(val)
                  if (qName.includes('area') && !area) area = String(val)
                }
              }
            }
          }
        }
      } catch {
        // psets may not exist for all elements
      }

      // Materials
      try {
        const mats = await this.api.properties.getMaterialsProperties(mid, expressID, true)
        if (mats.length > 0) {
          const matNames: string[] = []
          for (const mat of mats) {
            if (mat.Name?.value) matNames.push(mat.Name.value)
            if (mat.Materials) {
              for (const m of mat.Materials) {
                if (m?.Name?.value) matNames.push(m.Name.value)
              }
            }
            if (mat.ForLayerSet?.Materials) {
              for (const m of mat.ForLayerSet.Materials) {
                if (m?.Name?.value) matNames.push(m.Name.value)
              }
            }
          }
          if (matNames.length > 0) {
            material = matNames.join(', ')
            properties.push({ name: 'Material', value: material })
          }
        }
      } catch {
        // materials may not exist
      }

      return { expressID, type: typeName, name, properties, material, volume, area }
    } catch {
      return null
    }
  }

  async getSpatialTree(): Promise<IFCSpatialNode> {
    return this.getSpatialTreeForModel(this.modelID)
  }

  private async getSpatialTreeForModel(modelID: number): Promise<IFCSpatialNode> {
    if (!this.api || modelID === -1) {
      return { expressID: 0, type: 'IfcProject', children: [] }
    }

    try {
      const tree = await this.api.properties.getSpatialStructure(modelID)
      return this.convertNode(tree)
    } catch {
      return { expressID: 0, type: 'IfcProject', children: [] }
    }
  }

  private convertNode(node: any): IFCSpatialNode {
    return {
      expressID: node.expressID,
      type: node.type || 'Unknown',
      children: (node.children || []).map((c: any) => this.convertNode(c)),
    }
  }

  async calculateStats(file: File): Promise<IFCModelStats> {
    return this.calculateStatsForModel(this.modelID, file)
  }

  private async calculateStatsForModel(modelID: number, file: File): Promise<IFCModelStats> {
    if (!this.api || modelID === -1) {
      return { totalElements: 0, types: 0, stories: 0, materials: 0, ifcVersion: 'Unknown', fileSize: '0 B' }
    }

    let ifcVersion = 'Unknown'
    try {
      ifcVersion = this.api.GetModelSchema(modelID)
    } catch { /* ignore */ }

    const allTypes = this.api.GetAllTypesOfModel(modelID)
    const elementTypes = new Set<number>()
    let totalElements = 0

    for (const t of allTypes) {
      if (this.api.IsIfcElement(t.typeID)) {
        const lines = this.api.GetLineIDsWithType(modelID, t.typeID, false)
        const count = lines.size()
        if (count > 0) {
          elementTypes.add(t.typeID)
          totalElements += count
        }
      }
    }

    // Count stories
    let stories = 0
    try {
      const storeyType = this.api.GetTypeCodeFromName('IFCBUILDINGSTOREY')
      stories = this.api.GetLineIDsWithType(modelID, storeyType, false).size()
    } catch { /* ignore */ }

    // Count materials
    let materials = 0
    try {
      const matType = this.api.GetTypeCodeFromName('IFCMATERIAL')
      materials = this.api.GetLineIDsWithType(modelID, matType, false).size()
    } catch { /* ignore */ }

    const fileSize = formatFileSize(file.size)

    return { totalElements, types: elementTypes.size, stories, materials, ifcVersion, fileSize }
  }

  getMesh(expressID: number): THREE.Mesh | undefined {
    return this.elementMap.get(expressID)
  }

  getAllExpressIDs(): number[] {
    return Array.from(this.elementMap.keys())
  }

  // ── Multi-model methods ──────────────────────────────

  getLoadedModels(): { modelID: number; fileName: string; visible: boolean }[] {
    return Array.from(this.models.values()).map((m) => ({
      modelID: m.modelID,
      fileName: m.fileName,
      visible: m.visible,
    }))
  }

  setModelVisibility(modelID: number, visible: boolean): void {
    const model = this.models.get(modelID)
    if (model) {
      model.group.visible = visible
      model.visible = visible
    }
  }

  removeModel(modelID: number, scene: THREE.Scene): void {
    const model = this.models.get(modelID)
    if (!model) return

    // Remove group from scene
    scene.remove(model.group)

    // Remove element map entries for this model
    model.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.expressID !== undefined) {
        this.elementMap.delete(obj.userData.expressID)
      }
    })

    // Dispose geometry/materials
    model.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
        else obj.material.dispose()
      }
    })

    // Close model in web-ifc
    if (this.api) {
      try { this.api.CloseModel(modelID) } catch { /* ignore */ }
    }

    this.models.delete(modelID)
  }

  getModelGroup(modelID: number): THREE.Group | undefined {
    return this.models.get(modelID)?.group
  }

  disposeModel(): void {
    // Dispose all models
    this.models.forEach((model) => {
      if (this.api) {
        try { this.api.CloseModel(model.modelID) } catch { /* ignore */ }
      }
    })
    this.models.clear()
    this.elementMap.clear()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.disposeModel()
    if (this.api) {
      try {
        this.api.Dispose()
      } catch { /* ignore */ }
      this.api = null
    }
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
