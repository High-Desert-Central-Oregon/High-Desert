// scripts/login-link.mjs
// Local dev sign-in: mint a magic link and click it (before Resend email is wired).
//   node --env-file=.env.local scripts/login-link.mjs you@example.com
// Base URL defaults to the dev server's port (`next dev -p 3100`); pass a second
// arg to override, e.g. http://localhost:3000 for `next start`.
import { createClient } from '@supabase/supabase-js'
const [, , email, base = 'http://localhost:3100'] = process.argv
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
const { data, error } = await supabase.auth.admin.generateLink({ type: 'magiclink', email })
if (error) { console.error(error); process.exit(1) }
console.log(`${base}/auth/confirm?token_hash=${data.properties.hashed_token}&type=email`)