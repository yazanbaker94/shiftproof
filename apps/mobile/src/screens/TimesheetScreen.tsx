import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useApp } from '../app/AppProvider';
import { LedgerRow } from '../components/LedgerRow';
import { ScreenHeader } from '../components/ScreenHeader';
import { calculateEntriesTotalMinutes } from '../domain/logic';
import { DEMO_PERIOD_ID } from '../data/database';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, sharedStyles } from '../theme';

const weekDates = ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'];

export function TimesheetScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { entries, connectionStatus, isSyncing } = useApp();
  const [view, setView] = useState<'week' | 'summary'>('week');
  const weekEntries = entries.filter((entry) => entry.periodId === DEMO_PERIOD_ID && weekDates.includes(entry.workDate));
  const total = calculateEntriesTotalMinutes(weekEntries) / 60;
  const approved = weekEntries.filter((entry) => entry.status === 'APPROVED' || entry.status === 'PAYROLL_READY').length;
  const attention = weekEntries.filter((entry) => entry.status === 'NEEDS_ATTENTION').length;
  const pending = weekEntries.filter((entry) => entry.status === 'PENDING_SYNC' || entry.status === 'SUBMITTED').length;
  return (
    <SafeAreaView style={sharedStyles.page} edges={['top']}>
      <ScrollView contentContainerStyle={sharedStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <ScreenHeader kind="brand" online={connectionStatus} syncing={isSyncing} />
        <Text style={styles.title}>Timesheet</Text>
        <Text style={styles.period}>Aug 24 – Sep 06</Text>
        <View style={styles.segment}>
          {(['week', 'summary'] as const).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === item }}
              onPress={() => setView(item)}
              style={[styles.segmentButton, view === item && styles.segmentSelected]}
            >
              <Text style={[styles.segmentText, view === item && styles.segmentTextSelected]}>{item === 'week' ? 'Week' : 'Summary'}</Text>
            </Pressable>
          ))}
        </View>
        {view === 'week' ? (
          <View style={styles.ledger}>
            {weekDates.map((date) => {
              const entry = entries.find((candidate) => candidate.periodId === DEMO_PERIOD_ID && candidate.workDate === date);
              return (
                <LedgerRow
                  key={date}
                  date={date}
                  entry={entry}
                  detailed
                  onPress={entry?.status === 'NEEDS_ATTENTION' ? () => navigation.navigate('Attention', { entryId: entry.id }) : undefined}
                />
              );
            })}
          </View>
        ) : (
          <View style={styles.summary}>
            <SummaryRow label="Approved" value={approved} color={colors.green} />
            <SummaryRow label="Needs attention" value={attention} color={colors.amber} />
            <SummaryRow label="Waiting or submitted" value={pending} color={colors.slate} />
          </View>
        )}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>TOTAL RECORDED</Text>
          <View style={styles.totalRow}>
            <Text style={styles.total}>{total.toFixed(1)}</Text><Text style={styles.totalUnit}> h</Text>
            <Text style={styles.of}> of 80 h</Text>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, (total / 80) * 100)}%` }]} /></View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: number; color: string }) {
  return <View style={styles.summaryRow}><View style={[styles.summaryDot, { backgroundColor: color }]} /><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  title: { marginTop: 31, fontFamily: fonts.sansBold, fontSize: 42, lineHeight: 48, letterSpacing: -1.6, color: colors.navy },
  period: { marginTop: 4, fontFamily: fonts.sans, fontSize: 22, color: colors.slate },
  segment: { flexDirection: 'row', marginTop: 30, marginBottom: 20, borderWidth: 1, borderColor: colors.divider, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.paperLight },
  segmentButton: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  segmentSelected: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.dividerStrong, borderRadius: radius.md },
  segmentText: { fontFamily: fonts.sansMedium, fontSize: 17, color: colors.slate },
  segmentTextSelected: { color: colors.navy, fontFamily: fonts.sansSemiBold },
  ledger: { marginBottom: 18 },
  summary: { paddingVertical: 8, marginBottom: 18 },
  summaryRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  summaryDot: { width: 12, height: 12, borderRadius: 6, marginRight: 14 },
  summaryLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 17, color: colors.navy },
  summaryValue: { fontFamily: fonts.monoSemiBold, fontSize: 17, color: colors.navy },
  totalCard: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.divider, borderRadius: radius.md, padding: 18, backgroundColor: colors.paperLight },
  totalLabel: { fontFamily: fonts.mono, fontSize: 13, letterSpacing: 0.8, color: colors.slate },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 7 },
  total: { fontFamily: fonts.sansSemiBold, fontSize: 38, color: colors.navy, letterSpacing: -1.7 },
  totalUnit: { fontFamily: fonts.sansMedium, fontSize: 19, color: colors.navy },
  of: { marginLeft: 12, fontFamily: fonts.sans, fontSize: 18, color: colors.slate },
  progressTrack: { marginTop: 13, height: 10, borderRadius: 5, backgroundColor: '#E5E4E0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5, backgroundColor: colors.navy },
});
