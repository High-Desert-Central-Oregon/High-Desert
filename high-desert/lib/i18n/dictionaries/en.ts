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
    verifyLink: "Verify",
    reviewLink: "Reviews",
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
      "Verifying that you live in Redmond unlocks neighborhood events and the community vote.",
    statusVerified: "Verified resident",
    statusUnverified: "Not yet verified",
    statusLabel: "Membership status",
    verifyCta: "Verify your residency",
  },

  verify: {
    title: "Verify that you live in Redmond",
    intro:
      "Full participation — neighborhood events and the community vote — is for verified Redmond residents. Choose one way to show your residency. A neighbor on the review team checks it by hand.",
    forget:
      "We delete your document the moment a reviewer decides. We keep only that you're verified and which method you used — never the document itself.",
    methodLegend: "How would you like to verify?",
    fileLabel: "Upload your document",
    fileHint: "A clear photo or PDF, up to 10 MB.",
    submit: "Submit for review",
    submitting: "Submitting…",
    postcardSubmit: "Request a mailed code",
    fileRequired: "Please choose a file to upload.",
    tooLarge: "That file is over 10 MB. Please choose a smaller one.",
    badType: "Please upload an image (JPG, PNG, WEBP, HEIC) or a PDF.",
    errorGeneric: "We couldn't submit that. Please try again.",
    pendingTitle: "Your verification is under review",
    pendingBody:
      "A reviewer will check it soon. You'll get full access once you're approved — you can safely close this page.",
    verifiedTitle: "You're a verified resident",
    verifiedBody:
      "Thank you. You have full access to neighborhood events and the community vote.",
    rejectedNote:
      "Your last submission wasn't approved. You can try again below with a different document or the mailed-code option.",
    methods: {
      id: "Government ID",
      utility_bill: "Utility bill",
      voter_reg: "Voter registration",
      property_record: "Property record",
      postcard_code: "Mailed postcard code",
    },
    methodHints: {
      id: "A driver's license or state ID showing your Redmond address.",
      utility_bill: "A recent water, power, gas, or internet bill in your name.",
      voter_reg: "Your Oregon voter registration showing your address.",
      property_record: "A property tax statement or deed for your Redmond home.",
      postcard_code:
        "No document needed. We mail a one-time code to your Redmond address and a reviewer confirms it with you — for anyone using a PO box or without standard paperwork.",
    },
  },

  review: {
    title: "Verification reviews",
    intro:
      "Pending residency checks, oldest first. A person decides each one. Approving grants verified status and starts the member's tenure. The evidence file is deleted either way.",
    empty: "No verifications are waiting right now.",
    viewEvidence: "View evidence",
    opening: "Opening…",
    noEvidence: "No file — mailed-code request",
    evidenceError: "Couldn't open the evidence. The link may have expired — try again.",
    approve: "Approve",
    reject: "Reject",
    deciding: "Saving…",
    decideError: "Couldn't record that decision. Please try again.",
    confirmReject: "Reject this verification request?",
  },
};

export type Dictionary = typeof en;
