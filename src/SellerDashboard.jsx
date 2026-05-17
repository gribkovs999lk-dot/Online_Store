import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

function SellerDashboard({ session }) {
  const sellerId = session?.user?.id
  const [categories, setCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState('')
  const [saving, setSaving] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [imageFiles, setImageFiles] = useState([])
  const [modelFile, setModelFile] = useState(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [form, setForm] = useState({
    name: '',
    price: '',
    categoryId: '',
  })

  const imagePreviewUrls = useMemo(
    () => imageFiles.map((file) => URL.createObjectURL(file)),
    [imageFiles]
  )

  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [imagePreviewUrls])

  useEffect(() => {
    let cancelled = false

    const loadCategories = async () => {
      setCategoriesLoading(true)
      setCategoriesError('')

      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('id, name')
        .order('name', { ascending: true })

      if (cancelled) return

      if (fetchError) {
        setCategoriesError(fetchError.message)
        setCategories([])
      } else {
        setCategories(data ?? [])
      }

      setCategoriesLoading(false)
    }

    loadCategories()

    return () => {
      cancelled = true
    }
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const uploadFile = async (file, folder) => {
    if (!file) return null

    const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const filePath = `${sellerId}/${folder}/${safeName}`

    const { error: uploadError } = await supabase.storage.from('product-assets').upload(filePath, file, {
      upsert: false,
    })

    if (uploadError) {
      throw uploadError
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('product-assets').getPublicUrl(filePath)
  
    // Переписываем ссылку: если мы в браузере, всегда пускаем запрос через текущий домен /supabase
    if (typeof window !== 'undefined') {
      return publicUrl.replace('https://yzwfkcwqtakglfzkoccy.supabase.co', `${window.location.origin}/supabase`)
    }
  
    return publicUrl
    }

  const handleCreateProduct = async (event) => {
    event.preventDefault()
    setSuccess('')
    setError('')

    if (!sellerId) {
      setError('Не удалось определить продавца из сессии.')
      return
    }

    const priceValue = Number(form.price)
    const categoryIdNum = Number(form.categoryId)

    if (!form.name.trim() || Number.isNaN(priceValue) || priceValue < 0) {
      setError('Укажите название и корректную цену товара.')
      return
    }

    if (!form.categoryId || Number.isNaN(categoryIdNum)) {
      setError('Выберите категорию товара.')
      return
    }

    setSaving(true)

    try {
      setIsUploadingFile(true)

      const imageUrls = []
      for (let i = 0; i < imageFiles.length; i++) {
        setUploadMessage(`Загрузка изображений… (${i + 1}/${imageFiles.length})`)
        const url = await uploadFile(imageFiles[i], 'images')
        if (url) imageUrls.push(url)
      }

      setUploadMessage('Загрузка файла… (3D модель)')
      const modelUrl = await uploadFile(modelFile, 'models')

      setUploadMessage('')
      setIsUploadingFile(false)

      const payload = {
        name: form.name.trim(),
        price: priceValue,
        image_urls: imageUrls,
        model_url: modelUrl,
        seller_id: sellerId,
        category_id: categoryIdNum,
      }

      const { error: insertError } = await supabase.from('products').insert([payload]).select().single()

      if (insertError) {
        setError(insertError.message)
        setSaving(false)
        return
      }

      setForm({ name: '', price: '', categoryId: '' })
      setImageFiles([])
      setModelFile(null)
      setFileInputKey((prev) => prev + 1)
      setSuccess('Товар добавлен.')
      setSaving(false)
    } catch (submitError) {
      setError(submitError.message || 'Не удалось загрузить файлы.')
      setIsUploadingFile(false)
      setUploadMessage('')
      setSaving(false)
    }
  }

  if (!sellerId) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
        Войдите как продавец, чтобы открыть панель.
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Панель продавца</h1>
        <p className="mt-1 text-sm text-slate-600">Добавление нового товара и загрузка файлов.</p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{success}</div>}
      {categoriesError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
          Не удалось загрузить категории: {categoriesError}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Добавить товар</h2>
        <form onSubmit={handleCreateProduct} className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Категория
            <select
              name="categoryId"
              value={form.categoryId}
              onChange={handleChange}
              required
              disabled={categoriesLoading || categories.length === 0}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">
                {categoriesLoading ? 'Загрузка категорий…' : categories.length === 0 ? 'Нет категорий' : 'Выберите категорию'}
              </option>
              {categories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>
                  {cat.name ?? `Категория #${cat.id}`}
                </option>
              ))}
            </select>
          </label>
          <input
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            placeholder="Название"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <input
            name="price"
            type="number"
            min="0"
            step="1"
            value={form.price}
            onChange={handleChange}
            placeholder="Цена"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />

          <label className="block text-sm font-medium text-slate-700">
            Изображения (можно несколько)
            <input
              key={`image-${fileInputKey}`}
              type="file"
              accept=".jpg,.jpeg,.png"
              multiple
              onChange={(event) => {
                const list = event.target.files
                setImageFiles(list ? Array.from(list) : [])
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-slate-700"
            />
          </label>
          {imagePreviewUrls.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-medium text-slate-600">Предпросмотр</p>
              <ul className="flex flex-wrap gap-2">
                {imagePreviewUrls.map((src, index) => (
                  <li key={`${src}-${index}`} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <input
            key={`model-${fileInputKey}`}
            type="file"
            accept=".glb"
            onChange={(event) => setModelFile(event.target.files?.[0] ?? null)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          {isUploadingFile && <p className="text-sm text-blue-700">{uploadMessage || 'Загрузка файла...'}</p>}
          <button
            type="submit"
            disabled={saving || isUploadingFile || categoriesLoading || categories.length === 0}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving || isUploadingFile ? 'Сохранение...' : 'Добавить товар'}
          </button>
        </form>
      </section>
    </div>
  )
}

export default SellerDashboard
