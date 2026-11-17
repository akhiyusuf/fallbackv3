/** Tab-screen header for the four list tabs — the shared ScreenHeader at tab level (D4). */
import { Search } from 'lucide-react-native';

import { IconButton, ScreenHeader } from '@/ui';

export function BrowseHeader({ title, onSearch }: { title: string; onSearch: () => void }) {
  return <ScreenHeader level="tab" title={title} right={<IconButton icon={Search} accessibilityLabel="Search" onPress={onSearch} />} />;
}
