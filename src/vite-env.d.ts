/// <reference types="vite/client" />

declare module '*.wasm' {
  const content: string
  export default content
}

declare module 'web-ifc' {
  export * from 'web-ifc'
}

declare module 'web-ifc-three' {
  export * from 'web-ifc-three'
}
