# TEMPLATE — Stage 2, do not deploy before its gate (see docker-compose.yml).
# Builds the Next.js app as a standalone container. Two ONE-LINE prerequisites in
# steppe/next.config.ts, made AT Stage 2 (deliberately not before — they are the
# portability audit's two standalone blockers, docs/portability-audit.md):
#   1. output: "standalone"
#   2. outputFileTracingIncludes: { "/legal/privacy": ["./content/**"] }
#      (app/(site)/legal/privacy reads content/legal/privacy.md at runtime with
#       fs; without this the file is missing from the standalone bundle → ENOENT)

FROM node:26-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* inline into the client bundle at build time.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Standalone output omits public/ and .next/static — copy them beside server.js.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
