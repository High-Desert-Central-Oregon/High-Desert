/** Steppe — generic message failures without swallowing framework navigation.
 * Copyright (C) 2026 Steppe
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { unstable_rethrow } from "next/navigation";

export type MessageActionState = { error: "send-failed" } | null;

export async function attemptMessageAction(
  operation: () => Promise<MessageActionState>,
): Promise<MessageActionState> {
  try {
    return await operation();
  } catch (error) {
    // Auth/success redirects and other Next control flow must still propagate.
    // Ordinary transport errors disclose no database or participant details.
    unstable_rethrow(error);
    return { error: "send-failed" };
  }
}
