import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../app/AppProvider';
import { Icon } from '../components/Icon';
import { PrimaryAction } from '../components/PrimaryAction';
import { ScreenHeader } from '../components/ScreenHeader';
import { calculateTotalMinutes, formatDecimalHours } from '../domain/logic';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, sharedStyles } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Attention'>;

export function NeedsAttentionScreen({ navigation, route }: Props) {
  const { findEntry, confirmEntry, connectionStatus } = useApp();
  const entry = findEntry(route.params.entryId);
  const [note, setNote] = useState(entry?.note ?? 'Emergency inventory count after closing.');
  const [submitting, setSubmitting] = useState(false);
  const noteRef = useRef<TextInput>(null);
  useEffect(() => setNote(entry?.note ?? ''), [entry?.note]);
  if (!entry) return <SafeAreaView style={sharedStyles.page} />;
  const total = calculateTotalMinutes(entry);
  const dateLabel = new Date(`${entry.workDate}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  }).toUpperCase();
  const submit = async () => {
    setSubmitting(true);
    try {
      await confirmEntry(entry.id, note.trim());
      navigation.navigate('Main');
    } finally { setSubmitting(false); }
  };
  return (
    <SafeAreaView style={sharedStyles.page} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ScreenHeader kind="title" title="Entry needs attention" onBack={() => navigation.goBack()} online={connectionStatus} />
          <Text style={styles.date}>{dateLabel}</Text>
          <View style={styles.attentionCard}>
            <View style={styles.hoursRow}><Text style={styles.hours}>{formatDecimalHours(total)}</Text><Text style={styles.hoursUnit}> hours</Text></View>
            <View style={styles.warningRow}><View style={styles.warningMark}><Text style={styles.warningBang}>!</Text></View><Text style={styles.warning}>Unusual hours</Text></View>
            <View style={styles.rule} />
            <Text style={styles.explanation}>This is higher than usual for this day.{`\n`}Double-check the entry or add a note for your manager.</Text>
          </View>
          <Text style={styles.sectionTitle}>RESOLVE THIS ENTRY</Text>
          <View style={styles.options}>
            <Option icon="edit" title="Edit hours" detail="Change the hours for this day." onPress={() => navigation.navigate('AddHours', { entryId: entry.id })} />
            <View style={styles.rule} />
            <Option icon="note" title="Confirm with note" detail="Add a note to explain this entry." onPress={() => noteRef.current?.focus()} />
          </View>
          <Text style={styles.noteLabel}>NOTE (OPTIONAL)</Text>
          <TextInput
            ref={noteRef}
            accessibilityLabel="Note for manager"
            multiline
            maxLength={280}
            value={note}
            onChangeText={setNote}
            style={styles.noteInput}
            textAlignVertical="top"
          />
          <PrimaryAction label="Submit for review" onPress={() => void submit()} loading={submitting} disabled={!note.trim()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Option({ icon, title, detail, onPress }: { icon: 'edit' | 'note'; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`} onPress={onPress} style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}>
      <View style={styles.optionIcon}><Icon name={icon} size={28} color={colors.navy} /></View>
      <View style={styles.optionCopy}><Text style={styles.optionTitle}>{title}</Text><Text style={styles.optionDetail}>{detail}</Text></View>
      <Icon name="chevron" size={24} color={colors.slate} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 24 },
  date: { marginTop: 22, marginBottom: 18, fontFamily: fonts.monoSemiBold, fontSize: 15, letterSpacing: 0.7, color: colors.navy },
  attentionCard: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dividerStrong, borderRadius: radius.md, backgroundColor: colors.paperLight, padding: 20 },
  hoursRow: { flexDirection: 'row', alignItems: 'baseline' },
  hours: { fontFamily: fonts.sansBold, fontSize: 64, lineHeight: 72, color: colors.navy, letterSpacing: -3.2, fontVariant: ['tabular-nums'] },
  hoursUnit: { marginLeft: 8, fontFamily: fonts.sansSemiBold, fontSize: 25, color: colors.navy },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  warningMark: { width: 29, height: 29, borderRadius: 15, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' },
  warningBang: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.white },
  warning: { fontFamily: fonts.sansSemiBold, fontSize: 22, color: colors.amber },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginVertical: 19 },
  explanation: { fontFamily: fonts.sans, fontSize: 17, lineHeight: 25, color: colors.navySoft },
  sectionTitle: { marginTop: 25, marginBottom: 11, fontFamily: fonts.monoSemiBold, fontSize: 14, letterSpacing: 0.8, color: colors.navy },
  options: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dividerStrong, borderRadius: radius.md, backgroundColor: colors.paperLight, paddingHorizontal: 16 },
  option: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 14 },
  optionPressed: { opacity: 0.65 },
  optionIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1EEE8' },
  optionCopy: { flex: 1 },
  optionTitle: { fontFamily: fonts.sansSemiBold, fontSize: 19, color: colors.navy },
  optionDetail: { marginTop: 2, fontFamily: fonts.sans, fontSize: 15, color: colors.navySoft },
  noteLabel: { marginTop: 24, marginBottom: 9, fontFamily: fonts.monoSemiBold, fontSize: 14, letterSpacing: 0.4, color: colors.navy },
  noteInput: { minHeight: 114, marginBottom: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dividerStrong, borderRadius: radius.md, backgroundColor: colors.paperLight, padding: 16, fontFamily: fonts.sans, fontSize: 17, lineHeight: 24, color: colors.navy },
});
