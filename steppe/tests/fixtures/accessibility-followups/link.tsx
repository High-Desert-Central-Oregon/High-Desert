/** Steppe — isolated accessibility regression fixture.
 * Copyright (C) 2026 Steppe
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { ComponentProps } from "react";
export default function Link(props: ComponentProps<"a">) {
  return <a {...props} />;
}
