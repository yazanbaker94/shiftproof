import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

export function ProofMark({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="ShiftProof">
      <Text style={[styles.text, compact && styles.compact]}>SHIFT/</Text>
      <Text style={[styles.text, styles.proof, compact && styles.compact]}>PROOF</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
  text: { color: colors.navy, fontFamily: fonts.sansBold, fontSize: 29, letterSpacing: -1 },
  proof: { color: colors.green },
  compact: { fontSize: 22 },
});
