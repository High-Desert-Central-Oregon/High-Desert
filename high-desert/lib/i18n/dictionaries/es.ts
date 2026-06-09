import type { Dictionary } from "./en";

/**
 * Spanish strings. Typed as `Dictionary`, so it must match `en.ts` key-for-key.
 * Placeholders like {email} / {name} / {version} must be preserved verbatim.
 */
export const es: Dictionary = {
  app: {
    name: "High Desert",
    tagline: "Infraestructura cívica de propiedad comunitaria para Redmond, Oregón.",
    place: "Redmond, Oregón",
  },

  common: {
    loading: "Cargando…",
    languageLabel: "Idioma",
    english: "English",
    spanish: "Español",
    somethingWrong: "Lo sentimos, algo salió mal.",
  },

  nav: {
    home: "Inicio",
    signIn: "Iniciar sesión",
    signOut: "Cerrar sesión",
    skipToContent: "Saltar al contenido principal",
    verifyLink: "Verificar",
    reviewLink: "Revisiones",
  },

  landing: {
    title: "Un vecindario en el que puedes confiar.",
    subtitle:
      "High Desert es infraestructura cívica verificada, sin anuncios y de propiedad de sus miembros para la gente de Redmond. Sin anuncios. Sin rastreo. Tus datos siguen siendo tuyos.",
    signInCta: "Inicia sesión o únete",
    dashboardCta: "Ir a tu inicio",
    commitmentsTitle: "Lo que prometemos",
    commitments: [
      "Sin publicidad, nunca: tú eres el miembro, no el producto.",
      "Verificamos tu residencia y luego olvidamos los documentos.",
      "Los miembros gobiernan este lugar, y tu voto es secreto.",
      "Tus datos son tuyos: expórtalos y llévatelos cuando quieras.",
    ],
  },

  auth: {
    title: "Inicia sesión en High Desert",
    subtitle:
      "¿Eres nuevo? Usa el mismo formulario: crearemos tu cuenta. Te enviamos un enlace seguro por correo, así no hay contraseña que recordar ni que se pueda filtrar.",
    emailLabel: "Correo electrónico",
    emailPlaceholder: "tu@ejemplo.com",
    submit: "Envíenme un enlace para entrar",
    submitting: "Enviando…",
    checkEmailTitle: "Revisa tu correo",
    checkEmailBody:
      "Si esa dirección puede unirse, enviamos un enlace seguro de acceso a {email}. Ábrelo en este dispositivo para continuar. El enlace caduca pronto.",
    sendAnother: "Usar otro correo",
    errorGeneric:
      "No pudimos enviar el enlace. Revisa la dirección e inténtalo de nuevo.",
    privacyNote:
      "Usamos tu correo solo para iniciar tu sesión. Verás los Términos y la Privacidad al continuar.",
  },

  welcome: {
    title: "Antes de participar",
    intro:
      "Estos son los Términos de Membresía y la Política de Privacidad de High Desert. Por favor léelos —son breves y en lenguaje claro— y luego confirma al final para continuar.",
    draftNotice:
      "Borrador para revisión: pendiente de revisión legal en Oregón. La redacción final puede cambiar antes del lanzamiento público.",
    signedInAs: "Sesión iniciada como {email}.",
    notYou: "¿No eres tú?",
    scrollHint: "Desplázate hasta el final de ambos documentos para continuar.",
    reachedEnd: "Gracias por leer hasta el final.",
    agreeLabel:
      "He leído y acepto los Términos de Membresía y la Política de Privacidad.",
    confirm: "Aceptar y continuar",
    confirming: "Guardando…",
    mustFinish: "Por favor lee hasta el final y marca la casilla primero.",
    errorGeneric: "No pudimos guardar tu aceptación. Inténtalo de nuevo.",
    versionLine: "Versión {version}",
  },

  home: {
    title: "Bienvenido a High Desert",
    greeting: "Hola, {name}.",
    consentRecorded:
      "Tu aceptación de los Términos y la Privacidad actuales está registrada. Gracias.",
    nextTitle: "Qué sigue",
    nextBody:
      "Verificar que vives en Redmond desbloquea los eventos del vecindario y la votación comunitaria.",
    statusVerified: "Residente verificado",
    statusUnverified: "Aún no verificado",
    statusLabel: "Estado de membresía",
    verifyCta: "Verifica tu residencia",
  },

  verify: {
    title: "Verifica que vives en Redmond",
    intro:
      "La participación completa —eventos del vecindario y la votación comunitaria— es para residentes verificados de Redmond. Elige una forma de mostrar tu residencia. Una persona del equipo de revisión la comprueba a mano.",
    forget:
      "Borramos tu documento en el momento en que una persona decide. Solo conservamos que estás verificado y qué método usaste — nunca el documento en sí.",
    methodLegend: "¿Cómo te gustaría verificarte?",
    fileLabel: "Sube tu documento",
    fileHint: "Una foto clara o un PDF, hasta 10 MB.",
    submit: "Enviar para revisión",
    submitting: "Enviando…",
    postcardSubmit: "Solicitar un código por correo",
    fileRequired: "Por favor elige un archivo para subir.",
    tooLarge: "Ese archivo supera los 10 MB. Por favor elige uno más pequeño.",
    badType: "Por favor sube una imagen (JPG, PNG, WEBP, HEIC) o un PDF.",
    errorGeneric: "No pudimos enviarlo. Inténtalo de nuevo.",
    pendingTitle: "Tu verificación está en revisión",
    pendingBody:
      "Una persona la revisará pronto. Tendrás acceso completo en cuanto se apruebe — puedes cerrar esta página con tranquilidad.",
    verifiedTitle: "Eres residente verificado",
    verifiedBody:
      "Gracias. Tienes acceso completo a los eventos del vecindario y a la votación comunitaria.",
    rejectedNote:
      "Tu último envío no fue aprobado. Puedes intentarlo de nuevo abajo con otro documento o con la opción del código por correo.",
    methods: {
      id: "Identificación oficial",
      utility_bill: "Factura de servicios",
      voter_reg: "Registro electoral",
      property_record: "Registro de propiedad",
      postcard_code: "Código por correo postal",
    },
    methodHints: {
      id: "Una licencia de conducir o identificación estatal que muestre tu dirección en Redmond.",
      utility_bill: "Una factura reciente de agua, luz, gas o internet a tu nombre.",
      voter_reg: "Tu registro electoral de Oregón que muestre tu dirección.",
      property_record: "Un recibo de impuestos sobre la propiedad o escritura de tu casa en Redmond.",
      postcard_code:
        "No se necesita documento. Enviamos un código de un solo uso a tu dirección en Redmond y una persona lo confirma contigo — para quienes usan un apartado postal o no tienen documentación estándar.",
    },
  },

  review: {
    title: "Revisiones de verificación",
    intro:
      "Comprobaciones de residencia pendientes, las más antiguas primero. Una persona decide cada una. Aprobar otorga el estado de verificado e inicia la antigüedad del miembro. El archivo de evidencia se elimina en cualquier caso.",
    empty: "No hay verificaciones en espera por ahora.",
    viewEvidence: "Ver evidencia",
    opening: "Abriendo…",
    noEvidence: "Sin archivo — solicitud de código por correo",
    evidenceError: "No se pudo abrir la evidencia. El enlace puede haber caducado — inténtalo de nuevo.",
    approve: "Aprobar",
    reject: "Rechazar",
    deciding: "Guardando…",
    decideError: "No se pudo registrar esa decisión. Inténtalo de nuevo.",
    confirmReject: "¿Rechazar esta solicitud de verificación?",
  },
};
