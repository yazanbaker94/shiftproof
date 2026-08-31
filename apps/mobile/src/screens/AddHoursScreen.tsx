import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../app/AppProvider';
import { HoursDisplay } from '../components/HoursDisplay';
import { Icon } from '../components/Icon';
import { PrimaryAction } from '../components/PrimaryAction';
import { ScreenHeader } from '../components/ScreenHeader';
import { calculateTotalMinutes, formatDecimalHours } from '../domain/logic';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, sharedStyles } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'AddHours'>;

export function AddHoursScreen({ navigation, route }: Props) {
  const { findEntry, saveEntry } = useApp();
  const existing = route.params?.entryId ? findEntry(route.params.entryId) : undefined;
  const [regularMinutes, setRegularMinutes] = useState(existing?.regularMinutes ?? 480);
  const [overtimeMinutes, setOvertimeMinutes] = useState(existing?.overtimeMinutes ?? 90);
  const [note, setNote] = useState(existing?.note || 'Covered evening inventory count.');
  const [saving, setSaving] = useState(false);
  const total = regularMinutes + overtimeMinutes;
  const canAdd = (amount: number) => total + amount <= 24 * 60;
  const date = existing?.workDate ?? '2026-09-01';
  const dateLabel = useMemo(() => date === '2026-09-01' ? 'Tue, Sep 01' : date, [date]);

  const onSave = async () => {
    setSaving(true);
    try {
      const entry = await saveEntry({ workDate: date, regularMinutes, overtimeMinutes, note: note.trim() });
      navigation.replace('SavedOffline', { entryId: entry.id });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={sharedStyles.page} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <ScreenHeader kind="title" title="Add hours" onBack={() => navigation.goBack()} rightLabel="Cancel" onRight={() => navigation.goBack()} />
          <View style={styles.dateRow}><Icon name="calendar" size={26} color={colors.slate} /><Text style={styles.date}>{dateLabel}</Text></View>
          <View style={styles.hoursCard}>
            <HoursDisplay
              label="Regular hours"
              minutes={regularMinutes}
              prominent
              onDecrease={() => setRegularMinutes((value) => Math.max(0, value - 30))}
              onIncrease={() => canAdd(30) && setRegularMinutes((value) => value + 30)}
            />
            <View style={sharedStyles.divider} />
            <HoursDisplay
              label="Overtime"
              minutes={overtimeMinutes}
              onDecrease={() => setOvertimeMinutes((value) => Math.max(0, value - 30))}
              onIncrease={() => canAdd(30) && setOvertimeMinutes((value) => value + 30)}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Load the sixteen hour review example"
            onPress={() => { setRegularMinutes(960); setOvertimeMinutes(0); setNote('Emergency inventory count after closing.'); }}
            style={styles.preset}
          >
            <Text style={styles.presetText}>LOAD 16.0 H REVIEW EXAMPLE →</Text>
          </Pressable>
          <Text style={styles.noteLabel}>NOTE (OPTIONAL)</Text>
          <TextInput
            accessibilityLabel="Optional note"
            style={styles.noteInput}
            multiline
            maxLength={280}
            value={note}
            onChangeText={setNote}
            placeholder="Add context for your manager"
            placeholderTextColor={colors.slateLight}
            textAlignVertical="top"
          />
          <View style={styles.totalCard}>
            <View style={styles.totalCheck}><Icon name="check" color={colors.white} size={22} strokeWidth={2.3} /></View>
            <View>
              <Text style={styles.total}>{formatDecimalHours(total)} hours</Text>
              <Text style={styles.totalBreakdown}>{formatDecimalHours(regularMinutes)} regular + {formatDecimalHours(overtimeMinutes)} overtime</Text>
            </View>
          </View>
          <PrimaryAction label="Save entry" onPress={onSave} loading={saving} disabled={total <= 0} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 24 },
  dateRow: { marginTop: 17, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 14 },
  date: { fontFamily: fonts.sansMedium, fontSize: 22, color: colors.navy },
  hoursCard: { marginTop: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dividerStrong, borderRadius: radius.md, paddingHorizontal: 18, backgroundColor: colors.paperLight },
  preset: { minHeight: 48, alignItems: 'flex-end', justifyContent: 'center' },
  presetText: { fontFamily: fonts.monoSemiBold, fontSize: 11, letterSpacing: 0.5, color: colors.blue },
  noteLabel: { marginTop: 9, marginBottom: 9, fontFamily: fonts.monoSemiBold, fontSize: 14, letterSpacing: 0.4, color: colors.navy },
  noteInput: { minHeight: 116, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dividerStrong, borderRadius: radius.md, backgroundColor: colors.paperLight, padding: 16, fontFamily: fonts.sans, fontSize: 17, lineHeight: 24, color: colors.navy },
  totalCard: { minHeight: 86, marginVertical: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dividerStrong, borderRadius: radius.md, backgroundColor: colors.paperLight, flexDirection: 'row', alignItems: 'center', gap: 16 },
  totalCheck: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  total: { fontFamily: fonts.sansSemiBold, fontSize: 23, color: colors.navy, fontVariant: ['tabular-nums'] },
  totalBreakdown: { marginTop: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.slate },
});
