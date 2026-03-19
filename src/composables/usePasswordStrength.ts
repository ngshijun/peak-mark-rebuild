import { computed, type Ref } from 'vue'

type StrengthLevel = 0 | 1 | 2 | 3 | 4

const LABELS: Record<StrengthLevel, string> = {
  0: 'Too short',
  1: 'Weak',
  2: 'Fair',
  3: 'Good',
  4: 'Strong',
}

const COLORS: Record<StrengthLevel, string> = {
  0: 'bg-muted',
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-yellow-500',
  4: 'bg-green-500',
}

function calcStrength(password: string): StrengthLevel {
  if (!password || password.length < 8) return 0

  let score = 0
  if (/[a-z]/.test(password)) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  // Bonus for length
  if (password.length >= 12) score++

  if (score <= 1) return 1
  if (score === 2) return 2
  if (score === 3) return 3
  return 4
}

export function usePasswordStrength(password: Ref<string>) {
  const strength = computed<StrengthLevel>(() => calcStrength(password.value))
  const label = computed(() => LABELS[strength.value])
  const color = computed(() => COLORS[strength.value])

  return { strength, label, color }
}
