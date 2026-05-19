import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination } from 'swiper/modules'
import { Box } from 'lucide-react'
import { supabase } from './supabaseClient'
import CartQuantityControl from './CartQuantityControl'
import { PRODUCT_IMAGE_FRAME, PRODUCT_IMAGE_IMG } from './productImageClasses'

import 'swiper/css'
import 'swiper/css/pagination'

import { getProductAssetUrl, PRODUCT_PLACEHOLDER_IMG as PLACEHOLDER_IMG } from './productAssets'

function formatPrice(price) {
  const numericPrice = Number(price)
  if (Number.isNaN(numericPrice)) return 'Цена не указана'
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(numericPrice)
}

function hasModelUrl(product) {
  const url = product.model_url ?? product.modelUrl ?? product.model_3d_url ?? ''
  return typeof url === 'string' && url.trim() !== ''
}

/** @param {{ product: Record<string, unknown>, isAdmin?: boolean, onProductDeleted?: (id: string | number) => void }} props */
function ProductCard({ product, isAdmin = false, onProductDeleted }) {
  const [deleting, setDeleting] = useState(false)

  const productId = product.id

  const imageSlides = useMemo(() => {
    const urls = Array.isArray(product.image_urls)
      ? product.image_urls.filter((u) => typeof u === 'string' && u.trim() !== '')
      : []
    const legacy =
      (typeof product.image_url === 'string' && product.image_url) ||
      (typeof product.imageUrl === 'string' && product.imageUrl) ||
      null

    if (urls.length > 0) {
      return urls.map((url, index) => ({
        key: `img-${productId}-${index}`,
        src: getProductAssetUrl(url),
      }))
    }

    if (legacy) {
      return [{ key: `legacy-${productId}`, src: getProductAssetUrl(legacy) }]
    }

    return [{ key: `placeholder-${productId}`, src: PLACEHOLDER_IMG }]
  }, [product, productId])

  const show3dBadge = hasModelUrl(product)

  const name =
    typeof product.name === 'string'
      ? product.name
      : product.name == null
        ? 'Без названия'
        : String(product.name)
  const productHref = productId != null ? `/product/${productId}` : null
  const paginationClass =
    productId != null ? `product-card-pagination-${productId}` : 'product-card-pagination'

  const handleAdminDelete = async (event) => {
    event.preventDefault()
    event.stopPropagation()
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

  const linkClassName =
    'block text-inherit no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

  const swiperBlock = (
    <Swiper
      modules={[Pagination]}
      spaceBetween={0}
      slidesPerView={1}
      pagination={{
        clickable: true,
        dynamicBullets: imageSlides.length > 3,
        el: `.${paginationClass}`,
      }}
      className="product-card-swiper !h-auto"
    >
      {imageSlides.map((slide, index) => (
        <SwiperSlide key={slide.key} className="!h-auto">
          <div className={PRODUCT_IMAGE_FRAME}>
            <img
              src={slide.src}
              alt={name}
              className={PRODUCT_IMAGE_IMG}
              loading={index === 0 ? 'eager' : 'lazy'}
              draggable={false}
            />
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  )

  const titleBlock = (
    <div className="flex flex-1 flex-col gap-2 p-5 pt-4">
      <h2 className="line-clamp-2 min-h-[3.5rem] text-lg font-semibold leading-snug tracking-tight text-slate-900 transition group-hover:text-blue-600">
        {name}
      </h2>
      <p className="text-xl font-bold tabular-nums text-blue-600">{formatPrice(product.price)}</p>
    </div>
  )

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-900/5 transition hover:border-blue-200/80 hover:shadow-lg hover:shadow-blue-500/10">
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-100 to-slate-50 [&_.swiper-pagination-bullet-active]:bg-blue-600">
        {productHref ? (
          <Link to={productHref} className={linkClassName} aria-label={`Открыть «${name}»`}>
            {swiperBlock}
          </Link>
        ) : (
          swiperBlock
        )}
        <div className={`${paginationClass} swiper-pagination !relative !bottom-0 !mt-0 !pb-3`} />
        {show3dBadge && (
          <span className="pointer-events-none absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-slate-900/85 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm ring-1 ring-white/20 backdrop-blur-sm">
            <Box className="h-3.5 w-3.5 shrink-0" aria-hidden />
            3D доступно
          </span>
        )}
      </div>

      {productHref ? (
        <Link to={productHref} className={`${linkClassName} flex flex-1 flex-col`}>
          {titleBlock}
        </Link>
      ) : (
        titleBlock
      )}

      <div className="flex flex-col gap-2 px-5 pb-5">
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
        <CartQuantityControl product={product} addLabel="В корзину" />
      </div>
    </article>
  )
}

export default ProductCard
