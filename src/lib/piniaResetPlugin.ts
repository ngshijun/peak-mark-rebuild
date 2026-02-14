import type { PiniaPlugin } from 'pinia'

// Stores excluded from bulk reset (device preferences, not user data)
const EXCLUDED_STORES = new Set(['auth', 'theme', 'language'])

const resetFunctions = new Map<string, () => void>()

export const piniaResetPlugin: PiniaPlugin = ({ store }) => {
  if (EXCLUDED_STORES.has(store.$id)) return

  // Store's $reset is already defined (setup stores with custom $reset)
  if (typeof store.$reset === 'function') {
    resetFunctions.set(store.$id, () => store.$reset())
  }
}

export function resetAllStores(): { failed: string[] } {
  const failed: string[] = []
  for (const [id, reset] of resetFunctions) {
    try {
      reset()
    } catch (err) {
      console.error(`Failed to reset store "${id}":`, err)
      failed.push(id)
    }
  }
  return { failed }
}
