/**
 * M0. Root error boundary — catches a genuine programmer error (a violated invariant),
 * per ARCHITECTURE §10: throwing is reserved for those, everything else returns `Result`.
 * Calm, never a full-screen red treatment, never the danger token on a background.
 */
import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SPACE, useTheme } from '@/theme';
import { Button } from '@/ui/Button';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack: string }): void {
    // Developer-facing only; never rendered (ARCHITECTURE §10).
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private reset = (): void => this.setState({ error: null });

  override render(): ReactNode {
    if (this.state.error) {
      return <Fallback onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

function Fallback({ onRetry }: { onRetry: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: t.color.bg }]} accessibilityRole="alert">
      <Text accessibilityRole="header" style={[styles.title, { color: t.color.text }]}>
        Something went wrong.
      </Text>
      <Text style={[styles.body, { color: t.color.textMuted }]}>
        Your data is safe on this device. Try again — if it keeps happening, restart the app.
      </Text>
      <Button label="Try again" onPress={onRetry} variant="secondary" accessibilityLabel="Try again" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.s4, gap: SPACE.s3 },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  body: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
});
