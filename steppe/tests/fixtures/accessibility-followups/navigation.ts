/** Steppe — isolated accessibility regression fixture.
 * Copyright (C) 2026 Steppe
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
export const useRouter = () => ({ refresh() {}, push() {}, replace() {} });
export const usePathname = () => "/protected/exchange";
// Use Next's real browser control-flow detection even with inert navigation.
export { unstable_rethrow } from "next/dist/client/components/unstable-rethrow.browser";
