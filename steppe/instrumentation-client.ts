import * as Sentry from "@sentry/nextjs";
import { sanitizeError, sanitizeSession } from "@/lib/sentry-privacy";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const release = process.env.NEXT_PUBLIC_SENTRY_RELEASE;
const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT;

// Production browser health only. No identity binding, behavior timeline,
// replay, logs, tracing, server instrumentation or local/preview traffic.
if (dsn && release && environment === "production") {
  const client = Sentry.init({
    dsn, release, environment,
    defaultIntegrations: false,
    integrations: [Sentry.globalHandlersIntegration(), Sentry.browserSessionIntegration()],
    sampleRate: 1,
    tracesSampleRate: 0,
    enableLogs: false,
    enableMetrics: false,
    sendDefaultPii: false,
    sendClientReports: false,
    dataCollection: {
      userInfo: false, cookies: false, httpHeaders: false, httpBodies: [],
      urlQueryParams: false, databaseQueryData: false, stackFrameVariables: false,
      frameContextLines: 0, graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
    },
    beforeSend: sanitizeError,
  });
  client?.on("beforeSendSession", sanitizeSession);
}
