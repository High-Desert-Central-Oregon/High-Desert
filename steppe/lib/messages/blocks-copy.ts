import type { Locale } from "@/lib/i18n";
type Copy = {
  title: string;
  sub: string;
  back: string;
  empty: string;
  unavailable: string;
  neighbor: string;
  unblock: string;
  confirm: string;
  explanation: string;
  closed: string;
  notification: string;
  cancel: string;
  saving: string;
  saved: string;
  failed: string;
  messages: string;
};
export const blocksCopy: Record<Locale, Copy> = {
  en: {
    title: "Blocked members",
    sub: "Manage the people you have blocked from messaging you.",
    back: "Back to You",
    empty: "You have not blocked anyone.",
    unavailable:
      "We could not load your blocked members. Refresh to try again.",
    neighbor: "Member (name unavailable)",
    unblock: "Unblock {name}",
    confirm: "I want to unblock {name}.",
    explanation:
      "Messages in an accepted conversation can resume unless this person has also blocked you or their account is unavailable.",
    closed:
      "Closed requests stay closed. Unblocking does not accept a request or change your messaging preferences.",
    notification: "No notification is sent when you unblock someone.",
    cancel: "Cancel",
    saving: "Unblocking…",
    saved: "Member unblocked. Closed requests remain closed.",
    failed:
      "We could not confirm that change. Refresh to check your blocked members, then try again.",
    messages: "Go to messages",
  },
  es: {
    title: "Miembros bloqueados",
    sub: "Administra las personas que has bloqueado para que no te envíen mensajes.",
    back: "Volver a Tú",
    empty: "No has bloqueado a nadie.",
    unavailable:
      "No pudimos cargar tus miembros bloqueados. Actualiza la página para intentarlo de nuevo.",
    neighbor: "Miembro (nombre no disponible)",
    unblock: "Desbloquear a {name}",
    confirm: "Quiero desbloquear a {name}.",
    explanation:
      "Los mensajes de una conversación aceptada pueden reanudarse, salvo que esta persona también te haya bloqueado o su cuenta no esté disponible.",
    closed:
      "Las solicitudes cerradas siguen cerradas. Desbloquear no acepta una solicitud ni cambia tus preferencias de mensajes.",
    notification:
      "No se envía ninguna notificación cuando desbloqueas a alguien.",
    cancel: "Cancelar",
    saving: "Desbloqueando…",
    saved: "Miembro desbloqueado. Las solicitudes cerradas siguen cerradas.",
    failed:
      "No pudimos confirmar el cambio. Actualiza la página para revisar tus miembros bloqueados y vuelve a intentarlo.",
    messages: "Ir a mensajes",
  },
};
