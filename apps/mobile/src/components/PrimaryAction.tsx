import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { IconName } from './Icon';
import { Icon } from './Icon';
import { colors, fonts, radius } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'green';
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}

export function PrimaryAction({
  label,
  onPress,
  icon,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityHint,
}: Props) {
  const foreground = variant === 'secondary' ? colors.navy : colors.white;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'green' && styles.green,
        variant === 'secondary' && styles.secondary,
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <View style={styles.content}>
          {icon && <Icon name={icon} color={foreground} size={24} />}
          <Text style={[styles.label, { color: foreground }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 58, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primary: { backgroundColor: colors.navy },
  green: { backgroundColor: colors.green },
  secondary: { backgroundColor: colors.paperLight, borderWidth: 1, borderColor: colors.dividerStrong },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 18 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.52 },
});
