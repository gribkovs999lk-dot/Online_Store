import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCartStore = create(
  persist(
    (set) => ({
      items: [],
      addToCart: (product) =>
        set((state) => ({
          items: [...state.items, product],
        })),
      removeOneFromCart: (id) =>
        set((state) => {
          const index = state.items.findIndex((item) => String(item.id) === String(id))
          if (index === -1) return state
          const items = [...state.items]
          items.splice(index, 1)
          return { items }
        }),
      removeFromCart: (id) =>
        set((state) => ({
          items: state.items.filter((item) => String(item.id) !== String(id)),
        })),
      clearCart: () => set({ items: [] }),
    }),
    { name: 'cart-storage' }
  )
)

export function getCartQuantity(items, productId) {
  return items.filter((item) => String(item.id) === String(productId)).length
}
