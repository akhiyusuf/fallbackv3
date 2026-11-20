/**
 * Who asked to send an opening message. The chat screen's `opening` link parameter can come from
 * anywhere (any app can open fallback://), so on its own it only fills the message box. A button
 * inside Fallback (a suggestion chip, Send on the assistant home, Continue in History) marks the
 * text here first; only a marked text is sent straight away. The mark lives in memory, so a link
 * from outside can never carry one, and it is used once.
 */
let pending: string | null = null;

export function markInAppOpening(text: string): void {
  pending = text;
}

/** True once for the exact text a button inside the app marked; clears the mark either way. */
export function takeInAppOpening(text: string): boolean {
  const ok = pending !== null && pending === text;
  pending = null;
  return ok;
}
