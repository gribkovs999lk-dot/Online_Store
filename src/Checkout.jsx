import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { useCartStore } from './cartStore'

function Checkout() {
  const navigate = useNavigate()
  const items = useCartStore((state) => state.items ?? [])
  const clearCartAction = useCartStore((state) => state.clearCart)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (Number(item.price) || 0), 0)
  }, [items])

  const clearCart = () => {
    if (typeof clearCartAction === 'function') {
      clearCartAction()
      return
    }

    useCartStore.setState({ items: [] })
  }

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

      // 1. Создаем основную запись в таблице orders
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

      // 2. Если заказ создан, берем его ID
      if (orderData) {
        const orderId = orderData.id

        // Готовим список товаров для вставки
        const itemsToInsert = items.map((item) => ({
          order_id: orderId,
          product_id: item.id,
          quantity: 1,
          price_at_time: item.price,
        }))

        // 3. Записываем товары в order_items
        const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert)

        if (itemsError) {
          console.error('Ошибка при сохранении товаров:', itemsError)
          throw itemsError
        } else {
          clearCart()
          setName('')
          setEmail('')
          setPhone('')
          setAddress('')
          setMessage('Заказ успешно оформлен!')
          alert('Заказ успешно оформлен!')
          navigate('/orders')
        }
      }
    } catch (submitError) {
      console.error('Ошибка при оформлении:', submitError)
      const messageText = submitError?.message || 'Произошла ошибка при оформлении.'
      setError(messageText)
      alert(`Произошла ошибка: ${messageText}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-2xl font-semibold text-slate-900">Оформление заказа</h2>

      <div className="mb-6 rounded-lg bg-slate-50 p-4 text-slate-700">
        <p className="text-sm">Товаров в корзине: {items.length}</p>
        <p className="mt-1 text-lg font-semibold">
          Итого: {new Intl.NumberFormat('ru-RU').format(totalAmount)} ₽
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Имя"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
        />

        <input
          type="tel"
          placeholder="Телефон"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
        />

        <input
          type="text"
          placeholder="Адрес"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
        />

        <button
          type="submit"
          disabled={isSubmitting || !items.length}
          className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting ? 'Отправка...' : 'Оплатить'}
        </button>
      </form>

      {message && <p className="mt-4 text-green-600">{message}</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}
    </section>
  )
}

export default Checkout
