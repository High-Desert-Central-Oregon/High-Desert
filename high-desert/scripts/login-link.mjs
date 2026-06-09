// scripts/login-link.mjs
// node --env-file=.env.local scripts/login-link.mjs you@example.com http://localhost:3001
import { createClient } from '@supabase/supabase-js'
const [, , email, base = 'http://localhost:3000'] = process.argv
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
const { data, error } = await supabase.auth.admin.generateLink({ type: 'magiclink', email })
if (error) { console.error(error); process.exit(1) }
console.log(`${base}/auth/confirm?token_hash=${data.properties.hashed_token}&type=email`)