/** Steppe — isolated accessibility regression fixture.
 * Copyright (C) 2026 Steppe
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Synthetic actions only. This fixture never imports database or email clients.
let outcome = "validation";
export const setOutcome = (next: string) => {
  outcome = next;
};
async function settle<T>(result: T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 150));
  return result;
}
export const createEvent = async () =>
  settle({
    error: outcome === "validation" ? "when-required" : "create-failed",
  });
export const createGroup = async () =>
  settle({
    error: outcome === "validation" ? "name-taken" : "create-failed",
  });
export const createProposal = async () =>
  settle({
    error: outcome === "validation" ? "window-order" : "create-failed",
  });
export const updateGroupSettings = async () =>
  settle(
    outcome === "success"
      ? { ok: true }
      : { error: outcome === "validation" ? "name-required" : "action-failed" },
  );
export const suggestCategory = async () => ({ error: "suggest-failed" });
export const requestInformation = async () => ({ ok: false });
export const completeReview = async () => {
  if (outcome === "throw") throw new Error("Synthetic failure");
  return { ok: false };
};
export const createEvidenceSignedUrl = async () => ({ error: "failed" });
export const blockNeighbor = async () => undefined;
export const leaveThread = async () => undefined;
export const reportThread = async () => undefined;
export const toggleMute = async () => undefined;

export const createPost = async () => ({ error: "body-required" });
export const updatePost = createPost;
export const updateEvent = createEvent;
export const castVote = async () => settle({ error: "vote-failed" });
