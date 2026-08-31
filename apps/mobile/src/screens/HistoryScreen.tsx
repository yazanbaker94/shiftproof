import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../app/AppProvider';
import { ConnectivityStatus } from '../components/ConnectivityStatus';
import { Icon } from '../components/Icon';
import { PrimaryAction } from '../components/PrimaryAction';
import { ProofMark } from '../components/ProofMark';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, sharedStyles } from '../theme';

export function HistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { entries, isOnline, isSyncing } = useApp();
  const syncedCount = entries.filter((entry) => entry.receiptId).length;
  return (
    <SafeAreaView style={sharedStyles.page} edges={['top']}>
      <ScrollView contentContainerStyle={sharedStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><ProofMark /><ConnectivityStatus online={isOnline} syncing={isSyncing} /></View>
        <Text style={styles.title}>Proof history</Text>
        <Text style={styles.intro}>Every saved, synced, reviewed and approved state leaves a visible record.</Text>
        <View style={styles.timeline}>
          <TimelineRow icon="phone" eyebrow="LOCAL PROOF" title="Entry saved on device" detail={`${entries.filter((entry) => entry.status === 'PENDING_SYNC').length} waiting to sync`} color={colors.blue} />
          <TimelineRow icon="cloud" eyebrow="SYNC RECEIPTS" title="Matched with the server" detail={`${syncedCount} durable sync receipts`} color={colors.green} />
          <TimelineRow icon="shield" eyebrow="PAYROLL PROOF" title="Approved timesheet" detail="Receipt SP-82F14 · Sep 01, 2026" color={colors.green} last />
        </View>
        <View style={styles.receiptPreview}>
          <View style={styles.receiptIcon}><Icon name="receipt" size={30} color={colors.green} /></View>
          <View style={styles.receiptCopy}><Text style={styles.receiptTitle}>39.5 hours approved</Text><Text style={styles.receiptDetail}>Aug 24 – Sep 06 · Ready for payroll</Text></View>
        </View>
        <PrimaryAction label="Open approved receipt" icon="receipt" onPress={() => navigation.navigate('Receipt')} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TimelineRow({ icon, eyebrow, title, detail, color, last = false }: { icon: 'phone' | 'cloud' | 'shield'; eyebrow: string; title: string; detail: string; color: string; last?: boolean }) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}><View style={[styles.timelineDot, { borderColor: color }]}><Icon name={icon} size={18} color={color} /></View>{!last && <View style={styles.timelineLine} />}</View>
      <View style={styles.timelineCopy}><Text style={styles.timelineEyebrow}>{eyebrow}</Text><Text style={styles.timelineTitle}>{title}</Text><Text style={styles.timelineDetail}>{detail}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { marginTop: 30, fontFamily: fonts.sansBold, fontSize: 42, lineHeight: 48, letterSpacing: -1.6, color: colors.navy },
  intro: { marginTop: 7, maxWidth: 340, fontFamily: fonts.sans, fontSize: 17, lineHeight: 25, color: colors.navySoft },
  timeline: { marginTop: 29 },
  timelineRow: { minHeight: 112, flexDirection: 'row' },
  timelineRail: { width: 54, alignItems: 'center' },
  timelineDot: { width: 43, height: 43, borderRadius: 22, borderWidth: 1.5, backgroundColor: colors.paperLight, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { flex: 1, width: StyleSheet.hairlineWidth, backgroundColor: colors.dividerStrong },
  timelineCopy: { flex: 1, paddingLeft: 13, paddingBottom: 24 },
  timelineEyebrow: { fontFamily: fonts.monoSemiBold, fontSize: 11, letterSpacing: 0.7, color: colors.slate },
  timelineTitle: { marginTop: 4, fontFamily: fonts.sansSemiBold, fontSize: 19, color: colors.navy },
  timelineDetail: { marginTop: 3, fontFamily: fonts.sans, fontSize: 15, color: colors.slate },
  receiptPreview: { minHeight: 92, marginBottom: 17, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dividerStrong, borderRadius: radius.md, backgroundColor: colors.paperLight, padding: 16 },
  receiptIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.greenWash, alignItems: 'center', justifyContent: 'center' },
  receiptCopy: { flex: 1 },
  receiptTitle: { fontFamily: fonts.sansSemiBold, fontSize: 19, color: colors.navy },
  receiptDetail: { marginTop: 2, fontFamily: fonts.sans, fontSize: 14, color: colors.slate },
});
