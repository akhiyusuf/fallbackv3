/** S50 — data recovery. Stacked button pair (D11); reset is confirmed in a sheet (D3). */
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RefreshCw } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { store } from '@/db';
import { S50_COPY } from '@/features/data/copy';
import { EraseDataSheet } from '@/features/data/EraseDataSheet';
import { FONT_SIZE, RADIUS, SPACE, useTheme } from '@/theme';
import { ButtonPair } from '@/ui';
import { Text } from '@/ui/AppText';

export default function S50DataRecovery() {
  const t = useTheme();
  const router = useRouter();
  const { confirmErase } = useLocalSearchParams<{ confirmErase?: string }>();
  const [retrying, setRetrying] = useState(false);
  const [eraseOpen, setEraseOpen] = useState(false);

  useEffect(() => {
    if (confirmErase === '1') setEraseOpen(true);
  }, [confirmErase]);

  // A second tap before the button has re-rendered as busy must not open the store twice.
  const busy = useRef(false);

  async function handleTryAgain() {
    if (busy.current) return;
    busy.current = true;
    setRetrying(true);
    // A store that throws instead of answering is the same calm "still cannot read it", not a crash.
    const result = await store.open().catch(() => null);
    if (result && result.ok && result.value === 'ready') {
      router.replace('/splash');
      return;
    }
    busy.current = false;
    setRetrying(false);
  }

  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]}>
      <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: t.color.surface }]}>
          <RefreshCw size={28} color={t.color.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
        </View>
        <Text accessibilityRole="header" style={[styles.headline, { color: t.color.text }]}>
          {S50_COPY.headline}
        </Text>
        <Text style={[styles.body, { color: t.color.textMuted }]}>{S50_COPY.body}</Text>
      </View>
      <ButtonPair
        primary={{ label: S50_COPY.tryAgain, onPress: () => void handleTryAgain(), loading: retrying, disabled: retrying }}
        secondary={{ label: S50_COPY.resetAppData, onPress: () => setEraseOpen(true), disabled: retrying }}
      />
      <EraseDataSheet visible={eraseOpen} onClose={() => setEraseOpen(false)} fromRecovery />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: SPACE.s4, gap: SPACE.s5 },
  content: { alignItems: 'center', gap: SPACE.s2 },
  iconWrap: { width: 64, height: 64, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.s1 },
  headline: { fontSize: FONT_SIZE.xl, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: FONT_SIZE.base, lineHeight: 24, textAlign: 'center' },
});
