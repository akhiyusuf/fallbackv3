/** S40 — Use your own AI key    route: /assistant/paywall/byo */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';

import { S40_COPY } from '@/features/assistant/copy';
import { probeByoEndpoint, setByoConfig } from '@/services/ai';
import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { Button, Input, Screen } from '@/ui';
import { Text } from '@/ui/AppText';
import { isSafeBaseUrl } from '@/services/ai/safeBaseUrl';

type Status = 'idle' | 'validating' | 'invalid' | 'insecure' | 'success-full' | 'success-degraded';

const INSECURE_LINE =
  'This address starts with http://, which would send your key without protection. Use an https:// address. http:// is only accepted for a model server on this phone or your home network.';


export default function S40ByoAiKeySetup() {
  const t = useTheme();
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [revealKey, setRevealKey] = useState(false);
  const [status, setStatus] = useState<Status>('idle');

  async function handleSaveAndConnect() {
    if (/^http:\/\//i.test(baseUrl.trim()) && !isSafeBaseUrl(baseUrl)) {
      setStatus('insecure');
      return;
    }
    if (!/^https?:\/\//i.test(baseUrl.trim())) {
      setStatus('invalid');
      return;
    }
    setStatus('validating');
    const probe = await probeByoEndpoint(baseUrl.trim(), apiKey.trim());
    if (!probe.ok) {
      setStatus('invalid');
      return;
    }
    try {
      await setByoConfig({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), supportsTranscription: probe.transcription, model: probe.model });
    } catch {
      // A failed secure write must not leave the button spinning forever. There is no separate
      // copy for a storage failure, so the existing calm error banner is shown instead.
      setStatus('invalid');
      return;
    }
    setStatus(probe.transcription ? 'success-full' : 'success-degraded');
    setTimeout(() => router.replace('/assistant/chat' as Href), 600);
  }

  const isValidating = status === 'validating';
  const isInvalid = status === 'invalid' || status === 'insecure';
  const RevealIcon = revealKey ? EyeOff : Eye;

  return (
    <Screen
      title={S40_COPY.title}
      level="page"
      onBack={() => router.replace('/assistant/paywall' as Href)}
      footer={
        <Button label={isValidating ? S40_COPY.connecting : S40_COPY.save} onPress={handleSaveAndConnect} loading={isValidating} disabled={isValidating} accessibilityLabel={S40_COPY.save} fullWidth testID="s40-save" />
      }
    >
      <Text style={[styles.intro, { color: t.color.textMuted }]}>{S40_COPY.intro}</Text>

      <Input label={S40_COPY.baseUrlLabel} value={baseUrl} onChangeText={setBaseUrl} placeholder={S40_COPY.baseUrlPlaceholder} helper={S40_COPY.baseUrlHelper} keyboardType="url" testID="s40-base-url" />

      <Input
        label={S40_COPY.apiKeyLabel}
        value={apiKey}
        onChangeText={setApiKey}
        placeholder={S40_COPY.apiKeyPlaceholder}
        secureTextEntry={!revealKey}
        helper={S40_COPY.apiKeyHelper}
        testID="s40-api-key"
        right={
          <Pressable onPress={() => setRevealKey((v) => !v)} accessibilityRole="button" accessibilityLabel={revealKey ? 'Hide API key' : 'Show API key'} hitSlop={8} style={styles.eye}>
            <RevealIcon size={20} color={t.color.textMuted} />
          </Pressable>
        }
      />

      {isInvalid ? (
        <View accessibilityLiveRegion="polite" style={[styles.banner, { backgroundColor: t.color.dangerSoft ?? t.color.surface }]}>
          <Text style={[styles.bannerText, { color: t.color.danger }]}>{status === 'insecure' ? INSECURE_LINE : S40_COPY.invalid}</Text>
        </View>
      ) : null}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: FONT_SIZE.base, lineHeight: 24 },
  eye: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  banner: { borderRadius: RADIUS.md, padding: SPACE.s3, gap: 2 },
  bannerText: { fontSize: FONT_SIZE.sm, fontWeight: '600', lineHeight: 20 },
  bannerSub: { fontSize: FONT_SIZE.sm },
});
