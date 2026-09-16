# Browser health and deploy tracking

Steppe sends anonymous production browser sessions and sanitized exceptions to its own Sentry project. Configure `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, and build-only `SENTRY_AUTH_TOKEN` through the existing-account Vercel integration. The full `VERCEL_GIT_COMMIT_SHA` is the SDK/source-map/release identifier; local and preview sessions are disabled.

No user identity, current route, query parameters, request contents, error text, breadcrumbs, replay, logs, metrics, or performance traces are sent. A session is a page load/navigation with anonymous health counters, not a recorded user journey. The SDK disables IP inference; a session hook removes identifiers, IPs, and user-agent strings. Exceptions keep only standard error categories, handled status, and public compiled code positions. Source maps upload privately and are removed from the browser build.

`.github/workflows/sentry-deploy.yml` runs on the GitHub deployment mirror after a successful Vercel production deployment. The repository secret `SENTRY_AUTH_TOKEN` records the deployment against the full SHA. The workflow accepts only Vercel-created deployment/status events, checks out no code, and deduplicates by deployment ID. Failed builds and previews never count as production deploys. Update the secret if the integration token is rotated.

Verify with `npm run test:bug-reports`, `npm run lint`, and an isolated production build in `steppe/`. After merge, verify the exact production SHA, source-map upload, successful deployment workflow, and a normal browser session in Sentry. The bug-report intake enablement switch remains a separate operation.
