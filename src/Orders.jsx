import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Package } from 'lucide-react'
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

const statusMeta = {
  pending: { label: 'В обработке', className: 'bg-amber-100 text-amber-900 ring-amber-200' },
  completed: { label: 'Выполнен', className: 'bg-emerald-100 text-emerald-900 ring-emerald-200' },
}

function StatusBadge({ status }) {
  const key = String(status || '').toLowerCase()
  const meta = statusMeta[key] ?? {
    label: status || 'Неизвестно',
    className: 'bg-slate-100 text-slate-800 ring-slate-200',
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${meta.className}`}
    >
      {meta.label}
    </span>
  )
}

function Orders({ session }) {
  const [orders, setOrders] = useState([])
  const [itemsByOrder, setItemsByOrder] = useState({})
  const [expanded, setExpanded] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const toggle = (orderId) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  const load = useCallback(async () => {
    const userId = session?.user?.id
    if (!userId) {
      setOrders([])
      setItemsByOrder({})
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const { data: orderRows, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('id', { ascending: false })

    if (ordersError) {
      setError(ordersError.message)
      setOrders([])
      setItemsByOrder({})
      setLoading(false)
      return
    }

    const list = orderRows ?? []
    setOrders(list)

    if (!list.length) {
      setItemsByOrder({})
      setLoading(false)
      return
    }

    const orderIds = list.map((o) => o.id).filter(Boolean)

    const { data: itemRows, error: itemsError } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, quantity, price_at_time')
      .in('order_id', orderIds)

    if (itemsError) {
      setError(itemsError.message)
      setItemsByOrder({})
      setLoading(false)
      return
    }

    const rows = itemRows ?? []
    const productIds = [...new Set(rows.map((r) => r.product_id).filter(Boolean))]

    let productsById = {}
    if (productIds.length) {
      const { data: productRows, error: productsError } = await supabase
        .from('products')
        .select('id, name, price')
        .in('id', productIds)

      if (productsError) {
        setError(productsError.message)
        setItemsByOrder({})
        setLoading(false)
        return
      }

      productsById = Object.fromEntries((productRows ?? []).map((p) => [p.id, p]))
    }

    const grouped = {}
    for (const row of rows) {
      const oid = row.order_id
      if (!grouped[oid]) grouped[oid] = []
      grouped[oid].push({
        ...row,
        products: row.product_id ? productsById[row.product_id] ?? null : null,
      })
    }

    setItemsByOrder(grouped)
    setLoading(false)
  }, [session?.user?.id])

  useEffect(() => {
    load()
  }, [load])

  if (!session?.user?.id) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
        Войдите в аккаунт, чтобы видеть заказы.
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Мои заказы</h1>
          <p className="mt-1 text-sm text-slate-600">История и состав каждого заказа</p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
        >
          Обновить
        </button>
      </div>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          Загрузка заказов…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm">{error}</div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
          <Package className="mb-3 h-12 w-12 text-slate-400" aria-hidden />
          <p className="text-slate-700">Пока нет заказов</p>
          <p className="mt-1 text-sm text-slate-500">Оформите покупку в корзине — заказ появится здесь</p>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <ul className="space-y-4">
          {orders.map((order) => {
            const id = order.id
            const isOpen = expanded.has(id)
            const items = itemsByOrder[id] ?? []
            const created = order.created_at
              ? new Date(order.created_at).toLocaleString('ru-RU')
              : order.id
                ? `№ ${order.id}`
                : null

            return (
              <li
                key={id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50/80"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">Заказ #{String(id).slice(0, 8)}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                      {created && <span>{created}</span>}
                      <span className="font-medium text-slate-800">{formatPrice(order.total_price)}</span>
                      <span className="text-slate-500">
                        {items.length} {items.length === 1 ? 'позиция' : items.length < 5 ? 'позиции' : 'позиций'}
                      </span>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                    {(order.full_name || order.email || order.phone || order.address) && (
                      <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
                        {order.full_name && (
                          <>
                            <dt className="text-slate-500">Имя</dt>
                            <dd className="font-medium text-slate-800">{order.full_name}</dd>
                          </>
                        )}
                        {order.email && (
                          <>
                            <dt className="text-slate-500">Email</dt>
                            <dd className="font-medium text-slate-800">{order.email}</dd>
                          </>
                        )}
                        {order.phone && (
                          <>
                            <dt className="text-slate-500">Телефон</dt>
                            <dd className="font-medium text-slate-800">{order.phone}</dd>
                          </>
                        )}
                        {order.address && (
                          <>
                            <dt className="text-slate-500">Адрес</dt>
                            <dd className="font-medium text-slate-800 sm:col-span-1">{order.address}</dd>
                          </>
                        )}
                      </dl>
                    )}

                    {items.length === 0 ? (
                      <p className="text-sm text-slate-600">Товары не найдены для этого заказа.</p>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-4 py-3">Товар</th>
                              <th className="px-4 py-3 text-right">Цена</th>
                              <th className="px-4 py-3 text-right">Кол-во</th>
                              <th className="px-4 py-3 text-right">Сумма</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {items.map((row) => {
                              const product = row.products
                              const name =
                                product?.name ?? (row.product_id ? `Товар #${row.product_id}` : 'Товар')
                              const unit = row.price_at_time ?? product?.price
                              const qty = Number(row.quantity) || 0
                              const line = (Number(unit) || 0) * qty

                              return (
                                <tr key={row.id ?? `${row.order_id}-${row.product_id}`} className="text-slate-800">
                                  <td className="px-4 py-3 font-medium">{name}</td>
                                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                                    {formatPrice(unit)}
                                  </td>
                                  <td className="px-4 py-3 text-right tabular-nums">{qty}</td>
                                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatPrice(line)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default Orders
