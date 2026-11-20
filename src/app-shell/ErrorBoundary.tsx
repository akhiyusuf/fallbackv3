/**
 * M0. Root error boundary — catches a genuine programmer error (a violated invariant),
 * per ARCHITECTURE §10: throwing is reserved for those, everything else returns `Result`.
 * Calm, never a full-screen red treatment, never the danger token on a background.
 */
import { Component, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { SPACE, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/AppText';

interface Props {
  readonly children: ReactNode;
  /** For an overlay (celebrations, the add menu): on a fault it just goes away, the screen stays. */
  readonly quiet?: boolean;
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

  // A quiet boundary (an overlay) must not stay gone for good: it tries its child again when the
  // parent re-renders it, and on its own after a short wait that grows each time it fails again.
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 1000;

  override componentDidUpdate(prevProps: Props, prevState: State): void {
    if (!this.props.quiet) return;
    if (this.state.error && !prevState.error) {
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        this.retryDelay = Math.min(this.retryDelay * 2, 60_000);
        this.reset();
      }, this.retryDelay);
    } else if (this.state.error && prevState.error && prevProps.children !== this.props.children) {
      this.clearRetry();
      this.reset();
    } else if (!this.state.error && prevState.error === null) {
      this.retryDelay = 1000;
    }
  }

  override componentWillUnmount(): void {
    this.clearRetry();
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  override render(): ReactNode {
    if (this.state.error) {
      return this.props.quiet ? null : <Fallback onRetry={this.reset} />;
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
        Your data is safe on this device. Try again. If it keeps happening, restart the app.
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
