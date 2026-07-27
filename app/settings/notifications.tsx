/**
 * S42 — Notifications Settings    route: /settings/notifications
 * Owner: M7. Features: F14.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S42)
 */
import { useEffect } from 'react';
import { useRouter, type Href } from 'expo-router';
import { BellOff } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useToastStore } from '@/app-shell';
import { S42_COPY } from '@/features/settings/copy';
import { SettingsHeader } from '@/features/settings/SettingsHeader';
import { useSettings, useUpdateSettings } from '@/queries';
import { initNotificationsBridge } from '@/services/notifications';
import { initWidgetsBridge } from '@/services/widgets';
import { SPACE, useTheme } from '@/theme';
import { Card, EmptyState, Select, Skeleton, Switch } from '@/ui';
import type { NotificationPrefs } from '@/types';

const DIGEST_TIME_OPTIONS = [
  { value: '06:00', label: '6:00 AM' },
  { value: '07:00', label: '7:00 AM' },
  { value: '08:00', label: '8:00 AM' },
  { value: '09:00', label: '9:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '21:00', label: '9:00 PM' },
];

export default function S42NotificationsSettings() {
  const t = useTheme();
  const router = useRouter();
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const showToast = useToastStore((s) => s.show);

  // Review pass 1, blocking item 1: idempotent, safe on every M7-owned screen's mount — S42's
  // toggles emit `settings:changed` into the bus, which needs a live subscriber to do anything.
  useEffect(() => {
    initNotificationsBridge();
    initWidgetsBridge();
  }, []);

  function handleBack() {
    router.push('/settings' as Href);
  }

  async function patchPrefs(patch: Partial<NotificationPrefs>) {
    const current = settingsQuery.data?.notifications;
    if (!current) return;
    const next = { ...current, ...patch };
    const result = await updateSettings.mutateAsync({ notifications: next });
    if (!result.ok) showToast(S42_COPY.errorToast, 'warning');
  }

  const prefs = settingsQuery.data?.notifications;

  if (settingsQuery.isLoading || !prefs) {
    return (
      <View style={[styles.root, { backgroundColor: t.color.bg }]}>
        <SettingsHeader title={S42_COPY.title} onBack={handleBack} />
        <View style={styles.content}>
          <Skeleton height={56} />
          <Skeleton height={140} />
          <Skeleton height={100} />
        </View>
      </View>
    );
  }

  const allSubsOff =
    !prefs.routineDue &&
    !prefs.eventStarting &&
    !prefs.courseDose &&
    !prefs.courseEndingSoon &&
    !prefs.gentleReentry &&
    !prefs.milestoneReached &&
    !prefs.dailyDigest;

  const masterOff = !prefs.master; // Trigger A
  const triggerB = prefs.master && allSubsOff;

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <SettingsHeader title={S42_COPY.title} onBack={handleBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card accessibilityLabel={S42_COPY.masterLabel}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: t.color.text }]}>{S42_COPY.masterLabel}</Text>
            <Switch
              value={prefs.master}
              onValueChange={(v) => patchPrefs({ master: v })}
              accessibilityLabel={`${S42_COPY.masterLabel}, ${prefs.master ? 'on' : 'off'}, toggles all reminders`}
            />
          </View>
          {prefs.master ? <Text style={[styles.subcopy, { color: t.color.textMuted }]}>{S42_COPY.masterOnSubcopy}</Text> : null}
        </Card>

        {masterOff ? (
          <EmptyState icon={BellOff} headline={S42_COPY.emptyHeadline} subcopy={S42_COPY.emptySubcopy} />
        ) : (
          <>
            <Card accessibilityLabel={S42_COPY.remindersSection}>
              <Text style={[styles.sectionLabel, { color: t.color.textMuted }]}>{S42_COPY.remindersSection}</Text>
              <SubToggleRow
                label={S42_COPY.reminderRows.routineDue}
                value={prefs.routineDue}
                onChange={(v) => patchPrefs({ routineDue: v })}
              />
              <SubToggleRow
                label={S42_COPY.reminderRows.eventStarting}
                value={prefs.eventStarting}
                onChange={(v) => patchPrefs({ eventStarting: v })}
              />
              <SubToggleRow label={S42_COPY.reminderRows.courseDose} value={prefs.courseDose} onChange={(v) => patchPrefs({ courseDose: v })} />
              <SubToggleRow
                label={S42_COPY.reminderRows.courseEndingSoon}
                value={prefs.courseEndingSoon}
                onChange={(v) => patchPrefs({ courseEndingSoon: v })}
              />
            </Card>

            <Card accessibilityLabel={S42_COPY.encouragementSection}>
              <Text style={[styles.sectionLabel, { color: t.color.textMuted }]}>{S42_COPY.encouragementSection}</Text>
              <SubToggleRow
                label={S42_COPY.encouragementRows.gentleReentry}
                value={prefs.gentleReentry}
                onChange={(v) => patchPrefs({ gentleReentry: v })}
              />
              <SubToggleRow
                label={S42_COPY.encouragementRows.milestoneReached}
                value={prefs.milestoneReached}
                onChange={(v) => patchPrefs({ milestoneReached: v })}
              />
            </Card>

            <Card accessibilityLabel={S42_COPY.digestRow}>
              <SubToggleRow label={S42_COPY.digestRow} value={prefs.dailyDigest} onChange={(v) => patchPrefs({ dailyDigest: v })} />
              {prefs.dailyDigest ? (
                <Select
                  label={S42_COPY.digestRow}
                  value={prefs.dailyDigestTime}
                  options={DIGEST_TIME_OPTIONS}
                  onChange={(v) => patchPrefs({ dailyDigestTime: v })}
                />
              ) : null}
            </Card>

            {triggerB ? (
              <View accessibilityLabel={`${S42_COPY.emptyHeadline}. ${S42_COPY.emptySubcopy}`}>
                <EmptyState icon={BellOff} headline={S42_COPY.emptyHeadline} subcopy={S42_COPY.emptySubcopy} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SubToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: t.color.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={`${label}, ${value ? 'on' : 'off'}, toggles ${label.toLowerCase()} reminders`} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s3 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  rowLabel: { fontSize: 16, fontWeight: '500' },
  subcopy: { fontSize: 14, lineHeight: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
});
