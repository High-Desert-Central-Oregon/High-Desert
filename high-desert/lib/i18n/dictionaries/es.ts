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
      "Verificar que vives en Redmond desbloquea los eventos del vecindario y la votación comunitaria. Ese paso llegará pronto en esta beta.",
    statusVerified: "Residente verificado",
    statusUnverified: "Aún no verificado",
    statusLabel: "Estado de membresía",
  },
};
