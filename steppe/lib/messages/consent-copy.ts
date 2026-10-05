import type { Locale } from "@/lib/i18n";
export const consentCopy = {
  en: {
    title: "Messaging preferences",
    sub: "Choose who can contact you through your groups.",
    rulesTitle: "Group messaging",
    rulesIntro:
      "Add rules to enable private message requests between members. Everyone must review each new version. Leave blank to turn group contact off.",
    rulesLabel: "Messaging rules",
    rulesPlaceholder:
      "For example: contact members about this group, be respectful, and avoid unsolicited promotion.",
    baseline:
      "Your name and first message are shared with the member you contact. Only the two participants can read the conversation. One message is sent as a request; more messages wait for acceptance. You can decline or block. Turning group contact off stops contact through this group; existing conversations can continue. Block stops messages in both directions.",
    review: "Review this group's messaging rules",
    acknowledge: "I have read these messaging rules.",
    allow: "Allow members of this group to send me message requests",
    save: "Save",
    saving: "Saving…",
    saved: "Messaging preferences saved.",
    rulesSaved: "Messaging rules saved. Members must review changed rules.",
    failed:
      "That change could not be saved. Review the current rules and try again.",
    off: "Group messaging is off. A maintainer can add messaging rules in Manage group.",
    paused:
      "The rules have changed. Requests through this group are paused until you review them again.",
    disable: "Turn off requests from this group",
    empty: "Join a group to manage its messaging preferences.",
    manage: "Manage messaging preferences",
    message: "Message {name}",
    back: "Back to group",
    requestHint:
      "For a new conversation, your first message is a request. Wait for the member to accept before sending more. Existing conversations can continue.",
    sendRequest: "Send message",
    pending: "Message request",
    waiting: "Request sent. Further messages wait for acceptance.",
    incoming:
      "Would you like to accept this message request? Accepting allows both of you to send messages. Decline closes the request; Block also stops future contact from this member.",
    accept: "Accept",
    decline: "Decline",
    block: "Block",
    closed: "This request is closed. Further messages are unavailable.",
    unavailable: "This conversation cannot receive messages right now.",
    accepted: "Request accepted.",
    declined: "Request closed.",
    decisionFailed: "That request could not be updated. Refresh and try again.",
  },
  es: {
    title: "Preferencias de mensajes",
    sub: "Elige quién puede contactarte a través de tus grupos.",
    rulesTitle: "Mensajes del grupo",
    rulesIntro:
      "Añade reglas para permitir solicitudes de mensajes privados entre miembros. Todos deben revisar cada nueva versión. Deja el campo vacío para desactivar el contacto del grupo.",
    rulesLabel: "Reglas de mensajes",
    rulesPlaceholder:
      "Por ejemplo: contacta a los miembros sobre este grupo, sé respetuoso y evita promociones no solicitadas.",
    baseline:
      "Tu nombre y primer mensaje se comparten con la persona que contactas. Solo los dos participantes pueden leer la conversación. El primer mensaje es una solicitud; los siguientes esperan a que sea aceptada. Puedes rechazar o bloquear. Desactivar el contacto del grupo impide contactarte por este grupo; las conversaciones existentes pueden continuar. Bloquear detiene los mensajes en ambas direcciones.",
    review: "Revisa las reglas de mensajes de este grupo",
    acknowledge: "He leído estas reglas de mensajes.",
    allow:
      "Permitir que los miembros de este grupo me envíen solicitudes de mensajes",
    save: "Guardar",
    saving: "Guardando…",
    saved: "Preferencias de mensajes guardadas.",
    rulesSaved:
      "Reglas de mensajes guardadas. Los miembros deben revisar las reglas modificadas.",
    failed:
      "No se pudo guardar el cambio. Revisa las reglas actuales e inténtalo de nuevo.",
    off: "Los mensajes del grupo están desactivados. Un responsable puede añadir reglas en Administrar grupo.",
    paused:
      "Las reglas han cambiado. Las solicitudes por este grupo están pausadas hasta que las revises de nuevo.",
    disable: "Desactivar solicitudes de este grupo",
    empty: "Únete a un grupo para gestionar sus preferencias de mensajes.",
    manage: "Gestionar preferencias de mensajes",
    message: "Enviar mensaje a {name}",
    back: "Volver al grupo",
    requestHint:
      "En una conversación nueva, tu primer mensaje es una solicitud. Espera a que la persona la acepte antes de enviar más. Las conversaciones existentes pueden continuar.",
    sendRequest: "Enviar mensaje",
    pending: "Solicitud de mensaje",
    waiting:
      "Solicitud enviada. Los siguientes mensajes esperan a que sea aceptada.",
    incoming:
      "¿Quieres aceptar esta solicitud de mensaje? Al aceptar, ambos pueden enviar mensajes. Rechazar cierra la solicitud; bloquear también impide el contacto futuro de esta persona.",
    accept: "Aceptar",
    decline: "Rechazar",
    block: "Bloquear",
    closed: "Esta solicitud está cerrada. No se pueden enviar más mensajes.",
    unavailable: "Esta conversación no puede recibir mensajes en este momento.",
    accepted: "Solicitud aceptada.",
    declined: "Solicitud cerrada.",
    decisionFailed:
      "No se pudo actualizar la solicitud. Actualiza la página e inténtalo de nuevo.",
  },
} satisfies Record<Locale, Record<string, string>>;
export type RequestStatus = "pending" | "accepted" | "declined";
export type GroupMessagePreference = {
  group_id: string;
  acknowledged_version: number;
  allow_requests: boolean;
};
