import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Minus, Plus } from 'lucide-react'
import { supabase } from './supabaseClient'
import { useCartStore } from './cartStore'
import { getProductAssetUrl } from './productAssets'

function resolveCartImageSrc(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return ''
  if (imageUrl.startsWith('http')) return imageUrl
  return getProductAssetUrl(imageUrl)
}

function formatPrice(price) {
  const numericPrice = Number(price)
  if (Number.isNaN(numericPrice)) return '—'
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(numericPrice)
}

function Checkout() {
  const navigate = useNavigate()
  const items = useCartStore((state) => state.items ?? [])
  const addItem = useCartStore((state) => state.addItem)
  const decreaseQuantity = useCartStore((state) => state.decreaseQuantity)
  const removeItem = useCartStore((state) => state.removeItem)
  const clearCart = useCartStore((state) => state.clearCart)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const totalAmount = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (item.quantity || 1),
      0
    )
  }, [items])

  const totalCount = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.quantity || 1), 0)
  }, [items])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setMessage('')
    setError('')
    setIsSubmitting(true)

    try {
      if (!items.length) {
        throw new Error('Корзина пуста.')
      }

      const normalizedPhone = phone.replace(/[^\d+]/g, '')
      if (!normalizedPhone) {
        throw new Error('Введите корректный номер телефона.')
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) throw sessionError
      if (!session?.user?.id) {
        throw new Error('Не удалось определить пользователя из сессии.')
      }

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            user_id: session.user.id,
            full_name: name.trim(),
            email: email.trim(),
            phone: normalizedPhone,
            address: address.trim() || 'Самовывоз',
            total_price: totalAmount,
            status: 'pending',
          },
        ])
        .select()
        .single()

      if (orderError) {
        console.error('Ошибка при создании заказа:', orderError)
        throw orderError
      }

      if (orderData) {
        const orderId = orderData.id

        const itemsToInsert = items.map((item) => ({
          order_id: orderId,
          product_id: item.id,
          quantity: item.quantity || 1,
          price_at_time: item.price,
        }))

        const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert)

        if (itemsError) {
          console.error('Ошибка при сохранении товаров:', itemsError)
          throw itemsError
        }

        clearCart()
        setName('')
        setEmail('')
        setPhone('')
        setAddress('')
        setMessage('Заказ успешно оформлен!')
        navigate('/orders')
      }
    } catch (submitError) {
      console.error('Ошибка при оформлении:', submitError)
      const messageText = submitError?.message || 'Произошла ошибка при оформлении.'
      setError(messageText)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 md:py-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Оформление заказа</h2>
          {items.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
            >
              Очистить корзину
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-6 text-center text-slate-600">Корзина пуста.</p>
        ) : (
          <ul className="mb-6 space-y-3">
            {items.map((item) => {
              const imageSrc = resolveCartImageSrc(item.image_url)

              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 transition hover:border-slate-300 sm:flex-row sm:items-center sm:gap-4 sm:p-4"
                >
                  <div className="flex shrink-0 items-center gap-3 sm:block">
                    <div className="h-20 w-20 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-slate-200/80 sm:h-24 sm:w-24">
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={item.name ?? 'Товар'}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                          Нет фото
                        </div>
                      )}
                    </div>
                    <p className="min-w-0 flex-1 font-medium text-slate-900 sm:hidden">
                      {item.name ?? 'Без названия'}
                    </p>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="hidden font-medium text-slate-900 sm:block">
                      {item.name ?? 'Без названия'}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-blue-600 sm:mt-1">
                      {formatPrice(item.price)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="flex items-center gap-1 rounded-lg bg-white px-1 py-1 shadow-sm ring-1 ring-slate-200">
                      <button
                        type="button"
                        onClick={() => decreaseQuantity(item.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-700 transition hover:bg-slate-100"
                        aria-label="Уменьшить количество"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-[2rem] text-center text-sm font-bold tabular-nums text-slate-900">
                        {item.quantity || 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => addItem(item)}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-slate-700 transition hover:bg-slate-100"
                        aria-label="Увеличить количество"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
                      aria-label="Удалить товар"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <div className="mb-6 rounded-lg bg-slate-50 p-4 text-slate-700">
          <p className="text-sm">Позиций: {items.length}</p>
          <p className="text-sm">Всего единиц: {totalCount}</p>
          <p className="mt-1 text-lg font-semibold">Итого: {formatPrice(totalAmount)}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Имя"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />

          <input
            type="tel"
            placeholder="Телефон"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />

          <input
            type="text"
            placeholder="Адрес"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />

          <button
            type="submit"
            disabled={isSubmitting || !items.length}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSubmitting ? 'Отправка...' : 'Оплатить'}
          </button>
        </form>

        {message && <p className="mt-4 text-green-600">{message}</p>}
        {error && <p className="mt-4 text-red-600">{error}</p>}
      </section>
    </div>
  )
}

export default Checkout
