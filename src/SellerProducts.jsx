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

  const loadDashboardData = useCallback(async () => {
    if (!sellerId) return
    setLoading(true)
    setError('')
    try {
      const { data: productsData, error: pError } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false })

      if (pError) throw pError
      setProducts(productsData || [])

      const { data: itemsData, error: iError } = await supabase
        .from('order_items')
        .select('*, products!inner(*)')
        .eq('products.seller_id', sellerId)

      if (iError) throw iError

      const orderIds = Array.from(new Set((itemsData || []).map((item) => item.order_id)))

      if (orderIds.length > 0) {
        const { data: ordersData, error: oError } = await supabase
          .from('orders')
          .select('*')
          .in('id', orderIds)
          .order('created_at', { ascending: false })

        if (oError) throw oError
        setOrders(ordersData || [])

        const grouped = (itemsData || []).reduce((acc, item) => {
          if (!acc[item.order_id]) acc[item.order_id] = []
          acc[item.order_id].push(item)
          return acc
        }, {})
        setItemsByOrder(grouped)
      } else {
        setOrders([])
        setItemsByOrder({})
      }
    } catch (err) {
      setError(err.message || 'Ошибка загрузки данных продавца')
    } finally {
      setLoading(false)
    }
  }, [sellerId])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const openEditModal = (product) => {
    setEditingProduct(product)
    setEditForm({ name: product.name, price: String(product.price) })
    setEditImageFiles([])
    setEditError('')
  }

  const closeEditModal = () => {
    setEditingProduct(null)
    setEditImageFiles([])
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editingProduct) return

    setEditSaving(true)
    setEditError('')

    try {
      let finalImageUrls = editingProduct.image_urls || []
      let finalImageUrl = editingProduct.image_url

      if (editImageFiles.length > 0) {
        setEditUploading(true)
        setEditUploadMessage('Загрузка новых изображений...')

        const newPaths = []
        for (const file of editImageFiles) {
          const fileExt = file.name.split('.').pop()
          const fileName = `${Math.random()}.${fileExt}`
          const filePath = `${sellerId}/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('product-assets')
            .upload(filePath, file)

          if (uploadError) throw uploadError
          newPaths.push(filePath)
        }

        finalImageUrls = [...finalImageUrls, ...newPaths]
        if (!finalImageUrl && newPaths.length > 0) {
          finalImageUrl = newPaths[0]
        }
        setEditUploading(false)
      }

      const updatedFields = {
        name: editForm.name,
        price: parseFloat(editForm.price),
        image_url: finalImageUrl,
        image_urls: finalImageUrls,
      }

      const { error: updateError } = await supabase
        .from('products')
        .update(updatedFields)
        .eq('id', editingProduct.id)

      if (updateError) throw updateError

      // Синхронизируем стейт с учетом новых картинок, чтобы они обновлялись без перезагрузки страницы
      setProducts((prev) =>
        prev.map((p) => (p.id === editingProduct.id ? { ...p, ...updatedFields } : p))
      )
      closeEditModal()
    } catch (err) {
      setEditUploading(false)
      setEditError(err.message || 'Ошибка при обновлении товара')
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот товар?')) return
    setDeletingId(id)
    try {
      const { error: delError } = await supabase.from('products').delete().eq('id', id)
      if (delError) throw delError
      setProducts((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      alert(err.message || 'Ошибка удаления товара')
    } finally {
      setDeletingId(false)
    }
  }

  if (loading) return <div className="p-4 text-slate-600">Загрузка данных продавца…</div>
  if (error) return <div className="p-4 text-red-600">Ошибка: {error}</div>

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-8">
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-800">Мои товары ({products.length})</h2>
        {products.length === 0 ? (
          <p className="text-sm text-slate-500">У вас пока нет добавленных товаров.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-700 uppercase">
                <tr>
                  <th className="px-4 py-3">Товар</th>
                  <th className="px-4 py-3">Цена</th>
                  <th className="px-4 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{product.name}</td>
                    <td className="px-4 py-3">{formatPrice(product.price)}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(product)}
                        className="rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        disabled={deletingId === product.id}
                        className="rounded bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                      >
                        {deletingId === product.id ? 'Удаление…' : 'Удалить'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Модальное окно редактирования товара */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Редактирование товара</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Название</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Цена (₽)</label>
                <input
                  type="number"
                  required
                  value={editForm.price}
                  onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">Добавить новые изображения</label>
                <input
                  key={`edit-file-${editFileInputKey}`}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setEditImageFiles(Array.from(e.target.files ?? []))}
                  className="w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {editPreviewUrls.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-medium text-slate-600">Предпросмотр новых изображений</p>
                  <ul className="flex flex-wrap gap-2">
                    {editPreviewUrls.map((src, index) => (
                      <li key={`${src}-${index}`} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        {/* Чистый src без проксирования */}
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {editUploading && <p className="text-sm text-blue-700 font-medium">{editUploadMessage || 'Загрузка…'}</p>}
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