/**
 * English strings. This object is the canonical shape of a dictionary —
 * every other locale (see `es.ts`) is typed against `Dictionary = typeof en`,
 * so a missing or renamed key is a compile error, not a runtime surprise.
 *
 * Plain language only (CLAUDE.md Pattern 22): a member should never need a
 * manual to understand a screen.
 */
export const en = {
  app: {
    name: "High Desert",
    tagline: "Community-owned civic infrastructure for Redmond, Oregon.",
    place: "Redmond, Oregon",
  },

  common: {
    loading: "Loading…",
    languageLabel: "Language",
    english: "English",
    spanish: "Español",
    somethingWrong: "Sorry, something went wrong.",
  },

  nav: {
    home: "Home",
    signIn: "Sign in",
    signOut: "Sign out",
    skipToContent: "Skip to main content",
  },

  landing: {
    title: "A neighborhood you can trust.",
    subtitle:
      "High Desert is verified, ad-free, member-owned civic infrastructure for the people of Redmond. No ads. No tracking. Your data stays yours.",
    signInCta: "Sign in or join",
    dashboardCta: "Go to your home",
    commitmentsTitle: "What we promise",
    commitments: [
      "No advertising, ever — you are the member, not the product.",
      "We verify your residency, then forget the documents.",
      "Members govern this place, and your vote is secret.",
      "Your data is yours: export it, and leave with it any time.",
    ],
  },

  auth: {
    title: "Sign in to High Desert",
    subtitle:
      "New here? Use the same form — we'll create your account. We email you a secure link, so there's no password to remember or leak.",
    emailLabel: "Email address",
    emailPlaceholder: "you@example.com",
    submit: "Email me a sign-in link",
    submitting: "Sending…",
    checkEmailTitle: "Check your email",
    checkEmailBody:
      "If that address can join, we sent a secure sign-in link to {email}. Open it on this device to continue. The link expires soon.",
    sendAnother: "Use a different email",
    errorGeneric: "We couldn't send the link. Check the address and try again.",
    privacyNote:
      "We use your email only to sign you in. See our Terms & Privacy after you continue.",
  },

  welcome: {
    title: "Before you join in",
    intro:
      "These are the Terms of Membership and the Privacy Policy for High Desert. Please read them — they're short and in plain language — then confirm at the bottom to continue.",
    draftNotice:
      "Draft for review — pending Oregon legal review. The final wording may change before public launch.",
    signedInAs: "Signed in as {email}.",
    notYou: "Not you?",
    scrollHint: "Scroll to the end of both documents to continue.",
    reachedEnd: "Thanks for reading to the end.",
    agreeLabel:
      "I have read and agree to the Terms of Membership and Privacy Policy.",
    confirm: "Agree and continue",
    confirming: "Saving…",
    mustFinish: "Please read to the end and check the box first.",
    errorGeneric: "We couldn't save your agreement. Please try again.",
    versionLine: "Version {version}",
  },

  home: {
    title: "Welcome to High Desert",
    greeting: "Hello, {name}.",
    consentRecorded:
      "Your agreement to the current Terms & Privacy is on file. Thank you.",
    nextTitle: "What's next",
    nextBody:
      "Verifying that you live in Redmond unlocks neighborhood events and the community vote. That step is coming soon in this beta.",
    statusVerified: "Verified resident",
    statusUnverified: "Not yet verified",
    statusLabel: "Membership status",
  },
};

export type Dictionary = typeof en;
