import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../app/AppProvider';
import { DemoNetworkControl } from '../components/DemoNetworkControl';
import { PrimaryAction } from '../components/PrimaryAction';
import { ProofMark } from '../components/ProofMark';
import { buildMetadata } from '../observability/build';
import { colors, fonts, radius, sharedStyles } from '../theme';

export function ProfileScreen() {
  const { lastSyncSummary, pendingOperationCount, resetDemo, actualNetworkReachable } = useApp();
  const askReset = () => Alert.alert(
    'Reset the ShiftProof demo?',
    'This removes locally created demo entries and restores the seeded hiring scenario.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset demo', style: 'destructive', onPress: () => void resetDemo() },
    ],
  );
  return (
    <SafeAreaView style={sharedStyles.page} edges={['top']}>
      <ScrollView contentContainerStyle={sharedStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.brand}><ProofMark /></View>
        <Text style={styles.title}>Reviewer controls</Text>
        <Text style={styles.intro}>Connectivity and synchronization are automatic. Use the simulation only to demonstrate local saving.</Text>
        <DemoNetworkControl />
        <View style={styles.stats}>
          <Stat label="PENDING ON DEVICE" value={String(pendingOperationCount).padStart(2, '0')} />
          <Stat label="DEVICE INTERNET" value={actualNetworkReachable === false ? 'OFF' : actualNetworkReachable === true ? 'ON' : '—'} />
        </View>
        {lastSyncSummary && (
          <Text style={styles.syncResult} accessibilityLiveRegion="polite">
            Last sync: {lastSyncSummary.succeeded} succeeded · {lastSyncSummary.failed} deferred
          </Text>
        )}
        <Text style={styles.automaticNote}>Pending entries synchronize automatically as soon as device internet is available.</Text>
        <PrimaryAction label="Reset demo data" onPress={askReset} variant="secondary" />
        <View style={styles.buildCard}>
          <Text style={styles.buildTitle}>BUILD EVIDENCE</Text>
          <BuildRow label="Application" value={buildMetadata.applicationId} />
          <BuildRow label="Version" value={`${buildMetadata.version} (${buildMetadata.buildVersion})`} />
          <BuildRow label="Build ID" value={buildMetadata.buildId} />
          <BuildRow label="API" value={buildMetadata.apiUrl} />
          <Text style={styles.tagline}>Hours worked. Proof earned.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function BuildRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.buildRow}><Text style={styles.buildLabel}>{label}</Text><Text style={styles.buildValue} numberOfLines={1}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  brand: { minHeight: 58, justifyContent: 'center' },
  title: { marginTop: 30, fontFamily: fonts.sansBold, fontSize: 42, lineHeight: 48, letterSpacing: -1.6, color: colors.navy },
  intro: { marginTop: 7, fontFamily: fonts.sans, fontSize: 17, lineHeight: 25, color: colors.navySoft },
  stats: { flexDirection: 'row', gap: 12, marginVertical: 20 },
  stat: { flex: 1, minHeight: 96, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dividerStrong, borderRadius: radius.md, backgroundColor: colors.paperLight, justifyContent: 'center', padding: 15 },
  statValue: { fontFamily: fonts.monoSemiBold, fontSize: 27, color: colors.navy },
  statLabel: { marginTop: 5, fontFamily: fonts.mono, fontSize: 10, letterSpacing: 0.5, color: colors.slate },
  syncResult: { marginBottom: 14, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.green },
  automaticNote: { marginBottom: 16, fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 20, color: colors.navySoft },
  buildCard: { marginTop: 23, padding: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.divider, borderRadius: radius.md, backgroundColor: colors.paperLight },
  buildTitle: { marginBottom: 8, fontFamily: fonts.monoSemiBold, fontSize: 12, letterSpacing: 0.8, color: colors.navy },
  buildRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  buildLabel: { width: 88, fontFamily: fonts.sans, fontSize: 13, color: colors.slate },
  buildValue: { flex: 1, textAlign: 'right', fontFamily: fonts.mono, fontSize: 11, color: colors.navy },
  tagline: { marginTop: 16, fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.green },
});
