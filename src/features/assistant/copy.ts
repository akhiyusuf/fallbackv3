/**
 * M6. Verbatim copy for S31–S40, S44, S33, S36 —
 * `design-input/fallback-handoff/uploads/ALLSCREENS_1.md`. No paraphrasing.
 */

export const S31_COPY = {
  eyebrow: 'Fallback AI',
  headline: 'What should I set up for you?',
  subcopy: 'Tap & speak — or type below.',
  micCaption: 'Audio is only processed when you tap.',
  chips: ['Add a morning run', 'Water plants Mon & Thu', '10-day meditation', 'Plan my week', 'Add a medication'] as const,
  inputPlaceholder: 'Or type what you need…',
  error: "Couldn't load the assistant right now.",
  retry: 'Retry',
} as const;

export const S32_COPY = {
  followUpPrompt: 'Want to add anything else — a course, an event, a reminder?',
  undoCaption: "Say 'undo' to put it back.",
  recapHeadline: 'All set — here\'s everything from this chat 👇',
  recapFooter: "Close anytime — I'll save this conversation so you can pick it back up. 🌱",
  recapDone: 'Done',
  offline: "Can't reach the assistant. You're offline. Everything you've made is safe on this device — try again in a moment.",
  tryAgain: 'Try again',
  addTaskManually: 'Add a task manually',
  listening: 'Listening…',
  transcribing: 'Transcribing…',
  inputPlaceholder: 'Type your request…',
} as const;

export const S33_COPY = {
  headerLabel: 'Quick check',
  voiceCaption: 'Or just say which one.',
  listening: 'Listening for your answer…',
  reAsk: 'Sorry — which one did you mean?',
  dismissedTurn: 'No worries — let me know which one whenever you\'re ready.',
} as const;

export const S34_COPY = {
  title: 'Conversation history',
  emptyHeadline: 'No conversations yet',
  emptySubcopy: "Start a chat with Fallback AI and it'll show up here, ready to reopen anytime.",
  error: "Couldn't load your conversation history.",
  retry: 'Retry',
} as const;

export const S35_COPY = {
  tasksCreatedLabel: 'Tasks created in this chat',
  continuePlaceholder: 'Continue this chat…',
  error: "Couldn't load this conversation.",
  retry: 'Retry',
} as const;

export const S36_COPY = {
  title: 'Fallback AI options',
  newConversation: 'New conversation',
  conversationHistory: 'Conversation history',
  voiceAndLanguage: 'Voice & language',
  manageSubscription: 'Manage subscription',
  accountAndSync: 'Account & sync',
  help: 'Help',
  languageLabel: 'Language',
  languageValue: 'English (US)',
  voiceLabel: 'Voice',
  voiceValue: 'Warm — default',
  savedToast: 'Saved',
} as const;

export const S37_COPY = {
  reassurance: 'Audio is processed only when you tap the mic.',
  waitingForPermission: 'Waiting for permission…',
  primer: {
    headline: 'Just say what you need.',
    body: 'The microphone powers the voice assistant. Audio is processed only when you tap the mic.',
    secondaryLine: 'Prefer typing? You can skip — the assistant takes text too.',
    primaryAction: 'Enable',
    secondaryAction: 'Not now',
  },
  recovery: {
    headline: 'Turn on the mic to talk.',
    body: 'Enable the microphone in Settings — or just type instead.',
    primaryAction: 'Open Settings',
    secondaryAction: 'Type instead',
  },
} as const;

export const S38_COPY = {
  eyebrow: 'FALLBACK AI',
  storeUnreachable: "Can't reach the App Store right now. Your own AI key still works — no store connection needed.",
  storeUnavailableFinePrint: 'Store unavailable — try again shortly.',
  retry: 'Retry',
  headline: 'Just say it. AI builds it.',
  subcopy: 'Speak naturally — Fallback AI turns it into routines, events & courses, each with an ideal and a fallback.',
  bullets: ['Voice-first — talk, no typing', 'Drafts ideal + fallback for you', 'Bulk-create a whole week at once'] as const,
  cardA: {
    eyebrow: 'SUBSCRIBE',
    heading: 'Fallback AI Subscription',
    price: '$4.99/mo',
    priceSecondary: 'or $39.99/yr — save 33%',
    badge: '7-day free trial',
    cta: 'Start free trial',
    finePrint: 'then $4.99/mo · cancel anytime · Restore Purchases',
    restorePurchases: 'Restore Purchases',
  },
  divider: 'or',
  cardB: {
    eyebrow: 'BRING YOUR OWN KEY',
    heading: 'Use Your Own AI Key',
    description:
      'Already have an OpenAI-compatible API key? Connect it directly — free, no subscription. Your key stays on this device; calls go straight to your provider, never through Fallback\'s servers.',
    bullets: ['Free — no subscription required', 'Works with OpenAI, Groq, local models & more'] as const,
    cta: 'Use Your Own AI Key',
    finePrint: "If your endpoint can't transcribe audio, voice degrades gracefully to text.",
  },
  footerDisclosure:
    'While subscribed, your conversation messages are processed by our AI provider to generate responses — separate from your habit data, which never leaves this device.',
  restoreNoneFound: 'No active subscription found.',
} as const;

