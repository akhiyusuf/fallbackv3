/** M0 — entry redirect. The real launch surface is S01 `/splash` (owned by M1). */
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/splash" />;
}
