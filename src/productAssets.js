export function getProductAssetUrl(filePath) {
  if (!filePath) return ''

  if (filePath.startsWith('blob:')) return filePath

  let cleanPath = filePath

  if (cleanPath.includes('product-assets/')) {
    cleanPath = cleanPath.split('product-assets/')[1]
  }

  cleanPath = cleanPath.replace(/^\/+/, '')

  if (typeof window !== 'undefined') {
    const currentOrigin = window.location.origin
    return `${currentOrigin}/supabase/storage/v1/object/public/product-assets/${cleanPath}`
  }

  return `https://yzwfkcwqtakglfzkoccy.supabase.co/storage/v1/object/public/product-assets/${cleanPath}`
}

export const PRODUCT_PLACEHOLDER_IMG = 'https://via.placeholder.com/800x600?text=No+Image'
