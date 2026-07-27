/**
 * S40 — BYO AI Key Setup    route: /assistant/paywall/byo
 * Owner: M6. Features: F18.
 * Spec: design-input/fallback-handoff/uploads/ALLSCREENS_1.md (S40)
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';

import { AssistantHeader } from '@/features/assistant/AssistantHeader';
import { S40_COPY } from '@/features/assistant/copy';
import { probeByoEndpoint, setByoConfig } from '@/services/ai';
import { SPACE, useTheme } from '@/theme';
import { Button, IconButton, Input } from '@/ui';

type Status = 'idle' | 'validating' | 'invalid' | 'success-full' | 'success-degraded';

export default function S40ByoAiKeySetup() {
  const t = useTheme();
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [revealKey, setRevealKey] = useState(false);
  const [status, setStatus] = useState<Status>('idle');

  function handleBack() {
    router.replace('/assistant/paywall' as Href);
  }

  async function handleSaveAndConnect() {
    setStatus('validating');
    const probe = await probeByoEndpoint(baseUrl.trim(), apiKey.trim());
    if (!probe.ok) {
      setStatus('invalid');
      return;
    }
    await setByoConfig({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), supportsTranscription: probe.transcription });
    setStatus(probe.transcription ? 'success-full' : 'success-degraded');
    const delay = probe.transcription ? 600 : 0;
    setTimeout(() => router.replace('/assistant/chat' as Href), delay);
  }

  const isValidating = status === 'validating';
  const isInvalid = status === 'invalid';

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <AssistantHeader onBack={handleBack} title={S40_COPY.title} />
      <View style={styles.content}>
        <Text style={[styles.intro, { color: t.color.textMuted }]}>{S40_COPY.intro}</Text>

        <Input
          label={S40_COPY.baseUrlLabel}
          value={baseUrl}
          onChangeText={setBaseUrl}
          placeholder={S40_COPY.baseUrlPlaceholder}
          helper={isInvalid ? undefined : S40_COPY.baseUrlHelper}
          error={isInvalid ? S40_COPY.invalid : undefined}
          testID="s40-base-url"
        />

        <View style={styles.keyRow}>
          <View style={styles.keyInputWrap}>
            <Input
              label={S40_COPY.apiKeyLabel}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder={S40_COPY.apiKeyPlaceholder}
              secureTextEntry={!revealKey}
              helper={isInvalid ? undefined : S40_COPY.apiKeyHelper}
              error={isInvalid ? ' ' : undefined}
              testID="s40-api-key"
            />
          </View>
          <IconButton
            icon={revealKey ? EyeOff : Eye}
            onPress={() => setRevealKey((v) => !v)}
            accessibilityLabel={revealKey ? 'Hide API key' : 'Reveal API key'}
          />
        </View>

        <Button
          label={isValidating ? S40_COPY.connecting : S40_COPY.save}
          onPress={handleSaveAndConnect}
          loading={isValidating}
          disabled={isValidating}
          accessibilityLabel={S40_COPY.save}
          fullWidth
          testID="s40-save"
        />

        {status === 'success-full' ? (
          <View accessibilityLiveRegion="polite" style={[styles.banner, { backgroundColor: t.color.idealSoft }]}>
            <Text style={[styles.bannerText, { color: t.color.idealDeep }]}>{S40_COPY.successFull}</Text>
            <Text style={[styles.bannerSub, { color: t.color.idealDeep }]}>{S40_COPY.successFullSub}</Text>
          </View>
        ) : null}
        {status === 'success-degraded' ? (
          <View accessibilityLiveRegion="polite" style={[styles.banner, { backgroundColor: t.color.fallbackSoft }]}>
            <Text style={[styles.bannerText, { color: t.color.fallbackDeep }]}>{S40_COPY.successDegraded}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: SPACE.s3, gap: SPACE.s2 },
  intro: { fontSize: 14, lineHeight: 20 },
  keyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.s1 },
  keyInputWrap: { flex: 1 },
  banner: { borderRadius: 12, padding: SPACE.s2, gap: 2 },
  bannerText: { fontSize: 14, fontWeight: '600' },
  bannerSub: { fontSize: 13 },
});
