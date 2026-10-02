# Contact Steppe local review

Run `npx vite --config tests/fixtures/contact-steppe/vite.config.mjs` from the
nested app. The actual ContactForm and MessageForm render with inert actions.
`?lang=es` renders Spanish; `?night=1` selects night colors;
`?failure=thrown` simulates a thrown transport error.
Check 320/390px layout, pending input lock, retained draft, error focus, and Tab
recovery. This fixture never contacts Supabase or sends anything, and is not
evidence of hosted message delivery. Screenshots belong in steppe-private.
