let fail = false;
export function setFailure(value: boolean) {
  fail = value;
}
async function save(kind: string, fd: FormData) {
  await new Promise((r) => setTimeout(r, 150));
  if (fail) return { error: kind === "edit-event" ? "update-failed" : "generic" };
  window.dispatchEvent(
    new CustomEvent("fixture-save", {
      detail: { kind, ...Object.fromEntries(fd) },
    }),
  );
  if (kind === "edit-event" || kind === "delete-event") return null;
  return kind === "visibility" || kind === "name"
    ? { saved: true }
    : { ok: true };
}
export const setFieldVisibility = (_: unknown, fd: FormData) =>
  save("visibility", fd);
export const updateDisplayName = (_: unknown, fd: FormData) => save("name", fd);
export const setRsvp = (_: unknown, fd: FormData) => save("rsvp", fd);
export const cancelRsvp = (_: unknown, fd: FormData) => save("cancel", fd);
export const createPost = (_: unknown, fd: FormData) => save("post", fd);
export const createEvent = (_: unknown, fd: FormData) => save("event", fd);
export const updatePost = (_id: string, _: unknown, fd: FormData) =>
  save("edit", fd);
export const deletePost = (_id: string, _: unknown, fd: FormData) =>
  save("delete", fd);

export const updateEvent = (_id: string, _: unknown, fd: FormData) =>
  save("edit-event", fd);
export const deleteEvent = (_id: string, _: unknown, fd: FormData) =>
  save("delete-event", fd);
