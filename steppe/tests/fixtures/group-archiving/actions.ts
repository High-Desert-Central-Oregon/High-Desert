// Synthetic failure only. No database, accounts or external requests.
export async function archiveGroup() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return { error: "action-failed" as const };
}
