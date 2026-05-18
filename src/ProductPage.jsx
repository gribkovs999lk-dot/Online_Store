import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom';
import { supabase } from './supabaseClient'

const ProductPage = () => {
  const { id } = useParams(); // Получаем id товара из URL-адреса
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProductDetails = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('is_deleted', false)
        .maybeSingle()

      if (error) {
        console.error('Ошибка загрузки товара:', error)
        setProduct(null)
      } else {
        setProduct(data)
      }
      setLoading(false);
    };

    fetchProductDetails();
  }, [id]);

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Загрузка товара...</div>;
  if (!product) {
    return (
      <div className="container mx-auto space-y-4 p-8 text-center">
        <p className="text-slate-700">Товар не найден</p>
        <Link to="/" className="text-blue-600 hover:underline">
          ← Назад в каталог
        </Link>
      </div>
    )
  }

  const price = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(Number(product.price) || 0)

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <Link to="/" className="inline-block text-sm font-medium text-blue-600 hover:underline">
        ← Назад в каталог
      </Link>

      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-6 md:min-h-[420px]">
        <p className="text-center text-slate-600">3D-модель: {product.name}</p>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>
        <p className="mt-2 text-2xl font-bold text-blue-600">{price}</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Описание</h2>
        <p className="mt-2 whitespace-pre-wrap leading-relaxed text-slate-600">
          {product.description || 'Описание отсутствует.'}
        </p>
      </section>
    </div>
  )
}

export default ProductPage