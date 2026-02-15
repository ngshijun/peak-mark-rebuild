export const XP_PER_LEVEL = 500

export function computeLevel(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1
}
