import { supabase } from '@/lib/supabaseClient'

export interface ImageTransformOptions {
  width?: number
  height?: number
  quality?: number
  resize?: 'cover' | 'contain' | 'fill'
}

/**
 * Get public URL for a Supabase Storage image with optional transformation.
 * Handles null paths, http/data: URL passthrough, and transform defaults.
 */
export function getStorageImageUrl(
  bucket: string,
  path: string | null,
  transform?: ImageTransformOptions,
): string {
  if (!path) return ''
  if (path.startsWith('http') || path.startsWith('data:')) return path

  if (transform) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path, {
      transform: {
        width: transform.width,
        height: transform.height,
        quality: transform.quality ?? 80,
        resize: transform.resize ?? 'contain',
      },
    })
    return data.publicUrl
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Get optimized public URL for an avatar from its storage path.
 * Avatars display at 32–48px CSS; 96px at 2x Retina with cover crop.
 */
export function getAvatarUrl(path: string | null): string {
  return getStorageImageUrl('avatars', path, {
    width: 96,
    height: 96,
    quality: 80,
    resize: 'cover',
  })
}
