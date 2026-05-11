import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCartStore = create(
  persist(
    (set) => ({
      items: [],
      addToCart: (product) => set((state) => ({ 
        items: [...state.items, product] 
      })),
      removeFromCart: (id) => set((state) => ({ 
        items: state.items.filter((i) => i.id !== id) 
      })),
      clearCart: () => set({ items: [] }),
    }),
    { name: 'cart-storage' }
  )
)