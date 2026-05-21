import { useNavigate } from 'react-router-dom'
import { useCartStore, getCartQuantity } from './cartStore'

/**
 * @param {{ product: Record<string, unknown>, session?: import('@supabase/supabase-js').Session | null, addLabel?: string, className?: string }} props
 */
function CartQuantityControl({ product, session = null, addLabel = 'В корзину', className = '' }) {
  const navigate = useNavigate()
  const items = useCartStore((state) => state.items)
  const addItem = useCartStore((state) => state.addItem)
  const decreaseQuantity = useCartStore((state) => state.decreaseQuantity)

  const productId = product?.id
  const quantity = productId != null ? getCartQuantity(items, productId) : 0
  const inCart = quantity > 0

  const requireAuth = () => {
    if (session?.user) return true
    navigate('/auth')
    return false
  }

  const handleAdd = () => {
    if (!requireAuth()) return
    addItem(product)
  }

  const handleDecrease = () => {
    if (!requireAuth()) return
    decreaseQuantity(productId)
  }

  if (productId == null) return null

  if (!inCart) {
    return (
      <button
        type="button"
        onClick={handleAdd}
        className={`w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.98] ${className}`}
      >
        {addLabel}
      </button>
    )
  }

  return (
    <div
      className={`flex w-full items-center justify-between gap-2 rounded-xl bg-blue-50 px-3 py-2 ring-1 ring-blue-100 ${className}`}
      role="group"
      aria-label="Количество в корзине"
    >
      <button
        type="button"
        onClick={handleDecrease}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-lg font-bold text-blue-700 shadow-sm transition hover:bg-blue-100 active:scale-95"
        aria-label="Уменьшить количество"
      >
        −
      </button>
      <span className="min-w-[2rem] text-center text-base font-bold tabular-nums text-blue-900">
        {quantity}
      </span>
      <button
        type="button"
        onClick={handleAdd}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-lg font-bold text-blue-700 shadow-sm transition hover:bg-blue-100 active:scale-95"
        aria-label="Увеличить количество"
      >
        +
      </button>
    </div>
  )
}

export default CartQuantityControl
