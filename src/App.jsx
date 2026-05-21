import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useCartStore, getCartTotalCount } from './cartStore'
import { Routes, Route, Link, Navigate } from 'react-router-dom'
import Checkout from './Checkout'
import Auth from './Auth'
import Orders from './Orders'
import Admin from './Admin'
import SellerDashboard from './SellerDashboard'
import SellerProducts from './SellerProducts'
import ProductCard from './ProductCard'
import ProductPage from './ProductPage'

function App() {
  const [session, setSession] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [accountBlockedNotice, setAccountBlockedNotice] = useState(false)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(true)
  const [error, setError] = useState(null)
  const cartItems = useCartStore((state) => state.items)
  const clearCart = useCartStore((state) => state.clearCart)
  const cartCount = getCartTotalCount(cartItems)

  const fetchRole = async (userId) => {
    const { data } = await supabase.from('profiles').select('role, is_blocked').eq('id', userId).single()

    if (data?.is_blocked === true) {
      setAccountBlockedNotice(true)
      setUserRole(null)
      clearCart()
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (data) setUserRole(data.role)
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession)
      if (currentSession) {
        fetchRole(currentSession.user.id)
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      if (currentSession) {
        fetchRole(currentSession.user.id)
      } else {
        clearCart()
        setUserRole(null)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const loadProducts = async () => {
      setProductsLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase.from('products')
      .select('*')
      .eq('is_deleted', false)

      if (fetchError) {
        setError(fetchError.message)
        setProducts([])
      } else {
        setProducts(data ?? [])
      }

      setProductsLoading(false)
    }

    loadProducts()
  }, [])

  if (accountBlockedNotice) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-slate-900 px-6 text-center">
        <p className="max-w-md text-lg font-medium text-white">
          Ваш аккаунт заблокирован. Обратитесь в службу поддержки.
        </p>
      </div>
    )
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Загрузка...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          {/* Логотип */}
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 font-bold text-white">
              D
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">3d-Store</span>
          </Link>

          {/* Центральное меню (для всех) */}
          <div className="hidden gap-6 text-sm font-medium text-gray-600 md:flex">
            <Link to="/" className="transition hover:text-blue-600">
              Каталог
            </Link>
            <Link to="/about" className="transition hover:text-blue-600">
              О проекте
            </Link>
          </div>

          {/* Правая часть: Профиль и Корзина */}
          <div className="flex items-center gap-4">
            {session ? (
              <>
                {/* Почта сессии */}
                <div className="hidden max-w-[14rem] items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 sm:flex">
                  <span aria-hidden="true">👤</span>
                  <span className="truncate" title={session.user.email}>
                    {session.user.email}
                  </span>
                </div>

                {/* Кнопки панелей (только если админ/продавец) */}
                {userRole === 'admin' && (
                  <Link
                    to="/admin"
                    className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                  >
                    Админ
                  </Link>
                )}
                {userRole === 'seller' && (
                  <Link
                    to="/seller"
                    className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600 transition hover:bg-green-100"
                  >
                    Продавец
                  </Link>
                )}

                <Link
                  to="/orders"
                  className="whitespace-nowrap rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-blue-200 hover:text-blue-600"
                >
                  Мои заказы
                </Link>
                {(userRole === 'seller' || userRole === 'admin') && (
                  <Link
                    to="/seller/my-products"
                    className="whitespace-nowrap rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-blue-200 hover:text-blue-600"
                  >
                    Мои товары
                  </Link>
                )}

                {/* Иконка корзины (для покупателей и продавцов) */}
                <Link
                  to="/cart"
                  className="relative rounded-full p-2 text-gray-600 transition hover:bg-gray-50"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                  <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">
                    {cartCount}
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={async () => {
                    clearCart()
                    await supabase.auth.signOut()
                  }}
                  className="text-sm font-semibold text-gray-700 transition hover:text-red-600"
                >
                  Выйти
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Войти
              </Link>
            )}
          </div>
        </div>
      </nav>

      <Routes>
        <Route
          path="/"
          element={
            <div className="container mx-auto p-4">
              <h1 className="mb-6 text-3xl font-bold text-slate-900">Каталог товаров</h1>

              {productsLoading && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
                  Загрузка товаров...
                </div>
              )}

              {error && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 shadow-sm">
                  Ошибка загрузки: {error}
                </div>
              )}

              {!productsLoading && !error && products.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
                  Товары не найдены.
                </div>
              )}

              {!productsLoading && !error && products.length > 0 && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  {products.map((product) => (
                    <ProductCard
                      key={product.id ?? product.name}
                      product={product}
                      session={session}
                      isAdmin={userRole === 'admin'}
                      onProductDeleted={(id) =>
                        setProducts((prev) => prev.filter((p) => String(p.id) !== String(id)))
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          }
        />
        <Route path="/cart" element={session ? <Checkout /> : <Navigate to="/auth" replace />} />
        <Route
          path="/orders"
          element={
            session ? (
              <div className="container mx-auto p-4">
                <Orders session={session} />
              </div>
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
        <Route
          path="/admin"
          element={userRole === 'admin' ? <Admin /> : <Navigate to="/" />}
        />

        {/* Страница управления товарами (добавление) */}
        <Route path="/seller/dashboard" element={<SellerDashboard session={session} />} />

        {/* Страница статистики продаж (кто купил мои товары) */}
        <Route path="/seller/my-products" element={<SellerProducts session={session} />} />

        <Route path="/seller" element={<Navigate to="/seller/dashboard" replace />} />

        <Route
          path="/about"
          element={
            <div className="container mx-auto max-w-2xl px-4 py-12">
              <h1 className="text-3xl font-bold text-gray-900">О проекте</h1>
              <p className="mt-4 text-gray-600">
                Dimension — каталог 3D-товаров с удобной корзиной и заказами.
              </p>
            </div>
          }
        />

        <Route path="/auth" element={<Auth />} />
        <Route path="/product/:id" element={<ProductPage />} />
      </Routes>
    </div>
  )
}

export default App
