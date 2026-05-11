import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

const app = express()
const port = Number(process.env.API_PORT || 8787)

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
}

const adminClient = createClient(supabaseUrl, serviceRoleKey)
const authClient = createClient(supabaseUrl, anonKey || serviceRoleKey)

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true })
})

app.post('/api/orders', async (req, res) => {
  const authHeader = req.header('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null

  if (!token) {
    res.status(401).json({ error: 'Missing bearer token.' })
    return
  }

  const { data: userData, error: userError } = await authClient.auth.getUser(token)

  if (userError || !userData?.user?.id) {
    res.status(401).json({ error: 'Invalid user session token.' })
    return
  }

  const { full_name, email, phone, address, total_price } = req.body ?? {}

  if (!full_name || !email || !phone || total_price == null) {
    res.status(400).json({ error: 'Missing required order fields.' })
    return
  }

  const orderPayload = {
    user_id: userData.user.id,
    full_name: String(full_name).trim(),
    email: String(email).trim(),
    phone: String(phone).trim(),
    address: address ? String(address).trim() : null,
    total_price: Number(total_price),
  }

  if (!Number.isFinite(orderPayload.total_price) || orderPayload.total_price < 0) {
    res.status(400).json({ error: 'Invalid total_price value.' })
    return
  }

  const { error: insertError } = await adminClient.from('orders').insert(orderPayload)

  if (insertError) {
    res.status(400).json({ error: insertError.message })
    return
  }

  res.status(201).json({ ok: true })
})

app.listen(port, () => {
  console.log(`Orders API listening on port ${port}`)
})
