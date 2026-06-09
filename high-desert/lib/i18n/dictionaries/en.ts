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
    neighborhoodLink: "Neighborhood",
    eventsLink: "Events",
    governanceLink: "Proposals",
    appealsLink: "Appeals",
    transparencyLink: "Transparency",
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
    neighborhoodLabel: "Neighborhood",
    noNeighborhood: "Not set",
    neighborhoodCta: "Choose your neighborhood",
    changeCta: "Change",
  },

  neighborhoods: {
    title: "Your neighborhood",
    intro:
      "Pick the Redmond neighborhood you call home. You can change this any time.",
    legend: "Choose your neighborhood",
    noneOptionLabel: "None of these fit",
    noneOptionHint:
      "If your part of Redmond isn't listed — a broader area, a rural pocket, or a community outside city limits — choose this. A neighbor on the team will follow up to help place you.",
    noneNoteLabel: "Where do you live? (optional)",
    noneNotePlaceholder:
      "e.g. Downtown Redmond, or a rural area outside the listed neighborhoods",
    save: "Save neighborhood",
    saving: "Saving…",
    saved: "Neighborhood saved.",
    noneConfirmTitle: "We'll follow up",
    noneConfirmBody:
      "Your response is noted. A neighbor on the team will reach out to help find your neighborhood. You have full access in the meantime.",
    openRequestNotice:
      "You've told us none of the listed neighborhoods fit. A neighbor on the team will follow up to help place you. You can still pick a neighborhood here any time.",
    backHome: "Back to home",
    errorGeneric: "We couldn't save that. Please try again.",
  },

  events: {
    listTitle: "Neighborhood events",
    listIntro:
      "Upcoming gatherings, soonest first. Events in your neighborhood come first, then the rest of Redmond.",
    create: "Create event",
    inYourNeighborhood: "In your neighborhood",
    acrossRedmond: "Across Redmond",
    upcomingTitle: "Upcoming events",
    empty: "No upcoming events yet. Be the first to create one.",
    allRedmond: "All of Redmond",
    hostedBy: "Hosted by {name}",
    whenLabel: "When",
    whereLabel: "Where",
    capacityLabel: "Limited spots",
    capacityValue: { one: "{count} spot", other: "{count} spots" },
    noLocation: "Location to be announced",
    backToEvents: "← All events",
    newTitle: "Create an event",
    newIntro:
      "Host a neighborhood gathering. Keep it simple — a title, when, and where.",
    fieldTitle: "Title",
    fieldTitlePlaceholder: "e.g. Block cleanup at the park",
    fieldWhen: "Date and time",
    fieldWhere: "Location",
    fieldWherePlaceholder: "e.g. Sam Johnson Park, main shelter",
    fieldNeighborhood: "Neighborhood",
    fieldCapacity: "Limit how many can come? (optional)",
    fieldCapacityPlaceholder: "No limit",
    fieldDetails: "Details (optional)",
    fieldDetailsPlaceholder:
      "What to expect, what to bring, how to find the group…",
    submit: "Create event",
    submitting: "Creating…",
    titleRequired: "Please add a title.",
    whenRequired: "Please choose a date and time.",
    errorGeneric: "We couldn't create the event. Please try again.",
    gateTitle: "Verify to join neighborhood events",
    gateBody:
      "Neighborhood events are for verified Redmond residents. Verify your residency to see and create gatherings.",
    gateCta: "Verify your residency",
  },

  rsvp: {
    formHeading: "Will you come?",
    statusGoing: "I'm going",
    statusMaybe: "Maybe",
    bringingLabel: "Bringing something? (optional)",
    bringingPlaceholder: "e.g. folding chairs, a veggie tray",
    submit: "RSVP",
    update: "Update RSVP",
    saving: "Saving…",
    saved: "Your RSVP is saved.",
    cancel: "Cancel my RSVP",
    cancelling: "Cancelling…",
    errorGeneric: "We couldn't save your RSVP. Please try again.",
    heading: "Who's coming",
    goingCount: "Going ({count})",
    maybeCount: "Maybe ({count})",
    noneYet: "No RSVPs yet. Be the first.",
    spotsTaken: {
      one: "{going} of {count} spot taken",
      other: "{going} of {count} spots taken",
    },
    bringingTag: "bringing {item}",
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
    requestsTitle: "Neighborhood-help requests",
    requestsIntro:
      "Members who said none of the listed neighborhoods fit, oldest first. Reach out to help place them, then mark the request resolved.",
    requestsEmpty: "No open neighborhood-help requests.",
    requestNote: "Where they live:",
    requestNoNote: "No note left.",
    memberSince: "Member since {date}",
    markResolved: "Mark resolved",
    resolving: "Saving…",
    resolveError: "Couldn't update that. Please try again.",
  },

  governance: {
    listTitle: "Proposals & votes",
    listIntro:
      "Community proposals and their voting windows — open votes first, then upcoming, then closed. Your ballot is secret until a vote closes; results appear only after.",
    create: "New proposal",
    empty: "No proposals yet.",
    openSection: "Open for voting",
    upcomingSection: "Upcoming",
    closedSection: "Closed",
    windowOpenUntil: "Voting open until {date}",
    windowOpensAt: "Voting opens {date}",
    windowClosedAt: "Voting closed {date}",
    proposedBy: "Proposed by {name}",
    opensLabel: "Voting opens",
    closesLabel: "Voting closes",
    backToList: "← All proposals",
    kinds: {
      minor: "Minor",
      major: "Major",
      immutable: "Foundational",
    },
    states: {
      upcoming: "Upcoming",
      open: "Open",
      closed: "Closed",
    },
    gateTitle: "Verify to take part in governance",
    gateBody:
      "Proposals and voting are for verified Redmond residents. Verify your residency to read and vote on proposals.",
    gateCta: "Verify your residency",
    newTitle: "New proposal",
    newIntro:
      "Put a decision to the community. Set when voting opens and closes — both are Redmond time.",
    fieldTitle: "Title",
    fieldTitlePlaceholder: "e.g. Adopt the community garden plan",
    fieldKind: "Type of decision",
    fieldKindHint:
      "Bigger decisions need broader agreement to pass. The exact thresholds are set by the community.",
    fieldBody: "Details",
    fieldBodyPlaceholder: "Explain what's being decided and why…",
    fieldOpens: "Voting opens",
    fieldCloses: "Voting closes",
    submit: "Create proposal",
    submitting: "Creating…",
    titleRequired: "Please add a title.",
    windowRequired: "Please set valid open and close times.",
    windowOrder: "Voting must close after it opens.",
    closesPast: "The close time must be in the future.",
    errorGeneric: "We couldn't create the proposal. Please try again.",
    voteHeading: "Your vote",
    voteSecrecyNote:
      "Your ballot is secret — only you can see it. You can change it any time until voting closes. No results are shown until then.",
    choices: {
      yes: "Yes",
      no: "No",
      abstain: "Abstain",
    },
    voteSubmit: "Cast my vote",
    voteChange: "Change my vote",
    voteSubmitting: "Saving…",
    voteSaved: "Your vote is recorded.",
    voteError: "We couldn't record your vote. Please try again.",
    votingOpensNote: "Voting opens {date}. Check back then to cast your vote.",
    resultsHeading: "Result",
    resultsNote:
      "Tenure-weighted totals, aggregate only — individual ballots are never shown.",
    turnout: { one: "{count} ballot cast", other: "{count} ballots cast" },
    noResult: "No result is available for this proposal.",
    closeHint:
      "Voting has ended. Recording the close writes the official result to the public audit log.",
    recordClose: "Record official close",
    recording: "Saving…",
    closeError: "Couldn't record the close. Please try again.",
  },

  moderation: {
    removedTitleEvent: "This event was removed by a moderator.",
    removedTitleProposal: "This proposal was removed by a moderator.",
    removedReason: "Reason",
    appealable: "If this is your content, you can appeal this decision.",
    controlHeading: "Moderator tools",
    reasonLabel: "Reason (required — shown to the member and in the public log)",
    reasonPlaceholder: "Why is this being removed or restored?",
    removeConfirm:
      "Remove this content? The reason will be visible to the member and in the public transparency log.",
    removeSubmit: "Remove",
    restoreSubmit: "Restore",
    working: "Saving…",
    reasonRequired: "Please write a reason.",
    error: "We couldn't record that. Please try again.",
    noticesTitle: "Moderation notices",
    noticeEventRemoved: 'Your event "{title}" was removed by a moderator.',
    noticeProposalRemoved: 'Your proposal "{title}" was removed by a moderator.',
    noticeView: "View details and appeal",
    appealHeading: "Appeal this removal",
    appealPlaceholder: "Explain why this should be restored…",
    appealSubmit: "Submit appeal",
    appealSubmitting: "Submitting…",
    appealError: "We couldn't submit your appeal. Please try again.",
    appealStatusOpen:
      "Your appeal is under review by a different moderator than the one who removed this.",
    appealStatusUpheld: "After review, the removal was upheld.",
    appealStatusOverturned:
      "After review, the removal was overturned and the content restored.",
    appealsTitle: "Appeals",
    appealsIntro:
      "Open appeals from members, oldest first. You can't resolve an appeal of your own action — a different moderator must.",
    appealsEmpty: "No open appeals.",
    appealOnEvent: "Removal of an event",
    appealOnProposal: "Removal of a proposal",
    appealRemovalReason: "Removal reason",
    appealBy: "Appeal by {name}",
    ownActionNote:
      "You took this action, so a different moderator must resolve this appeal.",
    resolveReasonLabel: "Reason for your decision (required, recorded)",
    resolveReasonPlaceholder: "Explain your decision…",
    uphold: "Uphold removal",
    overturn: "Overturn & restore",
    resolving: "Saving…",
    resolveError: "We couldn't record that. Please try again.",
  },

  transparency: {
    title: "Transparency",
    intro:
      "A public record of moderation on High Desert — what was done, why, and how appeals were resolved. Moderation is accountable, not arbitrary.",
    empty: "No moderation activity yet.",
    actionRemoveEvent: "An event was removed",
    actionRemoveProposal: "A proposal was removed",
    actionRemoveGeneric: "Content was removed",
    actionRestoreEvent: "An event was restored",
    actionRestoreProposal: "A proposal was restored",
    actionRestoreGeneric: "Content was restored",
    appealUpheld: "Appeal reviewed — the removal stands",
    appealOverturned: "Appeal reviewed — the content was restored",
    reason: "Reason",
    byModerator: "by {name}",
    byModeratorUnknown: "by a moderator",
    viewContent: "View",
  },
};

export type Dictionary = typeof en;
