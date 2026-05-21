import { create } from 'zustand'
import { persist } from 'zustand/middleware'

function buildCartItem(product) {
  return {
    id: product.id,
    name: product.name ?? 'Без названия',
    price: product.price,
    quantity: 1,
    image_url: product.image_urls?.[0] || product.image_url || '',
  }
}

export const useCartStore = create(
  persist(
    (set) => ({
      items: [],

      addItem: (product) =>
        set((state) => {
          const productId = product?.id
          if (productId == null) return state

          const existing = state.items.find((item) => String(item.id) === String(productId))

          if (existing) {
            return {
              items: state.items.map((item) =>
                String(item.id) === String(productId)
                  ? { ...item, quantity: (item.quantity || 1) + 1 }
                  : item
              ),
            }
          }

          return {
            items: [...state.items, buildCartItem(product)],
          }
        }),

      decreaseQuantity: (productId) =>
        set((state) => {
          const existing = state.items.find((item) => String(item.id) === String(productId))
          if (!existing) return state

          const currentQty = existing.quantity || 1
          if (currentQty <= 1) {
            return {
              items: state.items.filter((item) => String(item.id) !== String(productId)),
            }
          }

          return {
            items: state.items.map((item) =>
              String(item.id) === String(productId)
                ? { ...item, quantity: currentQty - 1 }
                : item
            ),
          }
        }),

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((item) => String(item.id) !== String(productId)),
        })),

      clearCart: () => set({ items: [] }),
    }),
    { name: 'cart-storage' }
  )
)

export function getCartQuantity(items, productId) {
  const item = items.find((cartItem) => String(cartItem.id) === String(productId))
  return item?.quantity ?? 0
}

export function getCartTotalCount(items) {
  return items.reduce((sum, item) => sum + (item.quantity || 1), 0)
}
