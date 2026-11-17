/**
 * SayItInsteadRow — the way to Fallback AI from a create form. The plus button on a list tab
 * goes straight to that tab's form, so the form itself offers the other way in: say it, and
 * the assistant sets it up. One slim row at the top, never a second form.
 */
import { useRouter, type Href } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ROUTES } from '@/navigation';
import { FONT_SIZE, SPACE, useTheme } from '@/theme';
import { tintedSurface, VoiceMark } from '@/ui';
import { Text } from '@/ui/AppText';

export function SayItInsteadRow({ what }: { readonly what: string }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(ROUTES.assistant as Href)}
      accessibilityRole="button"
      accessibilityLabel={`Say it instead. Tell Fallback AI about your ${what} and it sets it up.`}
      testID="say-it-instead"
      style={({ pressed }) => [styles.root, tintedSurface(t, t.accent.fill), pressed && { borderColor: t.accent.text }]}
    >
      <VoiceMark size={36} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: t.color.text }]}>Say it instead</Text>
        <Text numberOfLines={1} style={[styles.body, { color: t.color.text }]}>
          Tell Fallback AI and it sets it up.
        </Text>
      </View>
      <ChevronRight size={18} color={t.accent.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 + 4, paddingVertical: SPACE.s2 + 2, paddingHorizontal: SPACE.s2 + 4, minHeight: 60 },
  text: { flex: 1, gap: 1 },
  title: { fontSize: FONT_SIZE.base, fontWeight: '800' },
  body: { fontSize: FONT_SIZE.sm },
});
