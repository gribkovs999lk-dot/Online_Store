import { useMemo, useState } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination } from 'swiper/modules'
import { useCartStore } from './cartStore'
import { supabase } from './supabaseClient'

import 'swiper/css'
import 'swiper/css/pagination'

function getProductAssetUrl(filePath) {
  if (!filePath) return '';

  // Если это уже локальная blob-ссылка для превью, не трогаем её
  if (filePath.startsWith('blob:')) return filePath;

  // Если filePath случайно пришёл как полная ссылка, берём только хвостик
  let cleanPath = filePath;
  if (filePath.includes('public/product-assets/')) {
    cleanPath = filePath.split('public/product-assets/')[1];
  }

  // Получаем чистый URL от Supabase (синхронно, без await!)
  const { data } = supabase.storage.from('product-assets').getPublicUrl(cleanPath);
  const publicUrl = data?.publicUrl;

  if (!publicUrl) return '';

  // Всегда принудительно делаем замену домена в браузере
  if (typeof window !== 'undefined') {
    return publicUrl.replace('https://yzwfkcwqtakglfzkoccy.supabase.co', `${window.location.origin}/supabase`);
  }

  return publicUrl;
}


const PLACEHOLDER_IMG = 'https://via.placeholder.com/400x300?text=No+Media'

const mediaHeight = { width: '100%', height: '280px' }

function formatPrice(price) {
  const numericPrice = Number(price)
  if (Number.isNaN(numericPrice)) return 'Цена не указана'
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(numericPrice)
}

/** @param {{ product: Record<string, unknown>, isAdmin?: boolean, onProductDeleted?: (id: string | number) => void }} props */
function ProductCard({ product, isAdmin = false, onProductDeleted }) {
  const addToCart = useCartStore((state) => state.addToCart)
  const cartItems = useCartStore((state) => state.items)
  const [deleting, setDeleting] = useState(false)

  const productId = product.id

  const cartCountForProduct = cartItems.filter((i) => i.id === productId).length

  const slides = useMemo(() => {
    const modelSrc =
      product.model_url ?? product.modelUrl ?? product.model_3d_url ?? ''
    const urls = Array.isArray(product.image_urls)
      ? product.image_urls.filter((u) => typeof u === 'string' && u.trim() !== '')
      : []
    const legacy =
      (typeof product.image_url === 'string' && product.image_url) ||
      (typeof product.imageUrl === 'string' && product.imageUrl) ||
      null

    const items = []

    if (modelSrc) {
      const poster = urls[0] ?? legacy ?? undefined
      items.push({ kind: 'model', key: `m-${productId}-3d`, src: modelSrc, poster })
      urls.forEach((url, i) => {
        items.push({ kind: 'img', key: `m-${productId}-img-${i}`, url })
      })
      return items
    }

    const mainImg = urls[0] ?? legacy
    if (mainImg) {
      items.push({ kind: 'img', key: `m-${productId}-hero`, url: mainImg })
      for (let i = 1; i < urls.length; i++) {
        items.push({ kind: 'img', key: `m-${productId}-rest-${i}`, url: urls[i] })
      }
      return items
    }

    items.push({ kind: 'img', key: `m-${productId}-ph`, url: PLACEHOLDER_IMG })
    return items
  }, [product, productId])

  const name = typeof product.name === 'string' ? product.name : product.name == null ? 'Без названия' : String(product.name)

  const handleAdminDelete = async () => {
    if (!isAdmin || productId == null) return
    if (!window.confirm('Удалить этот товар из каталога? Это действие нельзя отменить.')) return

    setDeleting(true)
    const { error: deleteError } = await supabase.from('products').delete().eq('id', productId)

    setDeleting(false)

    if (deleteError) {
      window.alert(deleteError.message || 'Не удалось удалить товар.')
      return
    }

    onProductDeleted?.(productId)
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/5 transition hover:border-blue-200/80 hover:shadow-lg hover:shadow-blue-500/10">
      <div className="relative bg-gradient-to-b from-slate-100 to-slate-50 [&_.swiper-pagination-bullet-active]:bg-blue-600">
        <Swiper
          modules={[Pagination]}
          spaceBetween={0}
          slidesPerView={1}
          pagination={{ clickable: true, dynamicBullets: slides.length > 3 }}
          className="product-card-swiper !pb-10"
        >
          {slides.map((slide, index) => (
            <SwiperSlide key={slide.key} className="!flex items-center justify-center bg-slate-100">
              {slide.kind === 'model' ? (
                <model-viewer
                  src={getProductAssetUrl(slide.src)}
                  poster={slide.poster}
                  alt={name}
                  ar
                  camera-controls
                  auto-rotate
                  style={mediaHeight}
                  className="w-full bg-slate-900/5"
                />
              ) : (
                <img
                  src={getProductAssetUrl(slide.src)}
                  alt={name}
                  className="h-[280px] w-full object-cover"
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
              )}
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5 pt-4">
        <h2 className="line-clamp-2 min-h-[3.5rem] text-lg font-semibold leading-snug tracking-tight text-slate-900">
          {name}
        </h2>
        <p className="text-xl font-bold tabular-nums text-blue-600">{formatPrice(product.price)}</p>
        <div className="mt-auto flex flex-col gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={handleAdminDelete}
              disabled={deleting}
              className="w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              {deleting ? 'Удаление…' : 'Удалить товар'}
            </button>
          )}
          <button
            type="button"
            onClick={() => addToCart(product)}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98]"
          >
            В корзину
            {cartCountForProduct > 0 ? (
              <span className="ml-2 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-white/20 px-2 text-xs font-bold">
                {cartCountForProduct}
              </span>
            ) : null}
          </button>
        </div>
      </div>
    </article>
  )
}

export default ProductCard
