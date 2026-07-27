/** M3. Shared page-title + search header for S10–S13. */
import { Search } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { SPACE, useTheme } from '@/theme';
import { IconButton } from '@/ui';

export function BrowseHeader({ title, onSearch }: { title: string; onSearch: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.root}>
      <Text accessibilityRole="header" style={[styles.title, { color: t.color.text }]}>
        {title}
      </Text>
      <IconButton icon={Search} accessibilityLabel="Search" onPress={onSearch} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACE.s3, paddingTop: SPACE.s3, paddingBottom: SPACE.s2 },
  title: { fontSize: 24, fontWeight: '700' },
});
