import { StyleSheet, Text, View } from 'react-native';
import { statusPresentation } from '../domain/logic';
import type { EntryStatus } from '../domain/types';
import { colors, fonts } from '../theme';
import { Icon } from './Icon';

export function StatusLabel({ status, showLabel = true }: { status: EntryStatus; showLabel?: boolean }) {
  const presentation = statusPresentation(status);
  const color = presentation.tone === 'green'
    ? colors.green
    : presentation.tone === 'amber'
      ? colors.amber
      : presentation.tone === 'blue'
        ? colors.blue
        : colors.slate;
  return (
    <View style={styles.row} accessibilityLabel={presentation.accessibilityLabel}>
      {presentation.mark === 'ring' && <View style={[styles.ring, { borderColor: color }]} />}
      {presentation.mark === 'alert' && (
        <View style={[styles.alert, { backgroundColor: color }]}><Text style={styles.alertText}>!</Text></View>
      )}
      {presentation.mark === 'dot' && <View style={[styles.dot, { backgroundColor: color }]} />}
      {presentation.mark === 'check' && (
        <View style={[styles.check, { backgroundColor: color }]}><Icon name="check" size={12} color={colors.white} strokeWidth={2.4} /></View>
      )}
      {showLabel && <Text style={[styles.text, { color }]}>{presentation.label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  ring: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, backgroundColor: colors.transparent },
  alert: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  alertText: { color: colors.white, fontFamily: fonts.sansBold, fontSize: 12, lineHeight: 15 },
  check: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.sansMedium, fontSize: 15 },
});
