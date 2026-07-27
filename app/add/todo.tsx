/**
 * S19 — Create To-do/Note    route: /add/todo
 * Owner: M4. Features: F11.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S19)
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { SPACE, useTheme } from '@/theme';
import { Button, Card, IconButton, Input, Radio, Textarea } from '@/ui';
import { ROUTES, useOriginAwareBack } from '@/navigation';
import { validateTaskDraft } from '@/domain';
import { useCreateTask } from '@/queries';
import { useToastStore } from '@/app-shell/stores/toast';
import type { Importance, Necessity, TaskDraft } from '@/types';

const IMPORTANCE_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'med', label: 'Med' },
  { value: 'low', label: 'Low' },
];
const NECESSITY_OPTIONS = [
  { value: 'must-do', label: 'Must-do' },
  { value: 'recommended', label: 'Recommended' },
  { value: 'optional', label: 'Optional' },
];

export default function S19CreateToDoNote() {
  const t = useTheme();
  const router = useRouter();
  const goBack = useOriginAwareBack(ROUTES.addPickType);
  const createTask = useCreateTask();
  const showToast = useToastStore((s) => s.show);

  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [importance, setImportance] = useState<Importance | null>(null);
  const [necessity, setNecessity] = useState<Necessity | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();

  function buildDraft(): TaskDraft {
    return { type: 'todo', name, note: note || null, importance, necessity, idealSteps: [], fallbackSteps: [] };
  }

  async function onSave() {
    const draft = buildDraft();
    const validated = validateTaskDraft(draft);
    setNameError(draft.name.trim().length === 0 ? 'Give this a name to save it.' : undefined);
    if (!validated.ok) return;
    const result = await createTask.mutateAsync(draft);
    if (result.ok) {
      router.replace(ROUTES.today);
    } else {
      showToast("Couldn't save that — try again.", 'warning');
    }
  }

  return (
    <ScrollView style={[styles.root, { backgroundColor: t.color.bg }]} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} onPress={goBack} accessibilityLabel="Back" />
        <Text accessibilityRole="header" style={[styles.title, { color: t.color.text }]}>
          New To-do / Note
        </Text>
      </View>

      <Input
        label="What is it?"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Renew passport"
        error={nameError}
        autoFocus
        accessibilityLabel="What is it?"
      />
      <Textarea label="Note (optional)" value={note} onChangeText={setNote} placeholder="Add a detail if it helps" accessibilityLabel="Note (optional)" />

      <Card accessibilityLabel="Loose task framing">
        <Text style={{ color: t.color.textMuted, fontSize: 14, lineHeight: 20 }}>
          No ideal/fallback, no schedule — a to-do is a loose task. Just a name, an optional note, and Importance/Necessity if they help you filter
          later.
        </Text>
      </Card>

      <Radio label="Importance" value={importance} options={IMPORTANCE_OPTIONS} onChange={(v) => setImportance(v as Importance)} />
      <Radio label="Necessity" value={necessity} options={NECESSITY_OPTIONS} onChange={(v) => setNecessity(v as Necessity)} />

      <View style={styles.footer}>
        <Button label="Save" onPress={onSave} loading={createTask.isPending} accessibilityLabel="Save" fullWidth />
        <Button label="Cancel" onPress={goBack} variant="ghost" accessibilityLabel="Cancel" fullWidth />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  title: { fontSize: 24, fontWeight: '700' },
  footer: { gap: SPACE.s2, marginTop: SPACE.s3 },
});
