import { describe, it, expect } from "vitest";
import {
  inviteEmail,
  isProvider,
  safeReturnPath,
  exchangeReturnPath,
} from "@/lib/member-pipelines/shared";
describe("member pipeline input boundaries", () => {
  it("normalizes emails without treating names or phones as identities", () => {
    expect(inviteEmail(" PERSON@EXAMPLE.TEST ")).toBe("person@example.test");
    expect(inviteEmail("Greg")).toBeNull();
    expect(inviteEmail("+15555550123")).toBeNull();
  });
  it("preserves board filters but rejects external return links", () => {
    expect(exchangeReturnPath("https://elsewhere.test")).toBe(
      "/protected/exchange",
    );
    expect(
      exchangeReturnPath("/protected/exchange?f=need&q=tools&token=secret"),
    ).toBe("/protected/exchange?f=need&q=tools");
  });
  it("limits provider selection", () => {
    expect(isProvider("google")).toBe(true);
    expect(isProvider("apple")).toBe(true);
    expect(isProvider("attacker")).toBe(false);
  });
  it("keeps callback destinations inside member routes", () => {
    expect(safeReturnPath("/protected/../auth/login")).toBe("/protected");
    expect(safeReturnPath("https://elsewhere.test")).toBe("/protected");
    expect(safeReturnPath("//elsewhere.test")).toBe("/protected");
    expect(safeReturnPath("/protected\\evil")).toBe("/protected");
    expect(safeReturnPath("/protected/account/sign-in-methods")).toBe(
      "/protected/account/sign-in-methods",
    );
  });
});
