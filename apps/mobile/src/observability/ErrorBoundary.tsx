import React, { type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../theme';
import { logger } from './logger';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('render_boundary_caught', { message: error.message, componentStack: info.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.container} accessibilityRole="alert">
        <Text style={styles.eyebrow}>SHIFT/PROOF</Text>
        <Text style={styles.title}>Your hours are still safe.</Text>
        <Text style={styles.body}>
          This screen could not load. Restart the view; entries already saved on this device will remain in SQLite.
        </Text>
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => this.setState({ error: null })}
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center', backgroundColor: colors.paper },
  eyebrow: { fontFamily: fonts.monoSemiBold, color: colors.green, letterSpacing: 1.2, marginBottom: 16 },
  title: { fontFamily: fonts.sansBold, color: colors.navy, fontSize: 36, lineHeight: 42, marginBottom: 12 },
  body: { fontFamily: fonts.sans, color: colors.navySoft, fontSize: 18, lineHeight: 27 },
  button: { marginTop: 28, minHeight: 56, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  buttonText: { fontFamily: fonts.sansSemiBold, color: colors.white, fontSize: 18 },
});
