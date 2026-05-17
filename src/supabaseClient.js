import { createClient } from '@supabase/supabase-js'

const supabaseUrlEnv = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrlEnv || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment.')
}

// Если код выполняется в браузере НА СЕРВЕРЕ VERCEL (в продакшене), 
// мы подменяем URL на относительный путь /supabase, чтобы включить прокси.
// Во всех остальных случаях (локально на localhost или при сборке) используем оригинальный URL.
const supabaseUrl = typeof window !== 'undefined' && !window.location.hostname.includes('localhost')
  ? `${window.location.origin}/supabase`
  : supabaseUrlEnv

export const supabase = createClient(supabaseUrl, supabaseAnonKey)