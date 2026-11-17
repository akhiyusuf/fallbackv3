/** S36 — assistant options, as one grouped list in a bottom sheet (D3, D7). */
import { useState } from 'react';
import { CreditCard, HelpCircle, History, Languages, MessageSquarePlus, ShieldCheck } from 'lucide-react-native';

import { Dialog, ListGroup, ListRow, Radio } from '@/ui';
import { S36_COPY } from './copy';
import { DEFAULT_VOICE_LANGUAGE_PREFS, type VoiceLanguagePrefs } from './voiceLanguagePrefs';

export interface OptionsSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onNewConversation: () => void;
  readonly onConversationHistory: () => void;
  readonly onManageSubscription: () => void;
  readonly onAccountAndSync: () => void;
  readonly onHelp: () => void;
  readonly subscriptionSubtitle: string | null;
  readonly voiceLanguage?: VoiceLanguagePrefs;
  readonly onSaveVoiceLanguage?: (language: string, voice: string) => void | Promise<boolean>;
}

const VOICE_OPTIONS = [
  { value: 'warm', label: 'Warm' },
  { value: 'calm', label: 'Calm' },
  { value: 'direct', label: 'Direct' },
];

export function OptionsSheet({ visible, onClose, onNewConversation, onConversationHistory, onManageSubscription, onAccountAndSync, onHelp, subscriptionSubtitle, voiceLanguage = DEFAULT_VOICE_LANGUAGE_PREFS, onSaveVoiceLanguage }: OptionsSheetProps) {
  const [pending, setPending] = useState<VoiceLanguagePrefs | null>(null);
  const language = pending?.language ?? voiceLanguage.language;
  const voice = pending?.voice ?? voiceLanguage.voice;

  function applyVoice(value: string) {
    setPending({ language, voice: value });
    void Promise.resolve(onSaveVoiceLanguage?.(language, value)).then((saved) => {
      if (saved === false) setPending(null);
    });
  }

  return (
    <Dialog visible={visible} onClose={onClose} title={S36_COPY.title} accessibilityLabel={S36_COPY.title} presentation="sheet">
      <ListGroup>
        <ListRow icon={MessageSquarePlus} label={S36_COPY.newConversation} onPress={onNewConversation} />
        <ListRow icon={History} label={S36_COPY.conversationHistory} onPress={onConversationHistory} />
      </ListGroup>

      <Radio label={S36_COPY.voiceLabel} value={voice} options={VOICE_OPTIONS} onChange={applyVoice} />

      <ListGroup>
        <ListRow icon={Languages} label={S36_COPY.languageLabel} value={S36_COPY.languageValue} />
        <ListRow icon={CreditCard} label={S36_COPY.manageSubscription} sublabel={subscriptionSubtitle ?? undefined} onPress={onManageSubscription} />
        <ListRow icon={ShieldCheck} label={S36_COPY.accountAndSync} onPress={onAccountAndSync} />
        <ListRow icon={HelpCircle} label={S36_COPY.help} onPress={onHelp} />
      </ListGroup>
    </Dialog>
  );
}