export const S39_COPY = {
  title: 'Choose your plan',
  annual: {
    badge: 'SAVE 33%',
    title: 'Annual',
    price: '$3.33/mo',
    billed: 'billed yearly',
    strikeFrom: '$59.88',
    strikeTo: '$39.99/yr',
  },
  monthly: {
    title: 'Monthly',
    price: '$4.99/mo',
    billed: 'billed monthly',
  },
  subcopy: '7 days free, then auto-renews. Cancel anytime.',
  confirmIos: 'Confirm with Face ID',
  confirmAndroid: 'Confirm with fingerprint',
  verifying: 'Verifying…',
  success: 'Trial started — 7 days free 🎉',
  biometricFailed: "Face ID didn't recognize you — try again, or use your device passcode.",
  purchaseError: "Couldn't complete the purchase. Nothing was charged — try again.",
  retry: 'Retry',
  finePrint:
    'Payment will be charged to your Apple ID / Google Play account at confirmation. Auto-renews unless cancelled at least 24 hours before the trial ends. Manage or cancel anytime in App Store / Google Play Settings.',
} as const;

export const S40_COPY = {
  title: 'Use Your Own AI Key',
  intro:
    'Connect any OpenAI-compatible endpoint — OpenAI, Groq, a local model server, or another provider. Your key is stored only on this device; requests go straight to your provider, never through Fallback\'s servers.',
  baseUrlLabel: 'API base URL',
  baseUrlPlaceholder: 'https://api.openai.com/v1',
  baseUrlHelper: 'The base URL of an OpenAI-compatible chat-completions API.',
  apiKeyLabel: 'API key',
  apiKeyPlaceholder: 'sk-…',
  apiKeyHelper: 'Stored only on this device — never sent anywhere but your provider.',
  save: 'Save & Connect',
  connecting: 'Connecting…',
  invalid: "Couldn't verify this endpoint. Double-check the URL and key, then try again.",
  successFull: 'Connected — you\'re all set.',
  successFullSub: 'Taking you to Fallback AI…',
  successDegraded:
    "Saved — this endpoint doesn't support voice, so you'll type instead. You can switch modality anytime in the assistant.",
} as const;

export const S44_COPY = {
  title: 'Manage subscription',
  activeBadge: 'Active',
  freeBadge: 'Free plan',
  planMonthly: 'Fallback AI · Monthly',
  planAnnual: 'Fallback AI · Annual',
  renewsPrefix: 'Renews',
  trialEndsPrefix: 'Trial ends in',
  trialSuffix: 'days, then $4.99/mo',
  trialActiveUnknown: 'Your free trial is active.',
  freeFraming: "You're on the free plan. Free tier keeps every core feature — Fallback AI is optional.",
  segmentMonthly: 'Monthly · $4.99/mo',
  segmentAnnual: 'Annual · $39.99/yr · Save 33%',
  confirmChange: 'Confirm change',
  startFreeTrial: 'Start free trial',
  cancelHeading: 'Cancel subscription',
  manageIos: 'Manage in App Store',
  manageAndroid: 'Manage on Google Play',
  manageHelper: 'Billing is handled by Apple/Google Play. Cancel anytime — access lasts through the paid period.',
  restore: 'Restore purchases',
  restoreHelper: 'Re-checks your store account for an active subscription — no sign-in needed.',
  restoreSuccess: 'Restored — Fallback AI is active',
  restoreNone: 'No active subscription found on this account.',
  errorStore: "Couldn't reach the store — try again.",
  opensAppStore: 'Opens the App Store',
} as const;
