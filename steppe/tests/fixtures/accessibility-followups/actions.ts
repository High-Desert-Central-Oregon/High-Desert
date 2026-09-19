/** Steppe — isolated accessibility regression fixture.
 * Copyright (C) 2026 Steppe
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Synthetic actions only. This fixture never imports database or email clients.
let outcome = "validation";
export const setOutcome = (next: string) => {
  outcome = next;
};
export const createEvent = async () => ({
  error: outcome === "validation" ? "when-required" : "create-failed",
});
export const createGroup = async () => ({
  error: outcome === "validation" ? "name-taken" : "create-failed",
});
export const createProposal = async () => ({
  error: outcome === "validation" ? "window-order" : "create-failed",
});
export const updateGroupSettings = async () =>
  outcome === "success"
    ? { ok: true }
    : { error: outcome === "validation" ? "name-required" : "action-failed" };
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
