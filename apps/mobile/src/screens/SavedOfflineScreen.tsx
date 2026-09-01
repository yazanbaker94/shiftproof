import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../app/AppProvider';
import { PeriodHeader } from '../components/PeriodHeader';
import { PrimaryAction } from '../components/PrimaryAction';
import { ProofSlip } from '../components/ProofSlip';
import { ScreenHeader } from '../components/ScreenHeader';
import { calculateEntriesTotalMinutes } from '../domain/logic';
import { HOME_SNAPSHOT_PERIOD_ID } from '../data/database';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, sharedStyles } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SavedOffline'>;

export function SavedOfflineScreen({ navigation, route }: Props) {
  const { entries, findEntry, isOnline, connectionStatus, isSyncing } = useApp();
  const entry = findEntry(route.params.entryId);
  const homeEntries = entries.filter((item) => item.periodId === HOME_SNAPSHOT_PERIOD_ID);
  const total = calculateEntriesTotalMinutes(homeEntries) / 60;
  if (!entry) {
    return <SafeAreaView style={[sharedStyles.page, styles.center]}><Text style={styles.missing}>The local entry could not be found.</Text><PrimaryAction label="Home" onPress={() => navigation.navigate('Main')} /></SafeAreaView>;
  }
  const synced = entry.status !== 'PENDING_SYNC';
  const actionLabel = entry.status === 'NEEDS_ATTENTION' ? 'Open review' : synced ? 'View timesheet' : 'Home';
  const onAction = () => {
    if (entry.status === 'NEEDS_ATTENTION') return navigation.replace('Attention', { entryId: entry.id });
    if (synced) return navigation.navigate('Main', { screen: 'Timesheet' });
    navigation.navigate('Main', { screen: 'Home' });
  };
  return (
    <SafeAreaView style={sharedStyles.page} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader kind="brand" online={connectionStatus} syncing={isSyncing} />
        <PeriodHeader totalHours={total} compact />
        <ProofSlip entry={entry} synced={synced} />
        {!synced && (
          <Text style={styles.autoSync} accessibilityLiveRegion="polite">
            {isOnline && isSyncing ? 'Synchronizing automatically…' : 'Saved safely. Synchronization runs automatically when connected.'}
          </Text>
        )}
        <PrimaryAction label={actionLabel} icon="home" onPress={onAction} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingBottom: 24 },
  center: { padding: 24, justifyContent: 'center' },
  missing: { marginBottom: 20, fontFamily: fonts.sansMedium, color: colors.navy, fontSize: 18 },
  autoSync: { marginBottom: 14, textAlign: 'center', fontFamily: fonts.sansMedium, color: colors.slate, fontSize: 14, lineHeight: 20 },
});
