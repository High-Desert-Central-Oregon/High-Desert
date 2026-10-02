/** Steppe — inert authentication subscription for accessibility fixtures.
 * Copyright (C) 2026 Steppe
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
export const createClient = () => ({
  auth: {
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe() {} } } };
    },
  },
});
