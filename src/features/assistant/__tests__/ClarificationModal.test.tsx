/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent } from '@testing-library/react-native';

import { ClarificationModal } from '../ClarificationModal';

describe('S33 — Assistant Clarification (modal)', () => {
  const options = [
    { taskId: 't1', label: 'Morning workout — daily, 7:00 AM' },
    { taskId: 't2', label: 'Evening workout — daily, 6:00 PM' },
  ];

  it('default: renders the question and both options', async () => {
    await render(<ClarificationModal visible question="You have two 'workout' tasks — which one?" options={options} onResolve={jest.fn()} onDismiss={jest.fn()} />);
    expect(screen.getByText("You have two 'workout' tasks — which one?")).toBeTruthy();
    expect(screen.getByText('Morning workout — daily, 7:00 AM')).toBeTruthy();
    expect(screen.getByText('Evening workout — daily, 6:00 PM')).toBeTruthy();
  });

  it('tapping an option resolves with that taskId', async () => {
    const onResolve = jest.fn();
    await render(<ClarificationModal visible question="q" options={options} onResolve={onResolve} onDismiss={jest.fn()} />);
    await userEvent.press(screen.getByText('Morning workout — daily, 7:00 AM'));
    expect(onResolve).toHaveBeenCalledWith('t1');
  });

  it('re-ask state renders the calm re-ask copy instead of an error', async () => {
    await render(
      <ClarificationModal visible question="q" options={options} onResolve={jest.fn()} onDismiss={jest.fn()} reAskText="Sorry — which one did you mean?" />,
    );
    expect(screen.getByText('Sorry — which one did you mean?')).toBeTruthy();
  });
});
