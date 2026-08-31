import { StyleSheet, Text, View } from 'react-native';
import { calculateTotalMinutes, formatClockDuration } from '../domain/logic';
import type { TimeEntry } from '../domain/types';
import { colors, fonts, radius, spacing } from '../theme';
import { Icon } from './Icon';

function RuledBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 19 }, (_, index) => (
        <View key={index} style={[styles.rule, { top: 24 + index * 24 }]} />
      ))}
      {Array.from({ length: 8 }, (_, index) => (
        <View key={index} style={[styles.verticalRule, { left: 30 + index * 42 }]} />
      ))}
    </View>
  );
}

export function ProofSlip({ entry, synced }: { entry: TimeEntry; synced: boolean }) {
  const total = calculateTotalMinutes(entry);
  return (
    <View style={styles.shadow}>
      <View style={styles.slip}>
        <RuledBackground />
        <View style={[styles.stamp, synced && styles.syncedStamp]}>
          <Text style={[styles.stampText, synced && styles.syncedStampText]}>
            {synced ? 'SYNCED' : 'SAVED LOCALLY'}
          </Text>
        </View>
        <Text style={styles.date}>TUE, SEP 01</Text>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>REGULAR HOURS</Text>
          <Text style={styles.fieldValue}>{formatClockDuration(entry.regularMinutes)}</Text>
          <Text style={styles.fieldHint}>regular</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>OVERTIME</Text>
          <Text style={styles.fieldValue}>{formatClockDuration(entry.overtimeMinutes)}</Text>
          <Text style={styles.fieldHint}>overtime</Text>
        </View>
        <View style={styles.noteField}>
          <Text style={styles.fieldLabel}>NOTE</Text>
          <Text style={styles.note}>{entry.note || 'No note added.'}</Text>
        </View>
        <View style={styles.evidenceRow}>
          <View style={styles.evidenceIcon}><Icon name="phone" size={19} color={colors.green} /></View>
          <Text style={styles.evidenceText}>{synced ? 'Original kept on this device.' : 'Saved on this device.'}</Text>
        </View>
        <View style={styles.evidenceRow}>
          <View style={[styles.evidenceIcon, styles.cloudIcon]}><Icon name="cloud" size={19} color={colors.blue} /></View>
          <Text style={styles.evidenceText}>
            {synced ? 'Matched with the server using the same key.' : 'Will sync automatically when you’re back online.'}
          </Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.localId}>{entry.idempotencyKey.replace('shiftproof:time-entry:', 'SP/L-').slice(0, 18)}</Text>
          <Text style={styles.total}>{(total / 60).toFixed(1)} H</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { marginVertical: 18, shadowColor: colors.black, shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 5 },
  slip: { overflow: 'hidden', minHeight: 510, borderRadius: radius.sm, backgroundColor: colors.paperRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.divider, padding: spacing.lg },
  rule: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: '#E9E3D8' },
  verticalRule: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: '#F0EBE2' },
  stamp: { position: 'absolute', top: 62, right: 18, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 2, borderColor: colors.amberDark, borderRadius: 5, transform: [{ rotate: '-7deg' }] },
  syncedStamp: { borderColor: colors.green, transform: [{ rotate: '-4deg' }] },
  stampText: { fontFamily: fonts.monoSemiBold, fontSize: 14, color: colors.amberDark },
  syncedStampText: { color: colors.green },
  date: { textAlign: 'center', fontFamily: fonts.monoSemiBold, fontSize: 16, color: colors.navy, letterSpacing: 0.4, marginBottom: 30 },
  field: { marginLeft: 50, paddingBottom: 13, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.dividerStrong, borderStyle: 'dashed' },
  fieldLabel: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.5, color: colors.slate },
  fieldValue: { fontFamily: fonts.sansMedium, fontSize: 44, lineHeight: 52, letterSpacing: -2, color: colors.navy, fontVariant: ['tabular-nums'] },
  fieldHint: { fontFamily: fonts.sans, fontSize: 14, color: colors.slate },
  noteField: { marginLeft: 50, paddingBottom: 14, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.dividerStrong, borderStyle: 'dashed' },
  note: { marginTop: 4, fontFamily: fonts.sans, fontSize: 15, lineHeight: 21, color: colors.navy },
  evidenceRow: { marginLeft: 50, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.dividerStrong, borderStyle: 'dashed' },
  evidenceIcon: { width: 34, height: 34, borderRadius: 17, borderColor: '#AFCFB9', borderWidth: 1, backgroundColor: colors.greenWash, alignItems: 'center', justifyContent: 'center' },
  cloudIcon: { borderColor: '#B5CBE7', backgroundColor: '#F0F5FC' },
  evidenceText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 19, color: colors.navy },
  footer: { marginLeft: 50, marginTop: 16, flexDirection: 'row', justifyContent: 'space-between' },
  localId: { fontFamily: fonts.mono, fontSize: 12, color: colors.navy },
  total: { fontFamily: fonts.monoSemiBold, fontSize: 12, color: colors.navy },
});
