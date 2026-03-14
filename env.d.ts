/// <reference types="vite/client" />

declare module '*.gif' {
  const src: string
  export default src
}

interface Window {
  __PRERENDER_INJECTED?: Record<string, unknown>
}
