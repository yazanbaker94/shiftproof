import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Share, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../app/AppProvider';
import { ConnectivityStatus } from '../components/ConnectivityStatus';
import { Icon } from '../components/Icon';
import { PrimaryAction } from '../components/PrimaryAction';
import { ProofMark } from '../components/ProofMark';
import { calculateEntriesTotalMinutes } from '../domain/logic';
import { REVIEW_SNAPSHOT_PERIOD_ID } from '../data/database';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, sharedStyles } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Receipt'>;

export function ApprovedReceiptScreen({ navigation }: Props) {
  const { entries, isOnline } = useApp();
  const weekEntries = entries.filter((entry) => entry.periodId === REVIEW_SNAPSHOT_PERIOD_ID);
  const total = calculateEntriesTotalMinutes(weekEntries) / 60 || 39.5;
  const receiptText = `ShiftProof receipt SP-82F14\nAug 24 – Sep 06\n${total.toFixed(1)} hours\nApproved Sep 01, 2026 at 12:42 AM\nReady for payroll.`;
  const share = () => void Share.share({ title: 'ShiftProof receipt SP-82F14', message: receiptText });
  return (
    <SafeAreaView style={sharedStyles.page} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><ProofMark /><ConnectivityStatus online={isOnline} /></View>
        <View style={styles.receipt}>
          <View style={styles.approvedMark}><Icon name="check" size={57} color={colors.green} strokeWidth={1.9} /></View>
          <Text style={styles.approved}>APPROVED</Text>
          <Text style={styles.ready}>Your timesheet is ready for payroll.</Text>
          <View style={styles.rule} />
          <Text style={styles.totalLabel}>TOTAL HOURS</Text>
          <View style={styles.totalRow}><Text style={styles.total}>{total.toFixed(1)}</Text><Text style={styles.totalUnit}> h</Text></View>
          <View style={styles.rule} />
          <ReceiptRow icon="calendar" label="Period" value="Aug 24 – Sep 06" />
          <ReceiptRow icon="history" label="Approved" value="Sep 01, 2026 at 12:42 AM" />
          <ReceiptRow icon="receipt" label="Receipt ID" value="SP-82F14" />
          <View style={styles.proofRow}><Icon name="shield" size={36} color={colors.green} /><View><Text style={styles.proofTitle}>This is your proof.</Text><Text style={styles.proofDetail}>Stored securely and ready for payroll.</Text></View></View>
        </View>
        <PrimaryAction label="Download receipt" icon="download" onPress={share} />
        <View style={styles.gap} />
        <PrimaryAction label="Share receipt" icon="share" onPress={share} variant="secondary" />
        <View style={styles.gap} />
        <PrimaryAction label="Back to history" onPress={() => navigation.goBack()} variant="secondary" />
      </ScrollView>
    </SafeAreaView>
  );
}

function ReceiptRow({ icon, label, value }: { icon: 'calendar' | 'history' | 'receipt'; label: string; value: string }) {
  return <View style={styles.receiptRow}><Icon name={icon} size={21} color={colors.green} /><Text style={styles.rowLabel}>{label}</Text><View style={styles.dots} /><Text style={styles.rowValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingBottom: 24 },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  receipt: { marginTop: 28, marginBottom: 20, paddingHorizontal: 24, paddingVertical: 30, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dividerStrong, borderRadius: radius.sm, backgroundColor: colors.paperRaised, shadowColor: colors.black, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  approvedMark: { alignSelf: 'center', width: 114, height: 114, borderRadius: 57, borderWidth: 5, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  approved: { marginTop: 20, textAlign: 'center', fontFamily: fonts.sansBold, fontSize: 39, letterSpacing: -1.3, color: colors.green },
  ready: { marginTop: 6, textAlign: 'center', fontFamily: fonts.sansMedium, fontSize: 17, color: colors.navy },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginVertical: 21 },
  totalLabel: { textAlign: 'center', fontFamily: fonts.monoSemiBold, fontSize: 14, letterSpacing: 0.6, color: colors.navy },
  totalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline', marginTop: 6 },
  total: { fontFamily: fonts.sansBold, fontSize: 67, lineHeight: 76, letterSpacing: -3.3, color: colors.navy, fontVariant: ['tabular-nums'] },
  totalUnit: { fontFamily: fonts.sansSemiBold, fontSize: 27, color: colors.navy },
  receiptRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', gap: 9 },
  rowLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.navy },
  dots: { flex: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderStyle: 'dotted', borderBottomColor: colors.dividerStrong },
  rowValue: { maxWidth: '55%', textAlign: 'right', fontFamily: fonts.sansMedium, fontSize: 13, color: colors.navy },
  proofRow: { marginTop: 22, paddingTop: 22, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14 },
  proofTitle: { fontFamily: fonts.sansSemiBold, fontSize: 17, color: colors.navy },
  proofDetail: { marginTop: 2, fontFamily: fonts.sans, fontSize: 13, color: colors.slate },
  gap: { height: 10 },
});
