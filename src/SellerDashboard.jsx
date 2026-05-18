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
  const [imageInputKey, setImageInputKey] = useState(0)
  const [modelInputKey, setModelInputKey] = useState(0)
  const [description, setDescription] = useState('')
  const [form, setForm] = useState({
    name: '',
    price: '',
    categoryId: '',
  })

  // Генерируем временные URL для локального предпросмотра выбранных файлов
  const imagePreviewUrls = useMemo(
    () => imageFiles.map((file) => URL.createObjectURL(file)),
    [imageFiles]
  )

  // Правильная очистка Blob-ссылок из памяти браузера при размонтировании или смене файлов
  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [imagePreviewUrls])

  useEffect(() => {
    let cancelled = false

    const loadCategories = async () => {
      setCategoriesLoading(true)
      try {
        const { data, error: catError } = await supabase
          .from('categories')
          .select('*')
          .order('name', { ascending: true })

        if (catError) throw catError
        if (!cancelled) setCategories(data || [])
      } catch (err) {
        if (!cancelled) setCategoriesError(err.message || 'Ошибка загрузки категорий')
      } finally {
        if (!cancelled) setCategoriesLoading(false)
      }
    }

    loadCategories()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!form.name || !form.price || !form.categoryId || !description.trim()) {
      setError('Пожалуйста, заполните все текстовые поля и выберите категорию.')
      return
    }

    setSaving(true)
    try {
      let uploadedImageUrls = []
      let uploadedModelUrl = null

      if (imageFiles.length > 0 || modelFile) {
        setIsUploadingFile(true)
      }

      // Загрузка изображений в Storage
      if (imageFiles.length > 0) {
        setUploadMessage('Загрузка изображений...')
        for (const file of imageFiles) {
          const fileExt = file.name.split('.').pop()
          const fileName = `${Math.random()}.${fileExt}`
          const filePath = `${sellerId}/${fileName}`

          const { error: uploadError } = await supabase.storage
            .from('product-assets')
            .upload(filePath, file)

          if (uploadError) throw uploadError
          uploadedImageUrls.push(filePath)
        }
      }

      // Загрузка 3D-модели в Storage
      if (modelFile) {
        setUploadMessage('Загрузка 3D-модели...')
        const fileExt = modelFile.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${sellerId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('product-assets')
          .upload(filePath, modelFile)

        if (uploadError) throw uploadError
        uploadedModelUrl = filePath
      }

      setIsUploadingFile(false)
      setUploadMessage('')

      // Сохранение записи о товаре в базу данных
      const { error: insertError } = await supabase.from('products').insert([
        {
          name: form.name,
          price: parseFloat(form.price),
          description: description.trim(),
          category_id: form.categoryId,
          seller_id: sellerId,
          image_url: uploadedImageUrls.length > 0 ? uploadedImageUrls[0] : null,
          image_urls: uploadedImageUrls,
          model_url: uploadedModelUrl,
        },
      ])

      if (insertError) throw insertError

      setSuccess('Товар успешно добавлен!')
      setForm({ name: '', price: '', categoryId: '' })
      setDescription('')
      setImageFiles([])
      setModelFile(null)
      setImageInputKey((prev) => prev + 1)
      setModelInputKey((prev) => prev + 1)
    } catch (err) {
      setIsUploadingFile(false)
      setUploadMessage('')
      setError(err.message || 'Произошла ошибка при сохранении товара')
    } finally {
      setSaving(false)
    }
  }

  const removeImageAt = (index) => {
    setImageFiles((prev) => {
      const next = prev.filter((_, i) => i !== index)
      if (next.length === 0) {
        setImageInputKey((k) => k + 1)
      }
      return next
    })
  }

  const removeModel = () => {
    setModelFile(null)
    setModelInputKey((k) => k + 1)
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Добавить новый товар</h1>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-200">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-600 border border-green-200">{success}</div>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Название товара</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="Например: Стул деревянный"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Цена (₽)</label>
          <input
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="0"
          />
        </div>

        <div>
          <label htmlFor="product-description" className="mb-1 block text-sm font-medium text-slate-700">
            Описание товара
          </label>
          <textarea
            id="product-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={5}
            placeholder="Подробное описание: материалы, размеры, особенности…"
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Категория</label>
          <select
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            disabled={categoriesLoading}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
          >
            <option value="">Выберите категорию</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          {categoriesError && <p className="mt-1 text-xs text-red-500">{categoriesError}</p>}
        </div>

        <div className="space-y-2 pt-2">
          <label className="block text-sm font-medium text-slate-700">Загрузите изображение товара</label>
          <p className="text-xs text-slate-500">Форматы JPG, PNG. Можно выбрать несколько файлов.</p>
          <input
            key={`images-${imageInputKey}`}
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => setImageFiles(Array.from(event.target.files ?? []))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          
          {imageFiles.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-medium text-slate-600">Предпросмотр ({imageFiles.length})</p>
              <ul className="flex flex-wrap gap-2">
                {imagePreviewUrls.map((src, index) => (
                  <li
                    key={`${imageFiles[index]?.name ?? 'img'}-${imageFiles[index]?.lastModified ?? index}-${index}`}
                    className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImageAt(index)}
                      className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/75 text-xs font-bold leading-none text-white shadow-sm transition hover:bg-red-600"
                      aria-label="Удалить изображение"
                      title="Удалить"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <label className="block text-sm font-medium text-slate-700">Загрузите 3D модель</label>
          <p className="text-xs text-slate-500">Файл в формате .glb</p>
          <input
            key={`model-${modelInputKey}`}
            type="file"
            accept=".glb"
            onChange={(event) => setModelFile(event.target.files?.[0] ?? null)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />

          {modelFile && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="min-w-0 truncate text-sm text-slate-700" title={modelFile.name}>
                {modelFile.name}
              </span>
              <button
                type="button"
                onClick={removeModel}
                className="shrink-0 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100"
              >
                Удалить модель
              </button>
            </div>
          )}
        </div>

        {isUploadingFile && <p className="text-sm text-blue-700 font-medium">{uploadMessage || 'Загрузка файла...'}</p>}

        <button
          type="submit"
          disabled={saving || isUploadingFile || categoriesLoading || categories.length === 0}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : 'Создать товар'}
        </button>
      </form>
    </div>
  )
}

export default SellerDashboard