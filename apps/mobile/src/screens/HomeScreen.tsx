import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../app/AppProvider';
import { Icon } from '../components/Icon';
import { LedgerRow } from '../components/LedgerRow';
import { PeriodHeader } from '../components/PeriodHeader';
import { PrimaryAction } from '../components/PrimaryAction';
import { ScreenHeader } from '../components/ScreenHeader';
import { calculateEntriesTotalMinutes } from '../domain/logic';
import { HOME_SNAPSHOT_PERIOD_ID } from '../data/database';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, sharedStyles, spacing } from '../theme';

const weekDates = ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'];

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { entries, connectionStatus, isSyncing } = useApp();
  const weekEntries = entries.filter((entry) => entry.periodId === HOME_SNAPSHOT_PERIOD_ID && weekDates.includes(entry.workDate));
  const totalHours = calculateEntriesTotalMinutes(weekEntries) / 60;
  return (
    <SafeAreaView style={sharedStyles.page} edges={['top']}>
      <ScrollView contentContainerStyle={sharedStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <ScreenHeader kind="brand" online={connectionStatus} syncing={isSyncing} />
        <PeriodHeader totalHours={totalHours} />
        <View style={styles.ledger}>
          {weekDates.map((date) => {
            const entry = entries.find((candidate) => candidate.periodId === HOME_SNAPSHOT_PERIOD_ID && candidate.workDate === date);
            return (
              <LedgerRow
                key={date}
                date={date}
                entry={entry}
                onPress={entry?.status === 'NEEDS_ATTENTION' ? () => navigation.navigate('Attention', { entryId: entry.id }) : undefined}
              />
            );
          })}
        </View>
        <View style={styles.deadline}>
          <View style={styles.deadlineIcon}><Icon name="calendar" size={29} color={colors.green} /></View>
          <View style={styles.deadlineCopy}>
            <Text style={styles.deadlineTitle}>Submission deadline</Text>
            <Text style={styles.deadlineGreen}>3 days left</Text>
            <Text style={styles.deadlineDate}>Fri, Sep 05 · 11:59 PM</Text>
          </View>
        </View>
        <PrimaryAction
          label="Add hours"
          icon="plus"
          onPress={() => navigation.navigate('AddHours')}
          accessibilityHint="Opens the time entry form. Entries save locally and synchronize automatically when connected."
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ledger: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.dividerStrong, marginBottom: spacing.lg },
  deadline: { flexDirection: 'row', alignItems: 'center', gap: 17, minHeight: 116, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dividerStrong, borderRadius: radius.md, padding: 17, marginBottom: 18, backgroundColor: colors.paperLight },
  deadlineIcon: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  deadlineCopy: { flex: 1 },
  deadlineTitle: { fontFamily: fonts.sansSemiBold, color: colors.navy, fontSize: 18 },
  deadlineGreen: { marginTop: 2, fontFamily: fonts.monoMedium, color: colors.green, fontSize: 16 },
  deadlineDate: { marginTop: 3, fontFamily: fonts.mono, color: colors.navySoft, fontSize: 13 },
});
