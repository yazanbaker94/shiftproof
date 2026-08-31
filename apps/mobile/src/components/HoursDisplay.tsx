import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatClockDuration, formatDecimalHours } from '../domain/logic';
import { colors, fonts } from '../theme';
import { Icon } from './Icon';

interface Props {
  label: string;
  minutes: number;
  prominent?: boolean;
  onDecrease?: () => void;
  onIncrease?: () => void;
}

export function HoursDisplay({ label, minutes, prominent = false, onDecrease, onIncrease }: Props) {
  const editable = Boolean(onDecrease || onIncrease);
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        {editable && (
          <Pressable
            style={styles.stepButton}
            accessibilityRole="button"
            accessibilityLabel={`Decrease ${label.toLowerCase()} by 30 minutes`}
            onPress={onDecrease}
          >
            <Text style={styles.minus}>−</Text>
          </Pressable>
        )}
        <Text
          style={[styles.value, prominent && styles.prominent]}
          accessibilityLabel={`${formatDecimalHours(minutes)} ${label.toLowerCase()}`}
        >
          {formatClockDuration(minutes)}
        </Text>
        {editable && (
          <Pressable
            style={styles.stepButton}
            accessibilityRole="button"
            accessibilityLabel={`Increase ${label.toLowerCase()} by 30 minutes`}
            onPress={onIncrease}
          >
            <Icon name="plus" size={29} color={colors.navy} />
          </Pressable>
        )}
      </View>
      <Text style={styles.hours}>{formatDecimalHours(minutes)} hours</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 14 },
  label: { fontFamily: fonts.monoSemiBold, fontSize: 14, letterSpacing: 0.5, color: colors.navy, textTransform: 'uppercase' },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 76 },
  value: { flex: 1, textAlign: 'center', fontFamily: fonts.sansMedium, fontSize: 46, lineHeight: 56, letterSpacing: -2.2, color: colors.navy, fontVariant: ['tabular-nums'] },
  prominent: { fontFamily: fonts.sansBold, fontSize: 59, lineHeight: 68, letterSpacing: -3 },
  hours: { marginLeft: 52, fontFamily: fonts.sans, fontSize: 16, color: colors.slate },
  stepButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  minus: { fontFamily: fonts.sans, fontSize: 34, lineHeight: 40, color: colors.navy },
});
