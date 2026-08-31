import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

interface Props { online: boolean; syncing?: boolean; compact?: boolean }

export function ConnectivityStatus({ online, syncing = false, compact = false }: Props) {
  const label = syncing ? 'Syncing' : online ? 'Online' : 'Offline';
  const color = syncing ? colors.blue : online ? colors.green : colors.amber;
  return (
    <View
      style={styles.row}
      accessibilityRole="text"
      accessibilityLabel={`Demo network status: ${label}`}
    >
      {syncing ? <ActivityIndicator size="small" color={color} /> : <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={[styles.label, compact && styles.compact]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.navy },
  compact: { fontSize: 14 },
});
