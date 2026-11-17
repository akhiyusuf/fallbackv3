/** S15 — the add menu is a sheet (see AddMenuHost). This route just opens it over Today. */
import { useEffect } from 'react';
import { Redirect } from 'expo-router';

import { useAddMenuStore } from '@/app-shell/stores/addMenu';
import { ROUTES } from '@/navigation';

export default function S15AddTaskPickType() {
  const show = useAddMenuStore((s) => s.show);
  useEffect(() => {
    show();
  }, [show]);
  return <Redirect href={ROUTES.today} />;
}
