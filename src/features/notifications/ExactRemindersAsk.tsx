/**
 * Asks once, on an Android phone where reminders would otherwise arrive late, to let Fallback ring
 * them on the minute. Shown only when notifications are allowed and exact timing is off; "Allow"
 * opens Android's own page for it, and either answer means it is never asked again (Settings >
 * Notifications keeps a row for it).
 */
import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

import { notifications } from '@/services/notifications';
import { exactRemindersAllowed, openExactReminderSettings } from '@/services/exactAlarms';
import { ConfirmSheet } from '@/ui';

export const EXACT_ASKED_KEY = 'fallback.exactRemindersAsked';

export const EXACT_REMINDERS_COPY = {
  title: 'Get reminders right on time',
  body: 'Android can hold reminders back by a few minutes to save battery. Allow Fallback to ring them at the exact time you set.',
  allow: 'Allow',
  notNow: 'Not now',
} as const;

async function alreadyAsked(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(EXACT_ASKED_KEY)) === '1';
  } catch {
    return true; // no store to remember the answer in: never risk asking over and over
  }
}

async function rememberAsked(): Promise<void> {
  try {
    await SecureStore.setItemAsync(EXACT_ASKED_KEY, '1');
  } catch {
    /* asked for this run only */
  }
}

export function ExactRemindersAsk() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (exactRemindersAllowed()) return;
      if (await alreadyAsked()) return;
      const permitted = await notifications.hasPermission().catch(() => false);
      if (!cancelled && permitted) setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function close() {
    setVisible(false);
    void rememberAsked();
  }

  return (
    <ConfirmSheet
      visible={visible}
      onClose={close}
      title={EXACT_REMINDERS_COPY.title}
      message={EXACT_REMINDERS_COPY.body}
      confirmLabel={EXACT_REMINDERS_COPY.allow}
      cancelLabel={EXACT_REMINDERS_COPY.notNow}
      onConfirm={() => {
        openExactReminderSettings();
        close();
      }}
      testID="exact-reminders-ask"
    />
  );
}
