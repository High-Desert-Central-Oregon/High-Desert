/** Read a bounded JSON body without logging or retaining its contents. */
export async function readLimitedJson(
  request: Pick<Request, "headers" | "body">,
  limit = 64_000,
): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > limit)
    throw new Error("too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        throw new Error("too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
