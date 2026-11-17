/** One row on a task's screen: where the task sits in its importance level, and the way to the list. */
import { useRouter, type Href } from 'expo-router';
import { ListOrdered } from 'lucide-react-native';

import { ROUTES } from '@/navigation';
import type { Id, Importance } from '@/types';
import { ListGroup, ListRow } from '@/ui';

import { PRIORITY_LEVELS, usePriorityGroups } from './order';

export function PriorityPlaceRow({ taskId, importance }: { readonly taskId: Id; readonly importance: Importance }) {
  const router = useRouter();
  const { groups } = usePriorityGroups();
  const list = groups[importance];
  const index = list.findIndex((tk) => tk.id === taskId);
  if (index < 0) return null;
  const level = PRIORITY_LEVELS.find((l) => l.value === importance)?.label ?? '';
  return (
    <ListGroup>
      <ListRow
        icon={ListOrdered}
        label={`No. ${index + 1} of ${list.length} in ${level}`}
        sublabel="See them all and change the order"
        onPress={() => router.push(`${ROUTES.priorities}?level=${importance}` as Href)}
        testID="s20-priority-place"
      />
    </ListGroup>
  );
}
