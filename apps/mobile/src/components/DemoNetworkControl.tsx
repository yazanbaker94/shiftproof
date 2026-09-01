import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../app/AppProvider';
import { colors, fonts, radius } from '../theme';

export function DemoNetworkControl({ quiet = false }: { quiet?: boolean }) {
  const { demoNetworkMode, setDemoNetworkMode, actualNetworkReachable } = useApp();
  return (
    <View style={[styles.container, quiet && styles.quiet]} accessibilityLabel="Reviewer network simulation">
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>REVIEWER NETWORK SIMULATION</Text>
        {!quiet && (
          <Text style={styles.hint}>
            Normal syncing follows the device connection. Simulate offline only to review local saving.
          </Text>
        )}
      </View>
      <View style={styles.segment}>
        {(['automatic', 'offline'] as const).map((mode) => {
          const selected = demoNetworkMode === mode;
          const automatic = mode === 'automatic';
          return (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={automatic ? 'Use device connection automatically' : 'Simulate an offline connection'}
              onPress={() => setDemoNetworkMode(mode)}
              style={({ pressed }) => [styles.option, selected && styles.selected, pressed && styles.pressed]}
            >
              <View style={[styles.optionDot, { backgroundColor: automatic ? colors.green : colors.amber }]} />
              <Text style={[styles.optionText, selected && styles.selectedText]}>
                {automatic ? 'Automatic' : 'Simulate offline'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {!quiet && actualNetworkReachable === false && demoNetworkMode === 'automatic' && (
        <Text style={styles.physicalWarning}>Device internet is unavailable. Entries will sync automatically when it returns.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderColor: colors.divider,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    backgroundColor: colors.paperLight,
    padding: 12,
    marginTop: 14,
  },
  quiet: { paddingVertical: 9 },
  copy: { marginBottom: 8 },
  eyebrow: { fontFamily: fonts.monoSemiBold, fontSize: 10, letterSpacing: 1.1, color: colors.slate },
  hint: { marginTop: 3, fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: colors.slate },
  segment: { flexDirection: 'row', gap: 6 },
  option: {
    minHeight: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.paper,
  },
  selected: { borderColor: colors.navy, backgroundColor: colors.navy },
  pressed: { opacity: 0.78 },
  optionDot: { width: 8, height: 8, borderRadius: 4 },
  optionText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.navy },
  selectedText: { color: colors.white },
  physicalWarning: { marginTop: 7, fontFamily: fonts.sans, fontSize: 12, lineHeight: 16, color: colors.amberDark },
});
