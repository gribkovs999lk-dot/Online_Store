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

function SellerProducts({ session }) {
  const sellerId = session?.user?.id
  const [products, setProducts] = useState([])
  const [orders, setOrders] = useState([])
  const [itemsByOrder, setItemsByOrder] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editingProduct, setEditingProduct] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', price: '' })
  const [editImageFiles, setEditImageFiles] = useState([])
  const [editFileInputKey, setEditFileInputKey] = useState(0)
  const [editSaving, setEditSaving] = useState(false)
  const [editUploading, setEditUploading] = useState(false)
  const [editUploadMessage, setEditUploadMessage] = useState('')
  const [editError, setEditError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const editPreviewUrls = useMemo(
    () => editImageFiles.map((file) => URL.createObjectURL(file)),
    [editImageFiles]
  )

  useEffect(() => {
    return () => {
      editPreviewUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [editPreviewUrls])

  const loadData = useCallback(async () => {
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

    setProducts(productsRows ?? [])

    const { data: itemRows, error: itemsError } = await supabase
      .from('order_items')
      .select(
        `
        id,
        order_id,
        product_id,
        quantity,
        price_at_time,
        products!inner (
          id,
          name,
          price,
          seller_id
        )
      `
      )
      .eq('products.seller_id', sellerId)

    if (itemsError) {
      setError(itemsError.message)
      setOrders([])
      setItemsByOrder({})
      setLoading(false)
      return
    }

    const sellerItems = itemRows ?? []
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
    loadData()
  }, [loadData])

  const uploadFile = async (file, folder) => {
    if (!file || !sellerId) return null

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
  
    // Проверяем, что код работает в браузере и это не локальный компьютер (localhost)
    const isProd = typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
  
    // Если это продакшен на Vercel, подменяем заблокированный домен на наш рабочий прокси
    return isProd 
      ? publicUrl.replace('https://yzwfkcwqtakglfzkoccy.supabase.co', `${window.location.origin}/supabase`)
      : publicUrl
  }

  const openEditModal = (product) => {
    setEditingProduct(product)
    setEditForm({
      name: typeof product.name === 'string' ? product.name : String(product.name ?? ''),
      price: product.price != null && product.price !== '' ? String(product.price) : '',
    })
    setEditImageFiles([])
    setEditFileInputKey((k) => k + 1)
    setEditError('')
    setEditUploadMessage('')
  }

  const closeEditModal = () => {
    if (editSaving || editUploading) return
    setEditingProduct(null)
    setEditImageFiles([])
    setEditError('')
    setEditUploadMessage('')
  }

  const handleEditSubmit = async (event) => {
    event.preventDefault()
    if (!editingProduct || !sellerId) return

    setEditError('')
    const priceValue = Number(editForm.price)
    if (!editForm.name.trim() || Number.isNaN(priceValue) || priceValue < 0) {
      setEditError('Укажите название и корректную цену.')
      return
    }

    const existingUrls = Array.isArray(editingProduct.image_urls)
      ? editingProduct.image_urls.filter((u) => typeof u === 'string' && u.trim() !== '')
      : []

    setEditSaving(true)

    try {
      let mergedUrls = [...existingUrls]

      if (editImageFiles.length > 0) {
        setEditUploading(true)
        const newUrls = []
        for (let i = 0; i < editImageFiles.length; i++) {
          setEditUploadMessage(`Загрузка изображений… (${i + 1}/${editImageFiles.length})`)
          const url = await uploadFile(editImageFiles[i], 'images')
          if (url) newUrls.push(url)
        }
        mergedUrls = [...mergedUrls, ...newUrls]
        setEditUploadMessage('')
        setEditUploading(false)
      }

      const { error: updateError } = await supabase
        .from('products')
        .update({
          name: editForm.name.trim(),
          price: priceValue,
          image_urls: mergedUrls,
        })
        .eq('id', editingProduct.id)
        .eq('seller_id', sellerId)

      if (updateError) {
        setEditError(updateError.message)
        setEditSaving(false)
        return
      }

      setEditingProduct(null)
      setEditImageFiles([])
      setEditFileInputKey((k) => k + 1)
      await loadData()
    } catch (err) {
      setEditError(err?.message || 'Не удалось сохранить изменения.')
      setEditUploading(false)
      setEditUploadMessage('')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteProduct = async (product) => {
    if (!sellerId || !product?.id) return
    if (!window.confirm(`Удалить товар «${product.name || 'Без названия'}»? Это действие нельзя отменить.`)) return

    setDeletingId(product.id)
    setError('')

    const { error: deleteError } = await supabase.from('products').delete().eq('id', product.id).eq('seller_id', sellerId)

    setDeletingId(null)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    await loadData()
  }

  if (!sellerId) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          Войдите, чтобы просмотреть товары и заказы.
        </div>
      </div>
    )
  }

  const editingThumbnails = editingProduct
    ? Array.isArray(editingProduct.image_urls)
      ? editingProduct.image_urls.filter((u) => typeof u === 'string' && u.trim() !== '')
      : []
    : []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Мои товары и заказы</h1>
        <p className="mt-1 text-sm text-slate-600">
          В списке заказов учитываются только позиции с вашими товарами.
        </p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Мои товары</h2>
          <button
            type="button"
            onClick={() => loadData()}
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2 font-semibold text-slate-700">Название</th>
                  <th className="px-3 py-2 font-semibold text-slate-700">Цена</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Действия</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 text-slate-800">{product.name || 'Без названия'}</td>
                    <td className="px-3 py-2 font-medium text-slate-700">{formatPrice(product.price)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(product)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(product)}
                          disabled={deletingId === product.id}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          {deletingId === product.id ? 'Удаление…' : 'Удалить'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Заказы с вашими товарами</h2>
        <p className="mt-1 text-sm text-slate-500">Только строки заказа, отфильтрованные по seller_id товара в Supabase.</p>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Загрузка заказов...</p>
        ) : orders.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Подходящих заказов пока нет.</p>
        ) : (
          <div className="mt-4 space-y-6">
            {orders.map((order) => {
              const items = itemsByOrder[order.id] ?? []
              return (
                <div key={order.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">Заказ #{String(order.id).slice(0, 8)}</p>
                    <p className="text-sm text-slate-500">
                      {order.created_at ? new Date(order.created_at).toLocaleString('ru-RU') : 'Дата не указана'}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Клиент: {order.full_name || order.email || order.phone || '—'} • Статус: {order.status || 'pending'}
                  </p>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[360px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-3 py-2 text-left font-semibold text-slate-700">Товар</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-700">Кол-во</th>
                          <th className="px-3 py-2 text-right font-semibold text-slate-700">Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id} className="border-b border-slate-100 last:border-0">
                            <td className="px-3 py-2 text-slate-700">
                              {item.products?.name || `Товар #${item.product_id}`}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-700">{item.quantity || 0}</td>
                            <td className="px-3 py-2 text-right font-medium text-slate-800">
                              {formatPrice(
                                (Number(item.price_at_time) || Number(item.products?.price) || 0) *
                                  (Number(item.quantity) || 0)
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {editingProduct && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-product-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <h3 id="edit-product-title" className="text-lg font-semibold text-slate-900">
                Редактировать товар
              </h3>
              <button
                type="button"
                onClick={closeEditModal}
                disabled={editSaving || editUploading}
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                Закрыть
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3">
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Название"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <input
                type="number"
                min="0"
                step="1"
                value={editForm.price}
                onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="Цена"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />

              {editingThumbnails.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-medium text-slate-600">Текущие изображения</p>
                  <ul className="flex flex-wrap gap-2">
                    {editingThumbnails.map((src, index) => (
                      <li
                        key={`${src}-${index}`}
                        className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                      >
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <label className="block text-sm font-medium text-slate-700">
                Дозагрузить изображения
                <input
                  key={`edit-img-${editFileInputKey}`}
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  multiple
                  onChange={(event) => {
                    const list = event.target.files
                    setEditImageFiles(list ? Array.from(list) : [])
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-slate-700"
                />
              </label>

              {editPreviewUrls.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-medium text-slate-600">Новые файлы (предпросмотр)</p>
                  <ul className="flex flex-wrap gap-2">
                    {editPreviewUrls.map((src, index) => (
                      <li
                        key={`${src}-${index}`}
                        className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                      >
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {editUploading && <p className="text-sm text-blue-700">{editUploadMessage || 'Загрузка…'}</p>}
              {editError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{editError}</div>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={editSaving || editUploading}
                  className="flex-1 rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={editSaving || editUploading}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {editSaving || editUploading ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default SellerProducts
