import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

const formatPrice = (value) => {
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n)
}

function SellerDashboard({ session }) {
  const sellerId = session?.user?.id
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [itemsByOrder, setItemsByOrder] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [modelFile, setModelFile] = useState(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [form, setForm] = useState({
    name: '',
    price: '',
  })

  const loadDashboard = useCallback(async () => {
    if (!sellerId) {
      setProducts([])
      setOrders([])
      setItemsByOrder({})
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    const { data: productsRows, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('seller_id', sellerId)
      .order('id', { ascending: false })

    if (productsError) {
      setError(productsError.message)
      setProducts([])
      setOrders([])
      setItemsByOrder({})
      setLoading(false)
      return
    }

    const ownProducts = productsRows ?? []
    setProducts(ownProducts)

    const productIds = ownProducts.map((p) => p.id).filter(Boolean)
    if (!productIds.length) {
      setOrders([])
      setItemsByOrder({})
      setLoading(false)
      return
    }

    const { data: itemRows, error: itemsError } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, quantity, price_at_time, products(id, name, price, seller_id)')
      .in('product_id', productIds)

    if (itemsError) {
      setError(itemsError.message)
      setOrders([])
      setItemsByOrder({})
      setLoading(false)
      return
    }

    const sellerItems = (itemRows ?? []).filter((row) => row.products?.seller_id === sellerId)
    const orderIds = [...new Set(sellerItems.map((row) => row.order_id).filter(Boolean))]

    if (!orderIds.length) {
      setOrders([])
      setItemsByOrder({})
      setLoading(false)
      return
    }

    const { data: orderRows, error: ordersError } = await supabase
      .from('orders')
      .select('id, created_at, status, total_price, full_name, email, phone, address')
      .in('id', orderIds)
      .order('created_at', { ascending: false })

    if (ordersError) {
      setError(ordersError.message)
      setOrders([])
      setItemsByOrder({})
      setLoading(false)
      return
    }

    const grouped = {}
    for (const item of sellerItems) {
      if (!grouped[item.order_id]) grouped[item.order_id] = []
      grouped[item.order_id].push(item)
    }

    setOrders(orderRows ?? [])
    setItemsByOrder(grouped)
    setLoading(false)
  }, [sellerId])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const totalSoldItems = useMemo(() => {
    return Object.values(itemsByOrder).reduce((sum, list) => {
      return sum + list.reduce((inner, item) => inner + (Number(item.quantity) || 0), 0)
    }, 0)
  }, [itemsByOrder])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const uploadFile = async (file, folder) => {
    if (!file) return null

    const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const filePath = `${sellerId}/${folder}/${safeName}`

    const { error: uploadError } = await supabase.storage.from('product-assets').upload(filePath, file, {
      upsert: false,
    })

    if (uploadError) {
      throw uploadError
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('product-assets').getPublicUrl(filePath)

    return publicUrl
  }

  const handleCreateProduct = async (event) => {
    event.preventDefault()
    setSuccess('')
    setError('')

    if (!sellerId) {
      setError('Не удалось определить продавца из сессии.')
      return
    }

    const priceValue = Number(form.price)
    if (!form.name.trim() || Number.isNaN(priceValue) || priceValue < 0) {
      setError('Укажите название и корректную цену товара.')
      return
    }

    setSaving(true)

    try {
      setIsUploadingFile(true)
      setUploadMessage('Загрузка файла...')

      const imageUrl = await uploadFile(imageFile, 'images')

      setUploadMessage('Загрузка файла... (3D модель)')
      const modelUrl = await uploadFile(modelFile, 'models')

      setUploadMessage('')
      setIsUploadingFile(false)

      const payload = {
        name: form.name.trim(),
        price: priceValue,
        image_url: imageUrl,
        model_url: modelUrl,
        seller_id: sellerId,
      }

      const { data, error: insertError } = await supabase.from('products').insert([payload]).select().single()

      if (insertError) {
        setError(insertError.message)
        setSaving(false)
        return
      }

      setProducts((prev) => [data, ...prev])
      setForm({ name: '', price: '' })
      setImageFile(null)
      setModelFile(null)
      setFileInputKey((prev) => prev + 1)
      setSuccess('Товар добавлен.')
      setSaving(false)
    } catch (submitError) {
      setError(submitError.message || 'Не удалось загрузить файлы.')
      setIsUploadingFile(false)
      setUploadMessage('')
      setSaving(false)
    }
  }

  if (!sellerId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
        Войдите как продавец, чтобы открыть панель.
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Панель продавца</h1>
        <p className="mt-1 text-sm text-slate-600">
          Товары: {products.length} • Заказы с вашими товарами: {orders.length} • Продано единиц: {totalSoldItems}
        </p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{success}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Добавить товар</h2>
          <form onSubmit={handleCreateProduct} className="mt-4 space-y-3">
            <input
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              placeholder="Название"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <input
              name="price"
              type="number"
              min="0"
              step="1"
              value={form.price}
              onChange={handleChange}
              placeholder="Цена"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <input
              key={`image-${fileInputKey}`}
              type="file"
              accept=".jpg,.png"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-slate-700"
            />
            <input
              key={`model-${fileInputKey}`}
              type="file"
              accept=".glb"
              onChange={(event) => setModelFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            {isUploadingFile && (
              <p className="text-sm text-blue-700">{uploadMessage || 'Загрузка файла...'}</p>
            )}
            <button
              type="submit"
              disabled={saving || isUploadingFile}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {saving || isUploadingFile ? 'Сохранение...' : 'Добавить товар'}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Мои товары</h2>
            <button
              type="button"
              onClick={() => loadDashboard()}
              disabled={loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Обновить
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-slate-500">Загрузка...</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-slate-500">Пока нет товаров.</p>
          ) : (
            <ul className="space-y-2">
              {products.map((product) => (
                <li key={product.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <span className="truncate text-sm text-slate-800">{product.name || 'Без названия'}</span>
                  <span className="shrink-0 text-sm font-medium text-slate-700">{formatPrice(product.price)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Заказы с вашими товарами</h2>
        <p className="mt-1 text-sm text-slate-500">Показываются только позиции, относящиеся к вашим товарам.</p>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Загрузка заказов...</p>
        ) : orders.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Подходящих заказов пока нет.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {orders.map((order) => {
              const items = itemsByOrder[order.id] ?? []
              return (
                <li key={order.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">Заказ #{String(order.id).slice(0, 8)}</p>
                    <p className="text-sm text-slate-500">
                      {order.created_at ? new Date(order.created_at).toLocaleString('ru-RU') : 'Дата не указана'}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Клиент: {order.full_name || order.email || order.phone || '—'} • Статус: {order.status || 'pending'}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <span className="text-slate-700">
                          {item.products?.name || `Товар #${item.product_id}`} × {item.quantity || 0}
                        </span>
                        <span className="font-medium text-slate-800">
                          {formatPrice((Number(item.price_at_time) || Number(item.products?.price) || 0) * (Number(item.quantity) || 0))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

export default SellerDashboard
