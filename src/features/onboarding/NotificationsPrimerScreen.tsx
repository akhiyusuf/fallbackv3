/** S07 — onboarding step 6. Permission primer: "Allow" on top, "Not now" below (D11). */
import { useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useSettings, useUpdateSettings } from '@/queries';
import { initNotificationsBridge, notifications } from '@/services/notifications';
import { initWidgetsBridge } from '@/services/widgets';
import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { ButtonPair, Card } from '@/ui';

import { S07_COPY } from './copy';
import { OnboardingShell } from './OnboardingShell';
import { useOnboardingStepMarker } from './useOnboardingResume';
import { Text } from '@/ui/AppText';

export function NotificationsPrimerScreen() {
  const t = useTheme();
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  useOnboardingStepMarker('/onboarding/notifications-primer');

  useEffect(() => {
    initNotificationsBridge();
    initWidgetsBridge();
  }, []);

  function proceed() {
    // Pushed, not replaced: this step is always part of the tour now, so Back from the last
    // step returns here and the dots never skip.
    router.push('/onboarding/first-task' as Href);
  }

  /** "Not now" is an answer too: if reminders were on (the person came back and changed their mind), turn them off. */
  async function handleNotNow() {
    const prefs = settingsQuery.data?.notifications;
    if (prefs?.master) await updateSettings.mutateAsync({ notifications: { ...prefs, master: false } });
    proceed();
  }

  async function handleAllow() {
    setRequesting(true);
    const result = await notifications.requestPermission();
    if (result.ok && result.value) {
      // "Allow" has to mean something: switch on the reminders this screen describes (a nudge
      // when something is due, one invitation back after an off day). Without this the master
      // switch was on with every reminder under it off, so nothing was ever sent.
      const prefs = settingsQuery.data?.notifications;
      if (prefs) {
        await updateSettings.mutateAsync({ notifications: { ...prefs, master: true, routineDue: true, eventStarting: true, courseDose: true, gentleReentry: true } });
      }
      void notifications.reschedule();
    }
    setRequesting(false);
    proceed();
  }

  return (
    <OnboardingShell
      step={6}
      icon={Bell}
      headline={S07_COPY.headline}
      body={S07_COPY.body}
      footer={
        <ButtonPair
          primary={{ label: S07_COPY.allow, onPress: () => void handleAllow(), loading: requesting, accessibilityLabel: 'Allow notifications' }}
          secondary={{ label: S07_COPY.notNow, onPress: () => void handleNotNow(), disabled: requesting }}
        />
      }
    >
      <Card accessibilityLabel={`Sample notification: ${S07_COPY.previewTitle}. ${S07_COPY.previewBody}`}>
        <View style={styles.previewHeader}>
          <View style={[styles.appIcon, { backgroundColor: t.accent.fill }]}>
            <Bell size={14} color={t.accent.onLarge} accessibilityElementsHidden importantForAccessibility="no" />
          </View>
          <Text style={[styles.previewApp, { color: t.color.textMuted }]}>{S07_COPY.previewApp}</Text>
          <Text style={[styles.previewTimestamp, { color: t.color.textDim }]}>{S07_COPY.previewTimestamp}</Text>
        </View>
        <Text style={[styles.previewTitle, { color: t.color.text }]}>{S07_COPY.previewTitle}</Text>
        <Text style={[styles.previewBody, { color: t.color.textMuted }]}>{S07_COPY.previewBody}</Text>
      </Card>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  appIcon: { width: 24, height: 24, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  previewApp: { fontSize: FONT_SIZE.xs, fontWeight: '600', flex: 1 },
  previewTimestamp: { fontSize: FONT_SIZE.xs },
  previewTitle: { fontSize: FONT_SIZE.base, fontWeight: '700' },
  previewBody: { fontSize: FONT_SIZE.sm, lineHeight: 20 },
});
