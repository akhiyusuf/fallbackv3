/** S22 — deletion is confirmed in a sheet on the task screen (DeleteTaskSheet). This route forwards there. */
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function S22DeleteConfirmation() {
  const { id, openedFrom, origin } = useLocalSearchParams<{ id: string; openedFrom?: string; origin?: string }>();
  const base = openedFrom === 'as-needed' ? `/task/${id}/as-needed` : `/task/${id}`;
  return <Redirect href={`${base}?confirmDelete=1${origin ? `&from=${origin}` : ''}` as never} />;
}
