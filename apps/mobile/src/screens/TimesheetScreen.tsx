import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app/AppProvider';
import { LedgerRow } from '../components/LedgerRow';
import { ScreenHeader } from '../components/ScreenHeader';
import { calculateEntriesTotalMinutes } from '../domain/logic';
import { DEMO_CLIENT_IDS, DEMO_PERIOD_ID } from '../data/database';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, sharedStyles } from '../theme';

const periodWeeks = [
  {
    label: 'Aug 24–30',
    dates: ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'],
  },
  {
    label: 'Aug 31–Sep 06',
    dates: ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'],
  },
] as const;

const canonicalEntryIds = new Set<string>([
  DEMO_CLIENT_IDS.apiMonday,
  DEMO_CLIENT_IDS.apiTuesdayAttention,
  DEMO_CLIENT_IDS.apiWednesday,
  DEMO_CLIENT_IDS.apiThursday,
]);

export function TimesheetScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { entries, connectionStatus, isSyncing, checkForUpdates } = useApp();
  const [view, setView] = useState<'week' | 'summary'>('week');
  const periodEntries = useMemo(
    () => entries.filter((entry) => entry.periodId === DEMO_PERIOD_ID),
    [entries],
  );
  const [selectedWeek, setSelectedWeek] = useState(0);
  const weekDates = (periodWeeks[selectedWeek] ?? periodWeeks[0]).dates;
  const weekEntries = periodEntries.filter((entry) =>
    (weekDates as readonly string[]).includes(entry.workDate),
  );
  const total = calculateEntriesTotalMinutes(periodEntries) / 60;
  const payrollReady = periodEntries.filter((entry) => entry.status === 'PAYROLL_READY').length;
  const sampleApproved = periodEntries.filter((entry) => entry.status === 'APPROVED').length;
  const attention = periodEntries.filter((entry) => entry.status === 'NEEDS_ATTENTION').length;
  const returned = periodEntries.filter((entry) => entry.status === 'RETURNED').length;
  const pending = periodEntries.filter((entry) => entry.status === 'PENDING_SYNC').length;
  const readyForReview = periodEntries.filter((entry) => entry.status === 'SUBMITTED').length;
  const localDemo = periodEntries.filter((entry) => entry.status === 'LOCAL_DEMO').length;
  const autoSelectedEntryId = useRef<string | null>(null);

  useEffect(() => {
    const latestMobileEntry = [...periodEntries]
      .filter((entry) => !canonicalEntryIds.has(entry.id))
      .sort((left, right) => right.localCreatedAt.localeCompare(left.localCreatedAt))[0];
    if (!latestMobileEntry || autoSelectedEntryId.current === latestMobileEntry.id) return;
    const nextWeek = periodWeeks.findIndex((week) =>
      (week.dates as readonly string[]).includes(latestMobileEntry.workDate),
    );
    if (nextWeek >= 0) {
      autoSelectedEntryId.current = latestMobileEntry.id;
      setSelectedWeek(nextWeek);
    }
  }, [periodEntries]);

  useFocusEffect(useCallback(() => {
    void checkForUpdates();
    const timer = setInterval(() => void checkForUpdates(), 12_000);
    return () => clearInterval(timer);
  }, [checkForUpdates]));
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
          <View>
            <View style={styles.weekSwitcher} accessibilityRole="tablist">
              {periodWeeks.map((week, index) => (
                <Pressable
                  key={week.label}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: selectedWeek === index }}
                  onPress={() => setSelectedWeek(index)}
                  style={[styles.weekButton, selectedWeek === index && styles.weekButtonSelected]}
                >
                  <Text style={[styles.weekButtonText, selectedWeek === index && styles.weekButtonTextSelected]}>
                    {week.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.ledger}>
              {weekDates.map((date) => {
                const entry = weekEntries.find((candidate) => candidate.workDate === date);
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
          </View>
        ) : (
          <View style={styles.summary}>
            <SummaryRow label="Payroll ready" value={payrollReady} color={colors.green} />
            {sampleApproved > 0 && <SummaryRow label="Approved sample" value={sampleApproved} color={colors.greenDark} />}
            <SummaryRow label="Ready for manager" value={readyForReview} color={colors.blue} />
            <SummaryRow label="Needs attention" value={attention} color={colors.amber} />
            {returned > 0 && <SummaryRow label="Returned by manager" value={returned} color={colors.amberDark} />}
            {localDemo > 0 && <SummaryRow label="Local demo only" value={localDemo} color={colors.blue} />}
            <SummaryRow label="Pending sync" value={pending} color={colors.slate} />
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
  weekSwitcher: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  weekButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.divider, borderRadius: radius.sm, backgroundColor: colors.paperLight },
  weekButtonSelected: { borderColor: colors.blue, backgroundColor: '#EEF4FC' },
  weekButtonText: { fontFamily: fonts.mono, fontSize: 12, color: colors.slate },
  weekButtonTextSelected: { color: colors.blue, fontFamily: fonts.monoSemiBold },
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
