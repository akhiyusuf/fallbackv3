/** S48 — erasing is confirmed in a sheet (EraseDataSheet). This route forwards to the screen that owns it. */
import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

export default function S48EraseAllConfirmation() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  return <Redirect href={(from === 'recovery' ? '/recovery?confirmErase=1' : '/settings/data?confirmErase=1') as Href} />;
}
