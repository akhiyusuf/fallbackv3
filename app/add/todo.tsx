/** S19 — New to-do or note. The kind is an explicit choice, never guessed from the text. */
import { useState } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { Button, Input, Radio, Screen, SectionHeading, Tabs, Textarea } from '@/ui';
import { SayItInsteadRow } from '@/features/assistant/SayItInsteadRow';
import { ROUTES, useOriginAwareBack } from '@/navigation';
import { validateTaskDraft } from '@/domain';
import { useCreateTask } from '@/queries';
import type { Importance, Necessity, TaskDraft } from '@/types';
import { IMPORTANCE_OPTIONS, NECESSITY_OPTIONS, FIX_FIELDS, SAVE_FAILED, useSingleFlightSave } from '@/features/task/formShared';
import { useToastStore } from '@/app-shell/stores/toast';

const KIND_ITEMS = [
  { value: 'todo', label: 'To-do' },
  { value: 'note', label: 'Note' },
];

export default function S19CreateToDoNote() {
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string }>();
  const goBack = useOriginAwareBack(ROUTES.today);
  const createTask = useCreateTask();
  const showToast = useToastStore((s) => s.show);

  const [kind, setKind] = useState<'todo' | 'note'>(params.kind === 'note' ? 'note' : 'todo');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [importance, setImportance] = useState<Importance | null>(null);
  const [necessity, setNecessity] = useState<Necessity | null>(null);
  const [nameError, setNameError] = useState<string | undefined>();
  const isNote = kind === 'note';

  const onSave = useSingleFlightSave(save, () => showToast(SAVE_FAILED, 'warning'));
  async function save() {
    const draft: TaskDraft = { type: 'todo', name: name.trim(), note: note.trim() ? note : null, isNote, importance, necessity, idealSteps: [], fallbackSteps: [] };
    const validated = validateTaskDraft(draft);
    setNameError(draft.name.trim().length === 0 ? (isNote ? 'Give this note a title to save it.' : 'Give this a name to save it.') : undefined);
    if (!validated.ok) {
      showToast(FIX_FIELDS, 'warning');
      return;
    }
    const result = await createTask.mutateAsync(draft);
    if (result.ok) {
      router.dismissTo((isNote ? `${ROUTES.todos}?lens=notes` : ROUTES.todos) as Href);
      showToast(isNote ? 'Note saved' : 'To-do saved', 'success');
    } else {
      showToast(SAVE_FAILED, 'warning');
    }
  }

  return (
    <Screen
      title={isNote ? 'New note' : 'New to-do'}
      onBack={goBack}
      footer={<Button label={isNote ? 'Save note' : 'Save to-do'} onPress={onSave} loading={createTask.isPending} accessibilityLabel={isNote ? 'Save note' : 'Save to-do'} fullWidth />}
    >
      <SayItInsteadRow what={isNote ? 'note' : 'to-do'} />
      <Tabs items={KIND_ITEMS} value={kind} onChange={(v) => setKind(v as 'todo' | 'note')} accessibilityLabel="To-do or note" />
      <Input label={isNote ? 'Title' : 'Name'} value={name} onChangeText={setName} placeholder={isNote ? 'Gift ideas' : 'Renew passport'} error={nameError} autoFocus accessibilityLabel={isNote ? 'Title' : 'Name'} />
      <Textarea
        label={isNote ? 'Note' : 'Details (optional)'}
        value={note}
        onChangeText={setNote}
        placeholder={isNote ? 'Write it down' : 'Add a detail if it helps'}
        accessibilityLabel={isNote ? 'Note' : 'Details (optional)'}
        helper={isNote ? 'A note is something to keep. It has no checkbox and no schedule.' : 'A to-do is something to tick off. It has no schedule and no ideal or fallback.'}
      />
      <SectionHeading>Priority</SectionHeading>
      <Radio label="Importance" value={importance} options={IMPORTANCE_OPTIONS} onChange={(v) => setImportance(v as Importance)} />
      <Radio label="Necessity" value={necessity} options={NECESSITY_OPTIONS} onChange={(v) => setNecessity(v as Necessity)} />
    </Screen>
  );
}
