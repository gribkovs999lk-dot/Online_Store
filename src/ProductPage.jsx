import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'
import { supabase } from './supabaseClient'
import { useCartStore } from './cartStore'
import { getProductAssetUrl, PRODUCT_PLACEHOLDER_IMG } from './productAssets'

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
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [addedNotice, setAddedNotice] = useState(false)

  const addToCart = useCartStore((state) => state.addToCart)
  const cartItems = useCartStore((state) => state.items)

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
  const posterSrc = imageUrls[0] ?? undefined

  useEffect(() => {
    setSelectedImageIndex(0)
  }, [product?.id])

  const activeImage =
    imageUrls.length > 0 ? imageUrls[selectedImageIndex] ?? imageUrls[0] : PRODUCT_PLACEHOLDER_IMG

  const cartCountForProduct = product
    ? cartItems.filter((item) => String(item.id) === String(product.id)).length
    : 0

  const handleAddToCart = () => {
    if (!product) return
    addToCart(product)
    setAddedNotice(true)
    window.setTimeout(() => setAddedNotice(false), 2000)
  }

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
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5">
              <model-viewer
                src={modelSrc}
                poster={posterSrc}
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
                className="block w-full"
              />
            </div>
          )}

          {(hasGallery || showPlaceholderImage) && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-900/5 md:p-4">
              <div className="overflow-hidden rounded-xl bg-slate-100">
                <img
                  src={hasGallery ? activeImage : PRODUCT_PLACEHOLDER_IMG}
                  alt={product.name ?? 'Изображение товара'}
                  className="aspect-[4/3] w-full object-cover md:aspect-[16/10]"
                />
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
                          <img
                            src={url}
                            alt=""
                            className="h-16 w-16 object-cover sm:h-20 sm:w-20"
                          />
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

            <button
              type="button"
              onClick={handleAddToCart}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98]"
            >
              <ShoppingCart className="h-5 w-5" aria-hidden />
              Добавить в корзину
              {cartCountForProduct > 0 && (
                <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-sm">
                  {cartCountForProduct}
                </span>
              )}
            </button>

            {addedNotice && (
              <p className="mt-3 text-center text-sm font-medium text-emerald-600" role="status">
                Товар добавлен в корзину
              </p>
            )}

            <Link
              to="/cart"
              className="mt-3 block text-center text-sm font-medium text-slate-600 hover:text-blue-600"
            >
              Перейти в корзину
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default ProductPage
