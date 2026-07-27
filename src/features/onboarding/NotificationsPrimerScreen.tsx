/** S07 — Notification Permission Primer. route: /onboarding/notifications-primer. Features: F9, F14. */
import { useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { initNotificationsBridge, notifications } from '@/services/notifications';
import { initWidgetsBridge } from '@/services/widgets';
import { SPACE, useTheme } from '@/theme';
import { Button, Card } from '@/ui';

import { S07_COPY } from './copy';
import { useOnboardingStepMarker } from './useOnboardingResume';

export function NotificationsPrimerScreen() {
  const t = useTheme();
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);
  useOnboardingStepMarker('/onboarding/notifications-primer');

  // Review pass 1, blocking item 1: idempotent, safe on every M7-owned screen's mount — arms
  // both bridges for a session that reaches S07 without having passed through an earlier
  // M7 screen (S07 is reachable straight from a resumed-after-kill S06).
  useEffect(() => {
    initNotificationsBridge();
    initWidgetsBridge();
  }, []);

  async function proceed() {
    router.replace('/onboarding/first-task' as Href);
  }

  async function handleAllow() {
    setRequesting(true);
    // F9: fully usable if declined — the OS outcome (granted or denied) never forks the flow,
    // it only forks whether reminders will actually fire later (S07's own spec, Interactions).
    const result = await notifications.requestPermission();
    // A permission GRANT alone emits no bus event — nothing else re-arms in this session
    // without an explicit re-arm here (review pass 1, blocking item 1).
    if (result.ok && result.value) void notifications.reschedule();
    setRequesting(false);
    await proceed();
  }

  async function handleNotNow() {
    await proceed();
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <View style={styles.content}>
        <Bell size={40} color={t.accent.base} accessibilityElementsHidden importantForAccessibility="no" />
        <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
          {S07_COPY.headline}
        </Text>
        <Text style={[styles.body, { color: t.color.textMuted }]}>{S07_COPY.body}</Text>

        <Card
          accessibilityLabel={`Sample notification: ${S07_COPY.previewTitle} — ${S07_COPY.previewBody}`}
        >
          <View style={styles.previewHeader}>
            <View style={[styles.appIcon, { backgroundColor: t.color.surface }]}>
              <Bell size={14} color={t.color.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
            </View>
            <Text style={[styles.previewApp, { color: t.color.text }]}>{S07_COPY.previewApp}</Text>
            <Text style={[styles.previewTimestamp, { color: t.color.textDim }]}>{S07_COPY.previewTimestamp}</Text>
          </View>
          <Text style={[styles.previewTitle, { color: t.color.text }]}>{S07_COPY.previewTitle}</Text>
          <Text style={[styles.previewBody, { color: t.color.textMuted }]}>{S07_COPY.previewBody}</Text>
        </Card>
      </View>

      <View style={styles.footer}>
        <Button
          label={S07_COPY.allow}
          onPress={handleAllow}
          loading={requesting}
          accessibilityLabel="Allow notifications, button"
          fullWidth
        />
        <Button label={S07_COPY.notNow} onPress={handleNotNow} variant="ghost" accessibilityLabel="Not now, button" fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, padding: SPACE.s3, gap: SPACE.s2 },
  headline: { fontSize: 28, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1 },
  appIcon: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  previewApp: { fontSize: 13, fontWeight: '600', flex: 1 },
  previewTimestamp: { fontSize: 12 },
  previewTitle: { fontSize: 15, fontWeight: '700' },
  previewBody: { fontSize: 14, lineHeight: 20 },
  footer: { padding: SPACE.s3, gap: SPACE.s1 },
});
