import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { useCartStore } from './cartStore'
import { Routes, Route, Link, Navigate } from 'react-router-dom'
import Checkout from './Checkout'
import Auth from './Auth'
import Orders from './Orders'
import Admin from './Admin'
import SellerDashboard from './SellerDashboard'

function App() {
  const [session, setSession] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(true)
  const [error, setError] = useState(null)
  const addToCart = useCartStore((state) => state.addToCart)
  const cartItems = useCartStore((state) => state.items)

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
        setUserRole(null)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function fetchRole(userId) {
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()

    if (data) setUserRole(data.role)
    setLoading(false)
  }

  useEffect(() => {
    const loadProducts = async () => {
      setProductsLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase.from('products').select('*')

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

  const formatPrice = (price) => {
    const numericPrice = Number(price)

    if (Number.isNaN(numericPrice)) {
      return 'Цена не указана'
    }

    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(numericPrice)
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Загрузка...</div>
  }


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка сайта */}
      <nav className="sticky top-0 z-50 bg-white p-4 shadow-sm">
        <div className="container mx-auto flex items-center justify-between">
          <Link to="/" className="text-xl font-bold">
            3D Store
          </Link>
          <div className="flex items-center gap-3">
            {session ? (
              <>
                <div className="hidden items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 sm:flex">
                  <span aria-hidden="true">👤</span>
                  <span className="max-w-48 truncate">{session.user.email}</span>
                </div>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="rounded-lg border border-red-200 px-4 py-2 text-red-600"
                >
                  Выйти
                </button>
              </>
            ) : (
              <Link to="/auth" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">
                Вход
              </Link>
            )}
            {session && (
              <Link
                to="/orders"
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 transition hover:text-blue-500"
              >
                Мои заказы
              </Link>
            )}
            {(userRole === 'seller' || userRole === 'admin') && (
              <Link to="/my-products" className="text-blue-600">
                Мои товары
              </Link>
            )}
            {userRole === 'admin' && (
              <Link to="/admin" className="text-red-600 font-bold">
                Панель управления (Admin)
              </Link>
            )}
            {userRole === 'seller' && (
              <Link to="/seller" className="font-bold text-green-600 hover:underline">
                Панель продавца
              </Link>
            )}
            <Link to="/cart" className="rounded-lg bg-blue-600 px-4 py-2 text-white">
              Корзина ({cartItems.length})
            </Link>
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
                <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  {products.map((product) => {
                    const modelSrc = product.model_url ?? product.modelUrl ?? product.model_3d_url ?? ''

                    return (
                      <article
                        key={product.id ?? product.name}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                      >
                        <div className="h-64 w-full bg-slate-100">
                          {modelSrc ? (
                            <model-viewer
                              src={modelSrc}
                              alt={product.name ?? '3D модель товара'}
                              camera-controls
                              auto-rotate
                              class="h-full w-full"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-500">
                              3D-модель отсутствует
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 p-5">
                          <h2 className="line-clamp-2 text-lg font-semibold text-slate-900">
                            {product.name ?? 'Без названия'}
                          </h2>
                          <p className="text-base font-medium text-slate-700">
                            {formatPrice(product.price)}
                          </p>
                          <button
                            onClick={() => addToCart(product)}
                            className="mt-4 w-full rounded-lg bg-blue-600 py-2 text-white"
                          >
                            Добавить в корзину ({cartItems.filter((i) => i.id === product.id).length})
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </section>
              )}
            </div>
          }
        />
        <Route path="/cart" element={session ? <Checkout session={session} /> : <Navigate to="/auth" replace />} />
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
        <Route
          path="/seller"
          element={userRole === 'seller' ? <SellerDashboard /> : <Navigate to="/" />}
        />
        <Route
          path="/my-products"
          element={
            session ? (
              userRole === 'seller' || userRole === 'admin' ? (
                <div className="container mx-auto p-4">
                  <SellerDashboard session={session} />
                </div>
              ) : (
                <Navigate to="/" replace />
              )
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </div>
  )

  
}

export default App
