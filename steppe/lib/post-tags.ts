export const POST_TAGS = ["need", "offer", "aid", "job", "goods"] as const;
export type PostTag = (typeof POST_TAGS)[number];
export function parsePostTags(values: FormDataEntryValue[]): PostTag[] | null {
  if (
    !values.length ||
    values.length > POST_TAGS.length ||
    values.some(
      (v) =>
        typeof v !== "string" || !(POST_TAGS as readonly string[]).includes(v),
    )
  )
    return null;
  return [...new Set(values)] as PostTag[];
}
