# Blocked members local review

This fixture renders the actual UnblockForm with synthetic data and an inert action that always returns a delayed error. It never connects to Steppe, Supabase or a member account.

Run the locally installed Vite with this directory's vite.config.mjs. The server binds only to 127.0.0.1:8775. Use ?lang=es&night=1 for Spanish in the dark theme.

Check collapsed initial state, keyboard expansion, required confirmation, Cancel resets the confirmation and returns focus, pending disabled buttons, focused error, retained checked confirmation, long-name wrapping and no horizontal overflow at 320px and 390px. Browser emulation is not a physical-phone check.
