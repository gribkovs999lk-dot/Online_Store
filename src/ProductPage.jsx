import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Maximize2 } from 'lucide-react'
import { supabase } from './supabaseClient'
import { getProductAssetUrl, PRODUCT_PLACEHOLDER_IMG } from './productAssets'
import CartQuantityControl from './CartQuantityControl'
import {
  PRODUCT_IMAGE_FRAME,
  PRODUCT_IMAGE_IMG,
  PRODUCT_THUMB_FRAME,
  PRODUCT_THUMB_IMG,
} from './productImageClasses'

function formatPrice(price) {
  const numericPrice = Number(price)
  if (Number.isNaN(numericPrice)) return '—'
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(numericPrice)
}

function getModelUrl(product) {
  const url = product?.model_url ?? product?.modelUrl ?? product?.model_3d_url ?? ''
  return typeof url === 'string' && url.trim() !== '' ? url.trim() : null
}

function getImageUrls(product) {
  const urls = Array.isArray(product?.image_urls)
    ? product.image_urls.filter((u) => typeof u === 'string' && u.trim() !== '')
    : []
  const legacy =
    (typeof product?.image_url === 'string' && product.image_url.trim()) ||
    (typeof product?.imageUrl === 'string' && product.imageUrl.trim()) ||
    null

  if (urls.length > 0) return urls
  if (legacy) return [legacy]
  return []
}

