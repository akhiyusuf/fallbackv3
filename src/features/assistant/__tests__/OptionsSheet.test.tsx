/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent } from '@testing-library/react-native';

import { OptionsSheet } from '../OptionsSheet';
import { S36_COPY } from '../copy';

describe('S36 — Assistant Options Menu (sheet)', () => {
  it('default: six rows collapsed, Voice & language accordion closed', async () => {
    await render(
      <OptionsSheet
        visible
        onClose={jest.fn()}
        onNewConversation={jest.fn()}
        onConversationHistory={jest.fn()}
        onManageSubscription={jest.fn()}
        onAccountAndSync={jest.fn()}
        onHelp={jest.fn()}
        subscriptionSubtitle="Fallback AI · renews Aug 20"
      />,
    );
    expect(screen.getByText(S36_COPY.title)).toBeTruthy();
    expect(screen.queryByText(S36_COPY.languageLabel)).toBeNull();
  });

  it('tapping "New conversation" fires the callback', async () => {
    const onNewConversation = jest.fn();
    await render(
      <OptionsSheet
        visible
        onClose={jest.fn()}
        onNewConversation={onNewConversation}
        onConversationHistory={jest.fn()}
        onManageSubscription={jest.fn()}
        onAccountAndSync={jest.fn()}
        onHelp={jest.fn()}
        subscriptionSubtitle={null}
      />,
    );
    await userEvent.press(screen.getByText(S36_COPY.newConversation));
    expect(onNewConversation).toHaveBeenCalled();
  });

  it('tapping "Voice & language" expands the accordion in place, no navigation', async () => {
    await render(
      <OptionsSheet
        visible
        onClose={jest.fn()}
        onNewConversation={jest.fn()}
        onConversationHistory={jest.fn()}
        onManageSubscription={jest.fn()}
        onAccountAndSync={jest.fn()}
        onHelp={jest.fn()}
        subscriptionSubtitle="x"
      />,
    );
    await userEvent.press(screen.getByText(S36_COPY.voiceAndLanguage));
    expect(await screen.findByText(S36_COPY.languageLabel)).toBeTruthy();
    expect(screen.getByText(S36_COPY.voiceLabel)).toBeTruthy();
  });

  it('subscriptionSubtitle === null renders a Skeleton, but the row is still tappable', async () => {
    const onManageSubscription = jest.fn();
    await render(
      <OptionsSheet
        visible
        onClose={jest.fn()}
        onNewConversation={jest.fn()}
        onConversationHistory={jest.fn()}
        onManageSubscription={onManageSubscription}
        onAccountAndSync={jest.fn()}
        onHelp={jest.fn()}
        subscriptionSubtitle={null}
      />,
    );
    await userEvent.press(screen.getByText(S36_COPY.manageSubscription));
    expect(onManageSubscription).toHaveBeenCalled();
  });

  it('B2 — changing Voice fires onSaveVoiceLanguage with the current language + the new voice', async () => {
    const onSaveVoiceLanguage = jest.fn();
    await render(
      <OptionsSheet
        visible
        onClose={jest.fn()}
        onNewConversation={jest.fn()}
        onConversationHistory={jest.fn()}
        onManageSubscription={jest.fn()}
        onAccountAndSync={jest.fn()}
        onHelp={jest.fn()}
        subscriptionSubtitle="x"
        onSaveVoiceLanguage={onSaveVoiceLanguage}
      />,
    );
    await userEvent.press(screen.getByText(S36_COPY.voiceAndLanguage));
    await screen.findByText(S36_COPY.languageLabel);
    await userEvent.press(screen.getByLabelText('Voice, Warm — default'));
    await userEvent.press(await screen.findByText('Calm'));
    expect(onSaveVoiceLanguage).toHaveBeenCalledWith('en-US', 'calm');
  });
});
