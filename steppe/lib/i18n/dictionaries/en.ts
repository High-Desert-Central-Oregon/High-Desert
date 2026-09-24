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
    name: "Steppe",
    descriptor: "a high desert civic commons",
    tagline: "Community-owned civic infrastructure for Redmond, Oregon.",
    place: "Redmond, Oregon",
  },

  common: {
    characters: "characters",
    loadFailed: "This page could not be loaded. Please try again.",
    retry: "Try again",
    loading: "Loading…",
    languageLabel: "Language",
    english: "English",
    spanish: "Español",
    somethingWrong: "Sorry, something went wrong.",
    cancel: "Cancel",
    sealAlt: "Steppe Strata Seal, Redmond, Oregon",
    isomimoAlt: "Steppe gear emblem holding a high-desert landscape",
  },

  nav: {
    home: "Home",
    signIn: "Sign in",
    signOut: "Sign out",
    skipToContent: "Skip to main content",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    verifyLink: "Verify",
    reviewLink: "Reviews",
    neighborhoodLink: "Neighborhood",
    eventsLink: "Events",
    groupsLink: "Groups",
    governanceLink: "Govern",
    exchangeLink: "Exchange",
    appealsLink: "Appeals",
    invitesLink: "Invitations",
    accountLink: "You",
    searchLabel: "Search",
    messagesLabel: "Messages",
    confirmDiscard: "Discard what you've typed?",
  },

  // Redeeming an invitation (/invite and /invite/<token>, migration 0027).
  // Every token failure shares ONE sentence on purpose: unknown, expired,
  // exhausted, and revoked are indistinguishable in the copy because they are
  // indistinguishable in the database's answer. Naming which one it was would
  // let a holder of a photographed card read the state of a campaign they were
  // never given.
  invite: {
    title: "Redeem your invitation",
    subtitle:
      "Enter the code from your card and the email address you want to use. We'll email you a one-time code to finish signing in.",
    tokenLabel: "Invitation code",
    tokenHint: "32 characters, from the card or the link you were sent.",
    emailLabel: "Email address",
    submit: "Redeem and email me a code",
    submitting: "Checking…",
    errorRefused:
      "That invitation can't be used. Check the code, or ask whoever gave it to you.",
    errorRateLimited:
      "Too many tries from this connection just now. Please wait a little while.",
    errorSendFailed:
      "Your invitation worked, but we couldn't email the sign-in code. Try signing in with this address.",
    errorNetwork:
      "We couldn't reach Steppe. Check your connection and try again.",
    privacyNote:
      "We use your email only to sign you in. There are no ads or trackers, and we never sell your information.",
    alreadyMember: "Already have an account?",
    signInLink: "Sign in",
  },

  // Minting and revoking invitations (/protected/invites). Moderator-only.
  invites: {
    title: "Invitations",
    lead: "An invitation is one code that lets a set number of people put their address on the list. Print it on a card, hand it out, and revoke it when the batch is done.",
    mintTitle: "Make a new invitation",
    capLabel: "How many people",
    capHint:
      "The most this code can admit. Also what it costs you if the card is photographed.",
    daysLabel: "Days until it expires",
    daysHint:
      "Every invitation expires. Pick a date you'd be comfortable seeing on paper.",
    labelLabel: "What is this for?",
    labelPlaceholder: "Counter cards, Fred Meyer",
    placeLabel: "Neighborhood (optional)",
    placeNone: "Anywhere (general purpose)",
    placeHint:
      "Leave this alone for counter cards and press. Pick a neighborhood and the pledge page fills itself in.",
    mint: "Make the invitation",
    minting: "Making…",
    mintedTitle: "Made. Here's the link to print:",
    mintedCode: "Code: {code}",
    mintInvalid: "Check the number of people and the number of days.",
    mintForbidden: "Only moderators can make invitations.",
    mintFailed: "We couldn't make that invitation. Please try again.",
    copyUrl: "Copy link",
    copied: "Copied",
    listTitle: "Invitations so far",
    empty: "No invitations yet.",
    unlabeled: "Untitled invitation",
    generalPurpose: "General purpose",
    rowUses: "{used} of {cap} used",
    rowExpires: "expires {date}",
    stateLive: "Live",
    stateRevoked: "Revoked",
    stateExpired: "Expired",
    stateExhausted: "All used",
    revoke: "Revoke",
    revokeConfirm:
      "Revoke this invitation? Nobody else will be able to use the code.",
    revokeNotRetroactive:
      "People who already used it keep their place on the list, and anyone who already made an account keeps it. Revoking closes the door; it doesn't undo what came through it.",
    revokeConfirmButton: "Yes, revoke it",
    revoking: "Revoking…",
    revokeFailed: "We couldn't revoke that invitation. Please try again.",
    cancel: "Keep it",
  },

  auth: {
    title: "Sign in to Steppe",
    subtitle:
      "Steppe is invite-only right now. If your email was invited, this form signs you in and sets up your account the first time. We email a one-time 6-digit code and a sign-in link, so there is no password to remember or leak.",
    emailLabel: "Email address",
    emailPlaceholder: "you@example.com",
    submit: "Email me a sign-in code",
    submitting: "Sending…",
    checkEmailTitle: "Check your email",
    checkEmailBody:
      "If that address can join, we emailed a 6-digit code to {email}. Enter it below. The code and the sign-in link each work once and expire soon.",
    codeLabel: "6-digit code",
    codeVerify: "Sign in with the code",
    codeVerifying: "Checking…",
    codeInvalid:
      "That doesn't look like a 6-digit code. Check the email and try again.",
    codeExpired:
      "That code didn't match or has expired. Request a new one and try again.",
    codeError: "We couldn't check that code. Please try again.",
    codeResend: "Email me a new code",
    codeResent: "New code sent. Check your email again.",
    orTapLink: "Or tap the sign-in link in the same email.",
    sendAnother: "Use a different email",
    errorGeneric: "We couldn't send the link. Check the address and try again.",
    privacyNote:
      "We use your email only to sign you in. See our Terms & Privacy after you continue.",
    errorBody:
      "Something went wrong while signing you in. Please try the link again.",
    errorCode: "Error code: {code}",
    backToSignIn: "Back to sign in",
  },

  welcome: {
    title: "Before you join in",
    intro:
      "These are the Terms of Membership and the Privacy Policy for Steppe. They are short and written in plain language. Read them, then confirm at the bottom to continue.",
    draftNotice:
      "Draft for review. Oregon legal review is pending, and the final wording may change before public launch.",
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
    title: "Welcome to Steppe",
    greeting: "Hello, {name}.",
    consentRecorded:
      "Your agreement to the current Terms & Privacy is on file. Thank you.",
    nextTitle: "What's next",
    nextBody:
      "Verify that you live in Redmond to join neighborhood events and the community vote.",
    readyKicker: "Ready to take part",
    readyTitle: "Your community board is open",
    readyBody:
      "Read what neighbors are sharing, offer what you can, or post what you need. Everything stays newest first.",
    readyCta: "Open the Exchange",
    statusVerified: "Verified resident",
    statusUnverified: "Not yet verified",
    statusLabel: "Membership status",
    verifyCta: "Verify your residency",
    neighborhoodLabel: "Neighborhood",
    noNeighborhood: "Not set",
    neighborhoodCta: "Choose your neighborhood",
    changeCta: "Change",
  },

  install: {
    eyebrow: "Add to home screen",
    why: "Open Steppe like an app. No download or app store is required.",
    installCta: "Install",
    // Spelled in words on purpose — never depend on a rendered share glyph.
    iosHow: "Tap the Share button, then Add to Home Screen.",
    dismiss: "Not now",
    rowLabel: "Add to home screen",
  },

  neighborhoods: {
    title: "Your neighborhood",
    intro:
      "Pick the Redmond neighborhood you call home. You can change this any time.",
    legend: "Choose your neighborhood",
    noneOptionLabel: "None of these fit",
    noneOptionHint:
      "Choose this if your part of Redmond is not listed, including a broader area, a rural pocket, or a community outside city limits. A neighbor on the team will follow up to help place you.",
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

  exchange: {
    edit: "Edit post",
    save: "Save changes",
    delete: "Delete post",
    deleteConfirm: "Delete this post? This cannot be undone.",
    keep: "Keep post",
    deleted: "Post deleted.",
    saved: "Changes saved.",
    tagsHint: "Choose one or more tags. Events use a separate form.",
    descriptions: {
      need: "Ask for something you need, such as help, a skill, or an item.",
      offer:
        "Share something you can offer, such as your time, a skill, or an item.",
      aid: "Coordinate practical support for a neighbor or the community.",
      job: "Share paid work or a job opportunity.",
      goods: "Offer or request physical items. Arrange exchanges directly.",
    },
    // The Exchange (X1) — bundle strings verbatim (spec §2), except G-6:
    // the bundle's "stewards" is normalized to the app's moderator vocabulary
    // (DECISIONS.md 2026-07-12). Dateline drops the preview's fake date.
    title: "The Exchange",
    dateline: "Member-owned · No ads",
    voice:
      "Posted by verified neighbors · newest first · nothing sorted for clicks.",
    all: "All",
    cats: {
      need: "Need",
      offer: "Offer",
      event: "Event",
      aid: "Mutual aid",
      job: "Job",
      goods: "Goods",
    },
    pinned: "Pinned by moderators",
    verified: "Verified neighbor",
    postNew: "New post",
    post: "Post",
    searchPh: "Search the Exchange",
    searchSubmit: "Search",
    emptyTitle: "No posts in this category",
    emptySub: "Nothing in this filter yet. Check back, or post the first.",
    categoryField: "Tags",
    titleField: "Title",
    titlePh: "A short, clear title",
    bodyField: "Details",
    bodyPh: "Add what a neighbor would want to know.",
    hoodField: "Neighborhood",
    composeToPrefix: "To ",
    toastPosted: "Posted · newest first",
    toastPostedGroup: "Posted to ",
    pull: "Pull to refresh",
    release: "Release to refresh",
    updating: "Updating…",
    updated: "Updated just now",
    segBoard: "Board",
    titleRequired: "Please add a title.",
    bodyRequired: "Please add the details.",
    errorGeneric: "Something went wrong. Please try again.",
    gateTitle: "Verify to read and post on the Exchange",
    gateBody:
      "The Exchange is the community board for verified Redmond residents. Verify your residency to read it and post to it.",
    gateCta: "Verify your residency",
    backToBoard: "Back to the Exchange",
    newTitle: "New post",
    newIntro:
      "Posts appear newest first for every verified member. Nothing is sorted for clicks.",
    eventChipHint: "Events have their own form for dates, place, and RSVPs.",
    segUpcoming: "Upcoming",
    upcomingEmpty: "Nothing is on the calendar yet. Post the first gathering.",
  },

  events: {
    manage: "Manage your event",
    edit: "Edit event",
    backToEvent: "Back to event",
    save: "Save changes",
    saving: "Saving…",
    saved: "Event changes saved.",
    editNotice:
      "Existing RSVPs will be kept. If the time or place changes, let attendees know.",
    delete: "Delete event",
    keep: "Keep event",
    deleteConfirm:
      "Delete this event and all its RSVPs? This cannot be undone.",
    calendarNotice:
      "This removes the event from Steppe. Calendar subscriptions update when the calendar app refreshes; previously imported copies may need to be removed manually.",
    deleted: "Event deleted.",
    deleteError: "The event could not be deleted. Refresh and try again.",
    updateError: "Your changes could not be saved. Refresh and try again.",
    capacityInvalid:
      "Enter a whole-number capacity between 1 and 10,000, or leave it blank.",

    usedBefore: "Used in Steppe",
    publicPlace: "Public place",
    searching: "Finding places…",
    locationUnavailable:
      "Public search is unavailable. You can still enter a place and address.",
    locationManual:
      "No suggestions yet. You can enter a place and address yourself.",
    locationPrivacy:
      "Public place search uses Photon; only the search text is shared.",
    timeZone:
      "Pacific time (Redmond, Oregon). Daylight saving time is handled automatically.",
    copyField: "Copy",
    fieldCopied: "Copied",
    copyDetails: "Copy event details",
    copied: "Event details copied.",
    copyFailed: "Select and copy the text below.",
    endLabel: "Ends",
    fieldEnd: "End date and time (optional)",
    locationHelp: "Include the venue name, street address, and meeting point.",
    noAutoRsvp:
      "Creating an event does not RSVP for you. Choose an RSVP on the event page.",
    tooLong: "One or more fields exceed their character limit.",
    // Masthead grammar (preview vocabulary): mono dateline + italic voice.
    dateline: "Neighborhood gatherings · Soonest first",
    voice: "Real gatherings by verified neighbors. RSVP with one tap.",
    listTitle: "Neighborhood events",
    listIntro:
      "Upcoming gatherings, soonest first. Events in your neighborhood come first, then the rest of Redmond.",
    create: "Create event",
    inYourNeighborhood: "In your neighborhood",
    acrossRedmond: "Across Redmond",
    upcomingTitle: "Upcoming events",
    empty: "No upcoming events yet. Be the first to create one.",
    allRedmond: "All of Redmond",
    chipEvent: "Event",
    addCal: "Add to calendar",
    icsNote: "Add to your calendar or copy these details",
    icsDescription: "A Steppe community event. RSVPs stay inside Steppe.",
    hostedBy: "Hosted by {name}",
    whenLabel: "When",
    whereLabel: "Where",
    capacityLabel: "Limited spots",
    capacityValue: { one: "{count} spot", other: "{count} spots" },
    noLocation: "Location to be announced",
    backToEvents: "← All events",
    newTitle: "Create an event",
    newIntro: "Host a neighborhood gathering. Add a title, date, and place.",
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
    whenRequired:
      "Choose a valid Pacific date and time. The end must be after the start; the skipped spring-forward hour cannot be used.",
    errorGeneric: "We couldn't create the event. Please try again.",
    gateTitle: "Verify to join neighborhood events",
    gateBody:
      "Neighborhood events are for verified Redmond residents. Verify your residency to see and create gatherings.",
    gateCta: "Verify your residency",
  },

  messages: {
    // M1 (messages-m1-spec) — DMs, context-anchored, text-only. The bundle's
    // reserved strings are un-reserved here: msgInside (the privacy line, in
    // three homes), composePrivacy (the composer), the two Message buttons.
    title: "Messages",
    dateline: "Verified neighbors · Private to the two of you",
    voice:
      "Messages stay inside Steppe. They are never sent by SMS or email, and no one else can read them.",
    msgInside: "Messages stay inside Steppe",
    composePrivacy:
      "Your contact stays inside Steppe. Neighbors reach you here, never by SMS or email.",
    rowSub: "Your conversations",
    emptyTitle: "No messages yet",
    emptySub: "Say hello to a neighbor from one of their posts.",
    // The composer door on post detail.
    messageAuthor: "Message {name}",
    composerHint: "Start a conversation about this post.",
    placeholder: "Write a message…",
    send: "Send",
    starting: "Sending…",
    sent: "Message sent · stays inside Steppe",
    error: "We couldn't send that. Please try again.",
    reachError: "This neighbor can't be reached right now.",
    // Thread view.
    reAbout: "Re: {title}",
    reGone: "About a post that's no longer here",
    replyPlaceholder: "Write a message…",
    sentTag: "Sent",
    formerMember: "Former member",
    backToMessages: "← Messages",
    backAria: "Back to messages",
    unread: "Unread",
    youPrefix: "You",
    conversation: "Conversation",
    // Thread menu (bundle's four verbs, G-6 normalized — NO "notified" copy).
    menuMore: "Conversation options",
    mute: "Mute this conversation",
    unmute: "Unmute this conversation",
    muted: "Muted. You won't be notified.",
    leave: "Leave conversation",
    block: "Block neighbor",
    blockConfirm:
      "Block this neighbor? They won't be able to message you, and you won't message them. They aren't told.",
    blockCta: "Block",
    reportThread: "Report to a moderator",
    reportThreadConfirm:
      "Send this conversation to a moderator? They will see only the messages you quote here.",
    reportThreadLabel: "What should a moderator know?",
    reportThreadCta: "Send report",
    reportThreadSent: "Sent to a moderator, privately.",
    cancel: "Cancel",
  },

  calendar: {
    // My Calendar (calendar-c1-spec §1.1): masthead grammar — mono dateline
    // (2026-07-12 amendment: "Your groups and your RSVPs", house · separators)
    // + the one italic voice line.
    title: "My calendar",
    rowSub: "Your RSVPs and your groups' gatherings",
    dateline: "Your groups · Your RSVPs",
    voice:
      "Your gatherings in one column: what you answered and where you belong.",
    maybeTag: "Maybe",
    // Agenda | Month toggle + the month grid (spec §1.2–1.3).
    segAgenda: "Agenda",
    segMonth: "Month",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    hasEvents: "events scheduled",
    emptyTitle: "Nothing on your calendar yet",
    emptySub: "RSVP to a gathering, or join a group.",
    gateTitle: "Verify to see your calendar",
    gateBody:
      "Your calendar fills with your RSVPs and your groups. Both require verification.",
    gateCta: "Verify your residency",
    // Connect to calendar — subscription feeds (spec §1.4). Capability
    // language stays plain: the link is a key.
    connectHeading: "Connect to calendar",
    connectBody:
      "A private link your calendar app checks for updates. Anyone who has the link can read that calendar, so treat it like a key. You can replace or remove it here anytime.",
    createLink: "Create calendar link",
    pasteLabel: "Paste into your calendar app",
    lastRead: "Last read {when}",
    neverRead: "Never read",
    rotate: "Replace link",
    rotateConfirm:
      "Replace this link? Apps using the old one stop updating until you paste the new one.",
    rotateCta: "Replace it",
    remove: "Remove",
    removeConfirm: "Remove this link? Apps using it stop updating.",
    removeCta: "Remove it",
    groupConnect: "Connect to your calendar",
    feedError: "We couldn't update your calendar links. Please try again.",
  },

  groups: {
    // Directory — dateline + voice are the bundle's own strings.
    dateline: "Neighborhood circles · Member-owned",
    voice: "Small groups of verified neighbors. Join freely and leave anytime.",
    title: "Groups",
    intro:
      "Community groups have boards, calendars, and events. Browse by category or search by name.",
    create: "Create group",
    searchLabel: "Search",
    searchPlaceholder: "Search groups by name",
    categoryLabel: "Category",
    allCategories: "All categories",
    searchSubmit: "Search",
    empty: "No groups match. Try a different search, or create one.",
    visibilityPublic: "Public",
    visibilityMembersOnly: "Members only",
    upcomingSection: "Upcoming",
    memberCount: { one: "{count} member", other: "{count} members" },
    everyoneMembers: "Every verified member",
    // Membership controls
    join: "Join",
    requestToJoin: "Request to join",
    inviteOnly: "Invite only",
    pending: "Request pending",
    invited: "Invited",
    member: "Member",
    manage: "Manage",
    joining: "Joining…",
    joinError: "We couldn't complete that. Please try again.",
    leave: "Leave group",
    leaving: "Leaving…",
    confirmLeave:
      "Leave this group? You'll lose access to its members-only posts and events.",
    leaveError: "We couldn't leave the group. Please try again.",
    leaveLastMaintainer:
      "You're the only maintainer. Make someone else a maintainer before you leave.",
    // Group page
    aboutTitle: "About",
    noDescription: "No description yet.",
    lockedAbout:
      "This is a members-only group. Join to see its content and members.",
    membersTitle: "Members",
    membersLockedNote: "Members are visible once you join.",
    membersEmpty: "No members yet.",
    roleMaintainer: "Maintainer",
    // Create group
    backToGroups: "← All groups",
    newTitle: "Create a group",
    newIntro:
      "Start a group for your neighborhood, interest, or need. You'll be its first maintainer.",
    fieldName: "Name",
    fieldNamePlaceholder: "e.g. Canyon Crossing Tool Library",
    fieldDescription: "Description (optional)",
    fieldDescriptionPlaceholder: "What is this group for? Who is it for?",
    fieldCategory: "Category",
    noCategory: "No category",
    suggestLabel: "Suggest a new category",
    suggestPlaceholder: "Suggest a new category",
    suggestAdd: "Add",
    suggesting: "Adding…",
    suggestError: "We couldn't add that category. Please try again.",
    fieldPreset: "Who can see and join?",
    presetPublicBoard: "Public board",
    presetPublicBoardHint: "Anyone can see it and join instantly.",
    presetCurated: "Curated",
    presetCuratedHint: "Anyone can see it; a maintainer approves each join.",
    presetPrivate: "Private",
    presetPrivateHint: "Members only; people join by invitation.",
    presetAdvanced: "Advanced",
    presetAdvancedHint: "Set visibility and join policy separately.",
    fieldVisibility: "Visibility",
    fieldJoinPolicy: "Join policy",
    joinOpen: "Open: join instantly",
    joinRequest: "Request: a maintainer approves",
    joinLocked: "Locked: invite only",
    creating: "Creating…",
    createSubmit: "Create group",
    nameRequired: "Please add a group name.",
    nameTaken: "That name is taken. Please choose another.",
    errorGeneric: "We couldn't create the group. Please try again.",
    // Maintainer console
    backToGroup: "← Back to group",
    manageTitle: "Manage group",
    manageIntro: "Edit settings and manage members. You're a maintainer here.",
    settingsTitle: "Settings",
    saveSettings: "Save settings",
    saving: "Saving…",
    settingsSaved: "Settings saved.",
    settingsError: "We couldn't save the settings. Please try again.",
    pendingTitle: "Join requests",
    pendingIntro: "People waiting to join, oldest first.",
    pendingEmpty: "No pending requests.",
    approve: "Approve",
    deny: "Deny",
    activeTitle: "Members",
    remove: "Remove",
    makeMaintainer: "Make maintainer",
    makeMember: "Make member",
    confirmRemove: "Remove this member from the group?",
    confirmDemote: "Step this maintainer down to a regular member?",
    addTitle: "Add a member",
    addIntro:
      "Add a verified member directly. This is useful for invite-only groups.",
    addEmpty: "No verified members match that name.",
    addSearchHint: "Search by name to add a verified member.",
    addSearching: "Searching…",
    addSelectLabel: "Search verified members to add",
    addSelectPlaceholder: "Search members by name…",
    addButton: "Add",
    lastMaintainerError:
      "A group needs at least one maintainer. Add another before this change.",
    manageError: "We couldn't complete that. Please try again.",
    gateTitle: "Verify to join groups",
    gateBody:
      "Community groups are for verified Redmond residents. Verify your residency to browse, join, and create groups.",
    gateCta: "Verify your residency",
  },

  rsvp: {
    cancelled: "RSVP cancelled.",
    notSaved: "You have not RSVP’d. Choose Going or Maybe, then save.",
    tagGoing: "Your RSVP: Going",
    tagMaybe: "Your RSVP: Maybe",
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
      "Neighborhood events and the community vote are for verified Redmond residents. Choose one way to show you live here, and a neighbor on the review team checks it by hand.",
    forget:
      "We delete your document as soon as a reviewer decides. We keep only the result, date, and method. We never keep the document itself.",
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
      "A reviewer will check it soon. You will get full access once approved. You can safely close this page.",
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
      utility_bill:
        "A recent water, power, gas, or internet bill in your name.",
      voter_reg: "Your Oregon voter registration showing your address.",
      property_record:
        "A property tax statement or deed for your Redmond home.",
      postcard_code:
        "No document is needed. We mail a one-time code to your Redmond address, and a reviewer confirms it with you. This option is for anyone using a PO box or without standard paperwork.",
    },
  },

  review: {
    title: "Verification reviews",
    intro:
      "Pending residency checks, oldest first. A person decides each one. Approving grants verified status and starts the member's tenure. The evidence file is deleted either way.",
    empty: "No verifications are waiting right now.",
    viewEvidence: "View evidence",
    opening: "Opening…",
    noEvidence: "No file (mailed-code request)",
    evidenceError:
      "Couldn't open the evidence. The link may have expired. Try again.",
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
    requestedOn: "Requested {date}",
    markResolved: "Mark resolved",
    resolving: "Saving…",
    resolveError: "Couldn't update that. Please try again.",
  },

  governance: {
    // Dateline is the bundle's; the voice drops its "turnout shown while open"
    // clause — that surface doesn't exist here yet (parity G1). Stay truthful.
    dateline: "The community's public record · Everyone starts at 1×",
    voice:
      "Secret ballots. Everyone starts at 1×; weight accrues with tenure (1×–3×, member-amendable).",
    segProposals: "Proposals",
    segRecord: "Record",
    listTitle: "Proposals & votes",
    listIntro:
      "Community proposals and their voting windows appear here. Open votes come first, followed by upcoming and closed votes. Your ballot is secret until a vote closes; results appear only afterward.",
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
      "Put a decision to the community. Set when voting opens and closes. Both use Redmond time.",
    fieldTitle: "Title",
    fieldTitlePlaceholder: "e.g. Adopt the community garden plan",
    fieldKind: "Type of decision",
    fieldKindHint:
      "Bigger decisions need more agreement to pass. The community decides exactly how much.",
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
    foundationalNotice:
      "A foundational proposal must be published at least 30 days before voting opens.",
    errorGeneric: "We couldn't create the proposal. Please try again.",
    voteHeading: "Your vote",
    voteSecrecyNote:
      "Your ballot is secret. Only you can see it, and you can change it until voting closes. No results are shown before then.",
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
      "Tenure-weighted totals are shown only in aggregate. Individual ballots are never shown.",
    turnout: { one: "{count} ballot cast", other: "{count} ballots cast" },
    noResult: "No result is available for this proposal.",
    resultsTooLowTurnout:
      "Too few people voted to show the breakdown without revealing how individuals voted. Only the turnout above is shown.",
    outcomes: {
      passed: "Passed",
      failed: "Did not pass",
      insufficient_turnout: "Not binding: participation requirement not met",
    },
    participationRule:
      "{required} ballots required from {eligible} eligible members",
    approvalRule:
      "{approval}% approval among weighted yes/no votes · {required}% required",
    noDecisiveVotes: "No weighted yes/no votes were cast.",
    closeHint:
      "Voting has ended. Recording the close writes the official result to the public audit log.",
    recordClose: "Record official close",
    recording: "Saving…",
    closeError: "Couldn't record the close. Please try again.",
  },

  moderation: {
    removedTitleEvent: "This event was removed by a moderator.",
    removedTitleProposal: "This proposal was removed by a moderator.",
    removedTitlePost: "This post was removed by a moderator.",
    removedReason: "Reason",
    appealable: "If you posted this, you can appeal.",
    controlHeading: "Moderator tools",
    reasonLabel: "Reason (required; shown to the member and in the public log)",
    reasonPlaceholder: "Why is this being removed or restored?",
    removeConfirm:
      "Remove this content? The reason will be visible to the member and in the public transparency log.",
    removeSubmit: "Remove",
    restoreSubmit: "Restore",
    working: "Saving…",
    reasonRequired: "Please write a reason.",
    error: "We couldn't record that. Please try again.",
    // Member reports (0021 — messages-m1-spec §2). Moderator vocabulary per
    // the G-6 ruling; the confirmation is identical every time (no oracle).
    reportButton: "Report",
    reportLabel: "What should a moderator know?",
    reportPlaceholder: "Say what's wrong, plainly.",
    reportPrivacyNote: "Only moderators see this",
    reportSubmit: "Send report",
    reportSent: "Sent to a moderator, privately.",
    reportError: "We couldn't send that. Please try again.",
    reportsTitle: "Member reports",
    reportsIntro:
      "What neighbors flagged, oldest first. Act on the content from its page, then resolve the report.",
    reportsEmpty: "No open reports.",
    reportBy: "From {name} · {date}",
    reportTargetGone: "Content no longer available",
    reportActioned: "Resolve: actioned",
    reportDismissed: "Resolve: dismissed",
    reportOnThread: "A conversation",
    reportExcerptLabel: "Quoted by the reporter (they chose what to share):",
    appealsQueueTitle: "Appeals",
    noticesTitle: "Moderation notices",
    noticeEventRemoved: 'Your event "{title}" was removed by a moderator.',
    noticePostRemoved: 'Your post "{title}" was removed by a moderator.',
    noticeProposalRemoved:
      'Your proposal "{title}" was removed by a moderator.',
    noticeView: "View details and appeal",
    appealHeading: "Appeal this removal",
    appealPlaceholder: "Explain why this should be restored…",
    appealSubmit: "Submit appeal",
    appealSubmitting: "Submitting…",
    appealError: "We couldn't submit your appeal. Please try again.",
    appealStatusOpen: "A different moderator is reviewing your appeal.",
    appealStatusUpheld: "After review, the removal was upheld.",
    appealStatusOverturned:
      "After review, the removal was overturned and the content restored.",
    appealsTitle: "Appeals",
    appealsIntro:
      "Open appeals from members appear oldest first. A different moderator must resolve an appeal of your own action.",
    appealsEmpty: "No open appeals.",
    appealOnEvent: "Removal of an event",
    appealOnPost: "Appeal on a removed post",
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
      "A public record lists moderator actions, reasons, and appeal outcomes. This keeps moderation in the open.",
    empty: "No moderation activity yet.",
    actionRemoveEvent: "An event was removed",
    actionRemoveProposal: "A proposal was removed",
    actionRemoveGeneric: "Content was removed",
    actionRestoreEvent: "An event was restored",
    actionRestoreProposal: "A proposal was restored",
    actionRestoreGeneric: "Content was restored",
    appealUpheld: "Appeal reviewed: removal stands",
    appealOverturned: "Appeal reviewed: content restored",
    reason: "Reason",
    byModerator: "by {name}",
    byModeratorUnknown: "by a moderator",
    viewContent: "View",
  },
  account: {
    saveChanges: "Save changes",
    unsaved: "Unsaved changes",
    visibilitySaved: "Visibility saved.",
    voice: "Your profile starts private. You choose what neighbors see.",
    title: "Your account",
    intro:
      "Your data is yours. Take a copy whenever you like, or close your account and go.",
    exportHeading: "Export your data",
    exportBody:
      "Download your profile, RSVPs, proposals, your own ballots, and other account data as a single file. Verification documents are never kept.",
    exportButton: "Download my data",
    deleteHeading: "Delete your account",
    deleteBody:
      "This permanently closes your account and erases your personal information. It cannot be undone.",
    deleteKept:
      "Kept, but no longer linked to you: your past votes, any moderation record, and the terms you agreed to stay in the community's permanent record as “Former member,” so closed results and agreements are never rewritten.",
    deleteErased:
      "Erased for good: your profile, your RSVPs, the events you created, your calendar links, your reports, the messages you sent, your verification status, and your neighborhood. Conversation threads with no remaining messages are also removed.",
    deleteIrreversible:
      "There is no undo, and no way to sign back in afterward.",
    deleteConfirmLabel: "Type {word} to confirm",
    deleteConfirmWord: "DELETE",
    deleteButton: "Delete my account",
    deleting: "Deleting…",
    deleteError: "We couldn't delete your account. Please try again.",
    // Profile editor (Y1) — the "You" surface's name + per-field visibility.
    profileRow: "Edit profile",
    profileRowSub: "Your name, and what neighbors can see",
    verifiedMeta: "Verified, then forgotten",
    unverifiedMeta: "Verification not complete",
    verifiedPrivacyNote:
      "Your identity was verified once, then forgotten. Neighbors see only what you choose below.",
    unverifiedPrivacyNote:
      "Your profile starts private. Verify when you are ready to join member-only spaces.",
    editPublic: "Edit what's public",
    verifyRowSub: "Confirm that you live in Redmond",
    groupsRow: "Your groups",
    groupsRowSub: "Browse, join, and manage your groups",
    governanceRow: "Your governance",
    governanceRowSub: "Your participation and ballots stay private",
    neighborhoodRowSub: "Your Redmond neighborhood",
    dataRow: "Your data",
    dataRowSub: "Download a copy anytime",
    profileTitle: "Your profile",
    profileIntro:
      "Your profile starts private. Set your name, then choose which fields all members can see.",
    nameLabel: "Display name",
    nameHelp: "The name neighbors see. It does not have to be your legal name.",
    nameSave: "Save name",
    nameSaved: "Name saved.",
    nameRequired: "Enter a name.",
    nameTooLong: "That name is too long.",
    profileSaveError: "We couldn't save that. Please try again.",
    visibilityHeading: "What neighbors can see",
    visibilityIntro:
      "Every field starts hidden. Choose which fields all members can see and which stay private.",
    fieldNeighborhood: "Neighborhood",
    fieldNeighborhoodNone: "Not set",
    visHidden: "Hidden",
    visMembers: "Visible to members",
    visStateHidden: "Hidden from other members",
    visStateMembers: "Visible to all members",
    visSaved: "Saved.",
  },
  notFound: {
    title: "We couldn't find that page",
    body: "The link might be old, or the page may have moved. Let's get you back to familiar ground.",
    back: "Back to Steppe",
  },
  error: {
    title: "Something went wrong on our end",
    body: "We couldn't load this page. Try again. If it keeps happening, contact support.",
    retry: "Try again",
    back: "Back to Steppe",
  },
};

export type Dictionary = typeof en;