function ProductPage() {
  const { id } = useParams()
  const [session, setSession] = useState(null)
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [fullscreenMedia, setFullscreenMedia] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!fullscreenMedia) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setFullscreenMedia(null)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [fullscreenMedia])

  useEffect(() => {
    if (!id) {
      setProduct(null)
      setLoading(false)
      return
    }

    const fetchProductDetails = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('is_deleted', false)
        .maybeSingle()

      if (error) {
        console.error('Ошибка загрузки товара:', error)
        setProduct(null)
      } else {
        setProduct(data)
      }
      setLoading(false)
    }

    fetchProductDetails()
  }, [id])

  const imagePaths = useMemo(() => (product ? getImageUrls(product) : []), [product])
  const imageUrls = useMemo(() => imagePaths.map(getProductAssetUrl), [imagePaths])
  const modelPath = useMemo(() => (product ? getModelUrl(product) : null), [product])
  const modelSrc = modelPath ? getProductAssetUrl(modelPath) : null

  useEffect(() => {
    setSelectedImageIndex(0)
  }, [product?.id])

  const activeImage =
    imageUrls.length > 0 ? imageUrls[selectedImageIndex] ?? imageUrls[0] : PRODUCT_PLACEHOLDER_IMG

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[50vh] items-center justify-center p-8">
        <p className="text-slate-600">Загрузка товара…</p>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container mx-auto space-y-4 p-8 text-center">
        <p className="text-lg text-slate-700">Товар не найден</p>
        <Link to="/" className="text-sm font-medium text-blue-600 hover:underline">
          ← Назад в каталог
        </Link>
      </div>
    )
  }

  const hasGallery = imageUrls.length > 0
  const showPlaceholderImage = !modelSrc && !hasGallery

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <Link
        to="/"
        className="mb-6 inline-flex items-center text-sm font-medium text-blue-600 transition hover:text-blue-700 hover:underline"
      >
        ← Назад в каталог
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:gap-10">
        <div className="space-y-4">
          {modelSrc && (
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5">
              <button
                type="button"
                onClick={() => setFullscreenMedia({ type: 'model', url: modelSrc })}
                className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-md ring-1 ring-slate-200/80 backdrop-blur-sm transition hover:bg-white hover:text-blue-700"
                aria-label="Открыть 3D-модель на весь экран"
              >
                <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                Во весь экран
              </button>
              <model-viewer
                src={modelSrc}
                alt={product.name ?? '3D-модель товара'}
                camera-controls
                auto-rotate
                ar
                ar-modes="webxr scene-viewer quick-look"
                shadow-intensity="1"
                style={{
                  width: '100%',
                  height: '450px',
                  background: '#f8fafc',
                  borderRadius: '16px',
                }}
                className="relative block w-full"
              >
                <div
                  slot="poster"
                  id="lazy-load-poster"
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-slate-50/80 px-6 text-center backdrop-blur-sm"
                >
                  <div
                    className="h-11 w-11 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"
                    aria-hidden
                  />
                  <p className="max-w-xs text-sm font-medium leading-snug text-slate-700">
                    Инициализация интерактивной 3D-модели...
                  </p>
                </div>
              </model-viewer>
            </div>
          )}

          {(hasGallery || showPlaceholderImage) && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-900/5 md:p-4">
              <div className="relative w-full overflow-hidden rounded-xl bg-gray-50">
                {hasGallery && (
                  <button
                    type="button"
                    onClick={() => setFullscreenMedia({ type: 'image', url: activeImage })}
                    className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-md ring-1 ring-slate-200/80 backdrop-blur-sm transition hover:bg-white hover:text-blue-700"
                    aria-label="Открыть изображение на весь экран"
                  >
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                    Во весь экран <span aria-hidden>⛶</span>
                  </button>
                )}
                <div className={`${PRODUCT_IMAGE_FRAME} !aspect-auto h-[450px] !bg-gray-50`}>
                  <img
                    src={hasGallery ? activeImage : PRODUCT_PLACEHOLDER_IMG}
                    alt={product.name ?? 'Изображение товара'}
                    className={PRODUCT_IMAGE_IMG}
                    draggable={false}
                  />
                </div>
              </div>

              {imageUrls.length > 1 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {imageUrls.map((url, index) => {
                    const isActive = index === selectedImageIndex
                    return (
                      <li key={`${url}-${index}`}>
                        <button
                          type="button"
                          onClick={() => setSelectedImageIndex(index)}
                          className={`overflow-hidden rounded-lg border-2 transition ${
                            isActive
                              ? 'border-blue-600 ring-2 ring-blue-600/20'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                          aria-label={`Фото ${index + 1}`}
                          aria-pressed={isActive}
                        >
                          <div className={PRODUCT_THUMB_FRAME}>
                            <img src={url} alt="" className={PRODUCT_THUMB_IMG} draggable={false} />
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-900/5 md:p-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              {product.name ?? 'Без названия'}
            </h1>
            <p className="mt-3 text-3xl font-bold tabular-nums text-blue-600">
              {formatPrice(product.price)}
            </p>

            <section className="mt-6 border-t border-slate-100 pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Описание
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-slate-600">
                {product.description?.trim()
                  ? product.description
                  : 'Описание товара готовится'}
              </p>
            </section>

            <div className="mt-8">
              <CartQuantityControl
                product={product}
                session={session}
                addLabel="Добавить в корзину"
                className="py-3.5 text-base shadow-lg shadow-blue-600/25"
              />
            </div>

            <Link
              to="/cart"
              className="mt-3 block text-center text-sm font-medium text-slate-600 hover:text-blue-600"
            >
              Перейти в корзину
            </Link>
          </div>
        </aside>
      </div>

      {fullscreenMedia && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md transition-opacity duration-200"
          role="dialog"
          aria-modal="true"
          aria-label={fullscreenMedia.type === 'model' ? '3D-модель на весь экран' : 'Изображение на весь экран'}
          onClick={() => setFullscreenMedia(null)}
        >
          <button
            type="button"
            onClick={() => setFullscreenMedia(null)}
            className="absolute right-4 top-4 z-[110] flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl font-light text-white ring-1 ring-white/20 transition hover:bg-white/20"
            aria-label="Закрыть"
          >
            ✕
          </button>

          <div
            className="flex max-h-full max-w-full scale-100 items-center justify-center transition-transform duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            {fullscreenMedia.type === 'image' && (
              <img
                src={fullscreenMedia.url}
                alt={product.name ?? 'Изображение товара'}
                className="h-[90vh] w-full max-w-[100vw] object-contain"
              />
            )}

            {fullscreenMedia.type === 'model' && (
              <model-viewer
                src={fullscreenMedia.url}
                alt={product.name ?? '3D-модель товара'}
                camera-controls
                auto-rotate
                ar
                ar-modes="webxr scene-viewer quick-look"
                shadow-intensity="1"
                className="h-screen w-screen max-h-[100dvh] max-w-[100vw] bg-slate-900"
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductPage
