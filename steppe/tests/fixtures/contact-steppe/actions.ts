// Synthetic controls only. No network, accounts, messages or reports.
let failure = "returned";
export const setFailure = (value: string) => { failure = value; };
export async function contactSteppeDraft() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  if (failure === "thrown") throw new TypeError("Synthetic offline failure");
  return { error: "send-failed" as const };
}
export async function contactSteppe() {}
