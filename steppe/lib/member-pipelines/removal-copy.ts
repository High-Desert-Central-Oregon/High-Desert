const copy = {
  title: ["Remove an account", "Eliminar una cuenta"],
  intro: [
    "For a member's deletion request or a fresh beta test. This permanently removes their access and personal app content.",
    "Para una solicitud de eliminación o una nueva prueba beta. Esto elimina permanentemente el acceso y el contenido personal de la aplicación.",
  ],
  email: ["Account email", "Correo de la cuenta"],
  find: ["Find account", "Buscar cuenta"],
  missing: [
    "No account found for that email.",
    "No se encontró una cuenta con ese correo.",
  ],
  failed: [
    "The change could not be confirmed. Refresh to check pending removals before trying again.",
    "No se pudo confirmar el cambio. Actualiza para revisar las eliminaciones pendientes antes de volver a intentarlo.",
  ],
  protected: [
    "This account cannot be removed here. Your own account, administrators, moderators and support operators are protected.",
    "Esta cuenta no se puede eliminar aquí. Tu cuenta, los administradores, moderadores y operadores de soporte están protegidos.",
  ],
  verified: ["Verified member", "Miembro verificado"],
  unverified: ["Not yet verified", "Aún sin verificar"],
  erased: [
    "Removes the profile name, neighborhood, verification files, posts, sent messages, events, group memberships, invitations and signup details. This cannot be undone.",
    "Elimina el nombre, barrio, archivos de verificación, publicaciones, mensajes enviados, eventos, membresías de grupos, invitaciones y datos de inscripción. No se puede deshacer.",
  ],
  kept: [
    "Ballots, consents, governance proposals, moderation records and audit history remain attached to an anonymous Former member record. Other members' messages remain.",
    "Los votos, consentimientos, propuestas, registros de moderación e historial de auditoría se conservan con un registro anónimo de Antiguo miembro. Los mensajes de otros miembros se conservan.",
  ],
  reason: ["Reason", "Motivo"],
  choose: ["Choose a reason", "Elige un motivo"],
  member_request: [
    "The member requested deletion",
    "El miembro solicitó la eliminación",
  ],
  test_reset: [
    "Reset a beta test account",
    "Reiniciar una cuenta de prueba beta",
  ],
  confirmation: [
    "Type the account email again to confirm",
    "Escribe de nuevo el correo para confirmar",
  ],
  acknowledge: [
    "I understand this is permanent and have authority to remove this account.",
    "Entiendo que es permanente y tengo autorización para eliminar esta cuenta.",
  ],
  remove: ["Permanently remove account", "Eliminar cuenta permanentemente"],
  busy: ["Working…", "Procesando…"],
  pending: [
    "Access has been removed. Cleanup is unfinished; retry below before inviting this email again.",
    "Se ha eliminado el acceso. La limpieza no ha terminado; reinténtala abajo antes de volver a invitar este correo.",
  ],
  complete: [
    "Account removed. You can now send a new invitation. The person will sign up and complete normal verification again.",
    "Cuenta eliminada. Ahora puedes enviar una nueva invitación. La persona deberá registrarse y completar la verificación habitual otra vez.",
  ],
  pendingTitle: ["Unfinished removals", "Eliminaciones pendientes"],
  retry: ["Finish cleanup", "Terminar limpieza"],
  back: ["People and invitations", "Personas e invitaciones"],
  invite: ["Send a new invitation", "Enviar una nueva invitación"],
} as const;
export type RemovalCopyKey = keyof typeof copy;
export const rc = (locale: string, key: RemovalCopyKey) =>
  copy[key][locale === "es" ? 1 : 0];
