import type { ClassValue } from 'clsx'
import type { Ref } from 'vue'
import type { Updater } from '@tanstack/vue-table'
import { clsx } from 'clsx'
import { isFunction } from '@tanstack/vue-table'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function valueUpdater<T>(updaterOrValue: Updater<T>, ref: Ref<T>) {
  ref.value = isFunction(updaterOrValue) ? updaterOrValue(ref.value) : updaterOrValue
}

/** Extract initials from a name (e.g. "John Doe" → "JD") */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

/**
 * Parses simple markdown to HTML.
 * Supports: **bold**, *italic*, and newlines.
 * Escapes HTML to prevent XSS.
 */
export function parseSimpleMarkdown(text: string): string {
  // Escape HTML first to prevent XSS
  let result = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  // Convert **bold** to <strong>
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Convert *italic* to <em> (but not inside **)
  result = result.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>')

  // Convert newlines to <br>
  result = result.replace(/\n/g, '<br>')

  return result
}
