/**
 * Round 4 code review (report 41). `it.failing` passes today BECAUSE the bug exists.
 *
 * app/_layout.tsx wraps AddMenuHost and CelebrationHost in `<ErrorBoundary quiet>`. A quiet boundary
 * renders null for good once its child has thrown: nothing resets it (src/app-shell/ErrorBoundary.tsx:36).
 * One bad render of the add menu means the + button does nothing until the app is killed; the host
 * stays mounted underneath, so the store keeps `open: true` and the exact-reminders ask waits forever
 * (it holds while the add menu is "open"). Fix: reset a quiet boundary when its child's store changes,
 * or after a short delay.
 */
import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { ErrorBoundary } from './app-shell/ErrorBoundary';

let shouldThrow = true;
function Host() {
  if (shouldThrow) throw new Error('bad render');
  return <Text>menu</Text>;
}

it.failing('a quiet boundary shows its child again once the child renders fine', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  shouldThrow = true;
  const view = await render(
    <ErrorBoundary quiet>
      <Host />
    </ErrorBoundary>,
  );
  shouldThrow = false;
  await view.rerender(
    <ErrorBoundary quiet>
      <Host />
    </ErrorBoundary>,
  );
  expect(view.queryByText('menu')).toBeTruthy();
});
