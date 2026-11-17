/** House pattern (docs/MODULES.md top matter): @testing-library/react-native, `await render`. */
import { render, screen, userEvent } from '@testing-library/react-native';

import { OptionsSheet } from '../OptionsSheet';
import { S36_COPY } from '../copy';

describe('S36 — Assistant Options Menu (sheet)', () => {
  it('default: the voice choices and the language row are shown inline, no accordion', async () => {
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
    expect(screen.queryByText(S36_COPY.voiceAndLanguage)).toBeNull();
    expect(screen.getByText(S36_COPY.voiceLabel)).toBeTruthy();
    expect(screen.getByText(S36_COPY.languageLabel)).toBeTruthy();
    expect(screen.getByText(S36_COPY.languageValue)).toBeTruthy();
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

  it('the voice radio is inline: its choices are reachable without any expand step', async () => {
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
    expect(screen.getByRole('tab', { name: 'Warm', selected: true })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Calm' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Direct' })).toBeTruthy();
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
    await userEvent.press(screen.getByRole('tab', { name: 'Calm' }));
    expect(onSaveVoiceLanguage).toHaveBeenCalledWith('en-US', 'calm');
  });

  // Review pass 1, non-blocking note 1: a save that FAILS must not leave the picker showing
  // the value that was never written — the sheet snaps back to the persisted prop.
  it('a FAILED save (onSaveVoiceLanguage resolves false) snaps the picker back to the persisted voice', async () => {
    const onSaveVoiceLanguage = jest.fn(async () => false);
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
        voiceLanguage={{ language: 'en-US', voice: 'warm' }}
        onSaveVoiceLanguage={onSaveVoiceLanguage}
      />,
    );
    await userEvent.press(screen.getByRole('tab', { name: 'Direct' }));
    expect(onSaveVoiceLanguage).toHaveBeenCalledWith('en-US', 'direct');

    // Back to the persisted 'warm', not stuck on the unsaved 'direct'.
    expect(await screen.findByRole('tab', { name: 'Warm', selected: true })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Direct', selected: true })).toBeNull();
  });
});
