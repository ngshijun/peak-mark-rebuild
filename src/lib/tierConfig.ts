export const tierConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  core: {
    label: 'Core',
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
  },
  plus: {
    label: 'Plus',
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/50',
  },
  pro: {
    label: 'Pro',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 dark:bg-blue-900/50',
  },
  // Deprecated but kept for existing subscribers
  max: {
    label: 'Max',
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-100 dark:bg-purple-900/50',
  },
}
