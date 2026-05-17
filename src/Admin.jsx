import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const STATUSES = ['pending', 'processing', 'completed', 'delivered', 'cancelled']
const DEFAULT_ROLES = ['buyer', 'seller', 'admin']

const formatPrice = (value) => {
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(n)
}

function Admin() {
  const [activeTab, setActiveTab] = useState('orders')
  const [orders, setOrders] = useState([])
  const [profiles, setProfiles] = useState([])
  const [products, setProducts] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(true)
  const [ordersError, setOrdersError] = useState(null)
  const [profilesError, setProfilesError] = useState(null)
  const [productsError, setProductsError] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [deletingProductId, setDeletingProductId] = useState(null)
  const [updatingProfileId, setUpdatingProfileId] = useState(null)

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true)
    setOrdersError(null)

    const { data, error: fetchError } = await supabase
      .from('orders')
      .select('*, order_items(*, products(*))')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setOrdersError(fetchError.message)
      setOrders([])
      setOrdersLoading(false)
      return
    }

    setOrders(data ?? [])
    setOrdersLoading(false)
  }, [])

  const loadProfiles = useCallback(async () => {
    setProfilesLoading(true)
    setProfilesError(null)

    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, role, is_blocked')
      .order('email', { ascending: true })

    if (fetchError) {
      setProfilesError(fetchError.message)
      setProfiles([])
      setProfilesLoading(false)
      return
    }

    setProfiles(data ?? [])
    setProfilesLoading(false)
  }, [])

  const loadProducts = useCallback(async () => {
    setProductsLoading(true)
    setProductsError(null)

    const { data, error: fetchError } = await supabase
      .from('products')
      .select('id, name, price, seller_id, category_id')
      .order('id', { ascending: false })
      .eq('is_deleted', false)

    if (fetchError) {
      setProductsError(fetchError.message)
      setProducts([])
      setProductsLoading(false)
      return
    }

    setProducts(data ?? [])
    setProductsLoading(false)
  }, [])

  useEffect(() => {
    loadOrders()
    loadProfiles()
    loadProducts()
  }, [loadOrders, loadProfiles, loadProducts])

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingId(orderId)
    setOrdersError(null)

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)

    if (updateError) {
      setOrdersError(updateError.message)
      setUpdatingId(null)
      return
    }

    setOrders((prev) => prev.map((order) => (order.id === orderId ? { ...order, status: newStatus } : order)))
    setUpdatingId(null)
  }

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Вы уверены, что хотите удалить заказ?')) return

    setDeletingId(orderId)
    setOrdersError(null)
    try {
      const { error: itemsError } = await supabase.from('order_items').delete().eq('order_id', orderId)
      if (itemsError) throw itemsError

      const { error: orderError } = await supabase.from('orders').delete().eq('id', orderId)
      if (orderError) throw orderError

      await loadOrders()
      window.alert('Заказ удален')
    } catch (error) {
      setOrdersError(error.message)
      window.alert(`Ошибка при удалении: ${error.message}`)
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот товар из каталога?')) return

    setDeletingProductId(productId)
    setProductsError(null)

    // ИСПРАВЛЕНИЕ: Вместо физического удаления .delete() 
    // делаем .update() и переводим флаг is_deleted в true
    const { error: deleteError } = await supabase
      .from('products')
      .update({ is_deleted: true })
      .eq('id', productId)

    setDeletingProductId(null)

    if (deleteError) {
      setProductsError(deleteError.message)
      window.alert(`Ошибка: ${deleteError.message}`)
      return
    }

    // Обновляем состояние UI, чтобы товар мгновенно исчез с экрана
    setProducts(prevProducts => prevProducts.filter(product => product.id !== productId))
    
    window.alert('Товар успешно удален из каталога!')
  }

  const handleToggleBlocked = async (profile) => {
    setUpdatingProfileId(profile.id)
    setProfilesError(null)

    try {
      const nextValue = !profile.is_blocked
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_blocked: nextValue })
        .eq('id', profile.id)

      if (updateError) throw updateError

      await loadProfiles()
      window.alert('Статус пользователя обновлен')
    } catch (error) {
      setProfilesError(error.message)
      window.alert(`Не удалось обновить: ${error.message}`)
    } finally {
      setUpdatingProfileId(null)
    }
  }

  const handleRoleChange = async (profileId, newRole) => {
    setUpdatingProfileId(profileId)
    setProfilesError(null)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', profileId)

    if (updateError) {
      setProfilesError(updateError.message)
      setUpdatingProfileId(null)
      return
    }

    setProfiles((prev) => prev.map((item) => (item.id === profileId ? { ...item, role: newRole } : item)))
    setUpdatingProfileId(null)
  }

  const roles = Array.from(
    new Set([...DEFAULT_ROLES, ...profiles.map((profile) => String(profile.role || '').toLowerCase()).filter(Boolean)]),
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Панель администратора</h1>
          <p className="mt-1 text-sm text-slate-600">Управление заказами и пользователями</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              activeTab === 'orders'
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Заказы
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              activeTab === 'products'
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Товары
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
              activeTab === 'users'
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Пользователи
          </button>
        </div>
      </div>

      {activeTab === 'orders' && (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => loadOrders()}
              disabled={ordersLoading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              Обновить
            </button>
          </div>

          {ordersLoading && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
              Загрузка заказов...
            </div>
          )}

          {!ordersLoading && ordersError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm">{ordersError}</div>
          )}

          {!ordersLoading && !ordersError && orders.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">Заказов нет.</div>
          )}

          {!ordersLoading && !ordersError && orders.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Имя клиента</th>
                    <th className="px-4 py-3">Телефон</th>
                    <th className="px-4 py-3 text-right">Сумма</th>
                    <th className="px-4 py-3">Статус</th>
                    <th className="px-4 py-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-3 font-mono text-xs">{order.id}</td>
                      <td className="px-4 py-3">{order.full_name || '—'}</td>
                      <td className="px-4 py-3">{order.phone || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPrice(order.total_price)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={String(order.status || 'pending').toLowerCase()}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          disabled={updatingId === order.id || deletingId === order.id}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                        >
                          {STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(order.id)}
                          disabled={deletingId === order.id || updatingId === order.id}
                          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          Удалить заказ
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'products' && (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => loadProducts()}
              disabled={productsLoading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              Обновить
            </button>
          </div>

          {productsLoading && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
              Загрузка товаров...
            </div>
          )}

          {!productsLoading && productsError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm">{productsError}</div>
          )}

          {!productsLoading && !productsError && products.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">Товаров нет.</div>
          )}

          {!productsLoading && !productsError && products.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Название</th>
                    <th className="px-4 py-3 text-right">Цена</th>
                    <th className="px-4 py-3">Продавец</th>
                    <th className="px-4 py-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td className="px-4 py-3 font-mono text-xs">{product.id}</td>
                      <td className="px-4 py-3">{product.name || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatPrice(product.price)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{product.seller_id ? String(product.seller_id).slice(0, 8) + '…' : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(product.id)}
                          disabled={deletingProductId === product.id}
                          className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'users' && (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => loadProfiles()}
              disabled={profilesLoading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              Обновить
            </button>
          </div>

          {profilesLoading && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
              Загрузка пользователей...
            </div>
          )}

          {!profilesLoading && profilesError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm">{profilesError}</div>
          )}

          {!profilesLoading && !profilesError && profiles.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
              Пользователи не найдены.
            </div>
          )}

          {!profilesLoading && !profilesError && profiles.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Роль</th>
                    <th className="px-4 py-3">Статус</th>
                    <th className="px-4 py-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {profiles.map((profile) => (
                    <tr key={profile.id}>
                      <td className="px-4 py-3">{profile.email || '—'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={String(profile.role || '').toLowerCase() || 'buyer'}
                          onChange={(e) => handleRoleChange(profile.id, e.target.value)}
                          disabled={updatingProfileId === profile.id}
                          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {profile.is_blocked ? (
                          <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                            Заблокирован
                          </span>
                        ) : (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                            Активен
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleBlocked(profile)}
                          disabled={updatingProfileId === profile.id}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          {profile.is_blocked ? 'Разблокировать' : 'Заблокировать'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Admin
