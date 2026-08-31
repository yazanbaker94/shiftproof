import { Pressable, StyleSheet, Text, View } from 'react-native';
import { calculateTotalMinutes, dayParts, formatDecimalHours } from '../domain/logic';
import type { TimeEntry } from '../domain/types';
import { colors, fonts } from '../theme';
import { StatusLabel } from './StatusLabel';

interface Props {
  entry?: TimeEntry;
  date: string;
  detailed?: boolean;
  onPress?: () => void;
}

export function LedgerRow({ entry, date, detailed = false, onPress }: Props) {
  const parts = dayParts(date);
  const minutes = entry ? calculateTotalMinutes(entry) : 0;
  const content = (
    <>
      <View style={[styles.dateBlock, detailed && styles.dateBlockDetailed]}>
        <Text style={styles.day}>{parts.day}</Text>
        <View style={styles.dateDivider} />
        <Text style={styles.date}>{parts.date}</Text>
      </View>
      <Text style={styles.hours}>{entry ? `${formatDecimalHours(minutes)} h` : '—'}</Text>
      <View style={[styles.status, detailed && styles.statusDetailed]}>
        {entry ? <StatusLabel status={entry.status} showLabel={detailed} /> : <View style={styles.emptyMark} />}
      </View>
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${parts.day} ${parts.date}, ${entry ? formatDecimalHours(minutes) + ' hours, ' + entry.status.toLowerCase().replace('_', ' ') : 'no hours'}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 67,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  pressed: { backgroundColor: colors.amberWash },
  dateBlock: { width: 128, flexDirection: 'row', alignItems: 'center' },
  dateBlockDetailed: { width: 104 },
  day: { width: 48, fontFamily: fonts.monoSemiBold, fontSize: 16, color: colors.navy },
  dateDivider: { height: 27, width: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginHorizontal: 13 },
  date: { fontFamily: fonts.sans, fontSize: 18, color: colors.slate },
  hours: { marginLeft: 'auto', fontFamily: fonts.monoMedium, fontSize: 18, color: colors.navy, fontVariant: ['tabular-nums'] },
  status: { width: 34, alignItems: 'flex-end', marginLeft: 18 },
  statusDetailed: { width: 134, marginLeft: 8, alignItems: 'flex-start' },
  emptyMark: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colors.slate },
});
