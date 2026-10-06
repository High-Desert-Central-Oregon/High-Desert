// Synthetic failure only. No database, accounts, messages or external requests.
export async function unblockMember() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return { error: "send-failed" as const };
}
