/**
 * S36 — Assistant Options Menu (sheet). No route — renders within `/assistant/*`
 * (docs/MODULES.md).
 */
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CreditCard, History, Languages, MessageSquarePlus, ShieldCheck, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react-native';

import { SPACE, useTheme } from '@/theme';
import { Card, Dialog, Select, Skeleton } from '@/ui';
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
  /** Architect CR-2: the PERSISTED selection, read from `settings` by the owning screen and
   *  passed down — this sheet stays presentational (no query hooks, no module state). */
  readonly voiceLanguage?: VoiceLanguagePrefs;
  readonly onSaveVoiceLanguage?: (language: string, voice: string) => void;
}

const LANGUAGE_OPTIONS = [{ value: 'en-US', label: 'English (US)' }];
const VOICE_OPTIONS = [
  { value: 'warm', label: 'Warm — default' },
  { value: 'calm', label: 'Calm' },
  { value: 'direct', label: 'Direct' },
];

export function OptionsSheet({
  visible,
  onClose,
  onNewConversation,
  onConversationHistory,
  onManageSubscription,
  onAccountAndSync,
  onHelp,
  subscriptionSubtitle,
  voiceLanguage = DEFAULT_VOICE_LANGUAGE_PREFS,
  onSaveVoiceLanguage,
}: OptionsSheetProps) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  // The persisted value is the source of truth; a local override only exists between a tap and
  // the settings read coming back with it. A `useState` initializer alone would freeze the
  // pre-load default forever, since this sheet mounts before the settings query resolves.
  const [pending, setPending] = useState<VoiceLanguagePrefs | null>(null);
  const language = pending?.language ?? voiceLanguage.language;
  const voice = pending?.voice ?? voiceLanguage.voice;

  function handleLanguageChange(value: string) {
    setPending({ language: value, voice });
    onSaveVoiceLanguage?.(value, voice);
  }
  function handleVoiceChange(value: string) {
    setPending({ language, voice: value });
    onSaveVoiceLanguage?.(language, value);
  }

  return (
    <Dialog visible={visible} onClose={onClose} title={S36_COPY.title} accessibilityLabel={S36_COPY.title} presentation="sheet">
      <Card onPress={onNewConversation} accessibilityLabel={S36_COPY.newConversation}>
        <Row icon={<MessageSquarePlus size={18} color={t.color.textMuted} />} label={S36_COPY.newConversation} />
      </Card>
      <Card onPress={onConversationHistory} accessibilityLabel={S36_COPY.conversationHistory}>
        <Row icon={<History size={18} color={t.color.textMuted} />} label={S36_COPY.conversationHistory} />
      </Card>

      <Card
        onPress={() => setExpanded((v) => !v)}
        accessibilityLabel={S36_COPY.voiceAndLanguage}
        accessibilityHint={expanded ? 'Collapses voice and language options' : 'Expands voice and language options'}
      >
        <Row
          icon={<Languages size={18} color={t.color.textMuted} />}
          label={S36_COPY.voiceAndLanguage}
          trailing={expanded ? <ChevronUp size={18} color={t.color.textMuted} /> : <ChevronDown size={18} color={t.color.textMuted} />}
        />
        {expanded ? (
          <View style={styles.accordion}>
            <Select label={S36_COPY.languageLabel} value={language} options={LANGUAGE_OPTIONS} onChange={handleLanguageChange} />
            <Select label={S36_COPY.voiceLabel} value={voice} options={VOICE_OPTIONS} onChange={handleVoiceChange} />
          </View>
        ) : null}
      </Card>

      <Card onPress={onManageSubscription} accessibilityLabel={`${S36_COPY.manageSubscription}. ${subscriptionSubtitle ?? ''}`}>
        <Row icon={<CreditCard size={18} color={t.color.textMuted} />} label={S36_COPY.manageSubscription} />
        {subscriptionSubtitle === null ? (
          <Skeleton width="60%" height={14} />
        ) : (
          <Text style={[styles.subtitle, { color: t.color.textMuted }]}>{subscriptionSubtitle}</Text>
        )}
      </Card>

      <Card onPress={onAccountAndSync} accessibilityLabel={S36_COPY.accountAndSync}>
        <Row icon={<ShieldCheck size={18} color={t.color.textMuted} />} label={S36_COPY.accountAndSync} />
      </Card>

      <Card onPress={onHelp} accessibilityLabel={S36_COPY.help}>
        <Row icon={<HelpCircle size={18} color={t.color.textMuted} />} label={S36_COPY.help} />
      </Card>
    </Dialog>
  );
}

function Row({ icon, label, trailing }: { icon: ReactNode; label: string; trailing?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      {icon}
      <Text style={[styles.label, { color: t.color.text }]}>{label}</Text>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s1 },
  label: { fontSize: 16, fontWeight: '600', flex: 1 },
  subtitle: { fontSize: 13 },
  accordion: { gap: SPACE.s2, paddingTop: SPACE.s2 },
});
