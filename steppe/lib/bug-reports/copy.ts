const en = {
  refreshDetails: "Refresh technical details",
  sentryHint:
    "Including technical details also links up to five recent crash references shown below. Anonymous crash monitoring runs separately; your description and activity history stay in Steppe.",
  sentryHeading: "Related Sentry errors",
  sentryNone:
    "No Sentry error references were included. A problem can occur without a captured error.",
  sentryUnavailable:
    "Sentry details are temporarily unavailable. Refresh this page to try again.",
  sentryNotConfigured: "Sentry detail lookup has not been configured.",
  sentryPending:
    "This error is not available in Sentry yet, or it has expired. Refresh to check again.",
  sentryMismatch:
    "The reference could not be matched to this release and time.",
  sentryOpen: "Open error in Sentry",
  sentryNote:
    "Exact error references supplied with this report. Details are retrieved when this page opens, so delayed Sentry processing can appear on refresh. No match is inferred from another person's report.",
  sentryHandled: "Handled by the app",
  sentryUnhandled: "Unhandled error",
  button: "Report a bug",
  title: "Help us fix this",
  intro:
    "Tell us what went wrong. Please leave out private messages, residency documents, passwords, and sign-in codes.",
  description: "What happened?",
  expected: "What did you expect? (optional)",
  email: "Reply email (optional)",
  emailHint: "Add an email if you'd like us to follow up.",
  capture: "Remember technical steps while I test",
  captureHint:
    "Off until you choose it. Keeps up to 10 minutes or 100 technical events on this device, only while this page session is open. This activity history is uploaded only when you include it in a report. No typed text or screen recordings.",
  captureOn: "Technical history is on for this page session.",
  include: "Include the technical details shown below",
  preview: "Review technical details",
  empty:
    "No earlier steps are available. Enable technical history, close this panel, and repeat the problem to capture them.",
  invalid:
    "Please describe the problem using at least five characters and check the email address.",
  send: "Send report",
  sending: "Saving…",
  success: "Your report was saved.",
  reference: "Report reference",
  failed:
    "Your report was not confirmed saved. Try again; retries won't create a second report. You can also download it and email support.",
  rate: "Too many reports just now. Please try again in an hour, or email support.",
  stop: "Stop recording more steps",
  retryQueued: "Retry requested. Check the email alert status above.",
  close: "Close",
  another: "Report another issue",
  download: "Download report",
  contact: "Email support",
  privacy:
    "Reports are private to Steppe support and removed after 30 days. Reports sent while signed in are linked to your account and included in account export/deletion.",
  queue: "Bug reports",
  queueIntro:
    "Private reports, newest first. Review each case and record what happens next.",
  unavailable:
    "Reports could not be loaded. Try refreshing. An empty list does not mean there are no reports.",
  noReports: "No bug reports yet.",
  timeline: "Technical timeline",
  history: "Review history",
  status: "Status",
  note: "Private support note",
  noteHint:
    "Keep notes free of identity documents, message contents, and passwords.",
  save: "Save update",
  saved: "Update saved.",
  updateFailed: "The update was not saved. Please try again.",
  retry: "Retry email alert",
  pending: "Email alert pending",
  sent: "Email alert sent",
  attempts: "Attempts",
  expires: "Removed on",
  next: "Older reports",
  back: "Back to reports",
  details: "Environment",
  release: "App release",
  page: "Page",
  contactEmail: "Reply email",
  noEmail: "No reply email supplied.",
  noDiagnostics: "The member did not include diagnostics.",
  technicalHint:
    "Relative times start at the first retained event. This is member-submitted context, not a verified account of events.",
  statuses: {
    new: "New",
    reviewing: "Reviewing",
    needs_information: "Needs information",
    reproduced: "Reproduced",
    in_progress: "In progress",
    fixed: "Fixed",
    closed: "Closed",
    duplicate: "Duplicate",
  },
};
export type BugCopy = typeof en;
const es: BugCopy = {
  refreshDetails: "Actualizar detalles técnicos",
  sentryHint:
    "Al incluir detalles técnicos, también se vinculan hasta cinco referencias recientes a errores que se muestran abajo. La supervisión anónima de errores funciona por separado; tu descripción e historial permanecen en Steppe.",
  sentryHeading: "Errores relacionados de Sentry",
  sentryNone:
    "No se incluyeron referencias de Sentry. Puede haber un problema sin un error registrado.",
  sentryUnavailable:
    "Los detalles de Sentry no están disponibles por ahora. Actualiza la página para reintentar.",
  sentryNotConfigured: "La consulta de detalles de Sentry no está configurada.",
  sentryPending:
    "Este error aún no está disponible en Sentry o ha caducado. Actualiza para comprobarlo.",
  sentryMismatch: "La referencia no coincide con esta versión y hora.",
  sentryOpen: "Abrir error en Sentry",
  sentryNote:
    "Referencias exactas incluidas en este informe. Los detalles se consultan al abrir esta página; si Sentry tarda en procesarlos, pueden aparecer al actualizar. No se deducen coincidencias con informes de otras personas.",
  sentryHandled: "Gestionado por la app",
  sentryUnhandled: "Error no gestionado",
  button: "Reportar un error",
  title: "Ayúdanos a corregirlo",
  intro:
    "Cuéntanos qué salió mal. No incluyas mensajes privados, documentos de residencia, contraseñas ni códigos de acceso.",
  description: "¿Qué pasó?",
  expected: "¿Qué esperabas? (opcional)",
  email: "Correo para responder (opcional)",
  emailHint: "Añade un correo si quieres que te respondamos.",
  capture: "Recordar pasos técnicos mientras pruebo",
  captureHint:
    "Desactivado hasta que lo elijas. Guarda hasta 10 minutos o 100 eventos técnicos en este dispositivo durante esta sesión de página. Este historial solo se envía cuando lo incluyes en un informe. No guarda texto escrito ni grabaciones de pantalla.",
  captureOn: "El historial técnico está activado para esta sesión de página.",
  include: "Incluir los detalles técnicos que se muestran abajo",
  preview: "Revisar detalles técnicos",
  empty:
    "No hay pasos anteriores disponibles. Activa el historial técnico, cierra este panel y repite el problema para registrarlos.",
  invalid:
    "Describe el problema con al menos cinco caracteres y revisa el correo electrónico.",
  send: "Enviar informe",
  sending: "Guardando…",
  success: "Tu informe se guardó.",
  reference: "Referencia del informe",
  failed:
    "No se confirmó que el informe se guardara. Inténtalo de nuevo; los reintentos no crean un segundo informe. También puedes descargarlo y escribir a soporte.",
  rate: "Hay demasiados informes por ahora. Inténtalo en una hora o escribe a soporte.",
  stop: "Dejar de registrar pasos",
  retryQueued:
    "Se solicitó el reintento. Revisa el estado del aviso por correo arriba.",
  close: "Cerrar",
  another: "Reportar otro problema",
  download: "Descargar informe",
  contact: "Escribir a soporte",
  privacy:
    "Los informes son privados para el equipo de soporte de Steppe y se eliminan después de 30 días. Los informes enviados con la sesión iniciada se vinculan a tu cuenta y se incluyen en su exportación y eliminación.",
  queue: "Informes de errores",
  queueIntro:
    "Informes privados, del más reciente al más antiguo. Revisa cada caso y registra los siguientes pasos.",
  unavailable:
    "No se pudieron cargar los informes. Actualiza la página. Una lista vacía no significa que no haya informes.",
  noReports: "Todavía no hay informes.",
  timeline: "Cronología técnica",
  history: "Historial de revisión",
  status: "Estado",
  note: "Nota privada de soporte",
  noteHint: "No incluyas documentos de identidad, mensajes ni contraseñas.",
  save: "Guardar cambio",
  saved: "Cambio guardado.",
  updateFailed: "No se guardó el cambio. Inténtalo de nuevo.",
  retry: "Reintentar aviso por correo",
  pending: "Aviso por correo pendiente",
  sent: "Aviso por correo enviado",
  attempts: "Intentos",
  expires: "Se elimina el",
  next: "Informes anteriores",
  back: "Volver a los informes",
  details: "Entorno",
  release: "Versión de la app",
  page: "Página",
  contactEmail: "Correo para responder",
  noEmail: "No se proporcionó un correo de respuesta.",
  noDiagnostics: "La persona no incluyó diagnósticos.",
  technicalHint:
    "Los tiempos relativos empiezan con el primer evento conservado. Este contexto lo envió la persona; no es un registro verificado de los hechos.",
  statuses: {
    new: "Nuevo",
    reviewing: "En revisión",
    needs_information: "Falta información",
    reproduced: "Reproducido",
    in_progress: "En curso",
    fixed: "Corregido",
    closed: "Cerrado",
    duplicate: "Duplicado",
  },
};
export const bugCopy = { en, es };
export type BugStatus = keyof BugCopy["statuses"];
