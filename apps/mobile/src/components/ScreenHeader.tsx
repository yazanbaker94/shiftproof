import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { IconName } from './Icon';
import { Icon } from './Icon';
import { ConnectivityStatus } from './ConnectivityStatus';
import { ProofMark } from './ProofMark';
import { colors, fonts } from '../theme';

type Props =
  | { kind: 'brand'; online: boolean | null; syncing?: boolean }
  | { kind: 'title'; title: string; onBack: () => void; online?: boolean | null; rightLabel?: string; onRight?: () => void; icon?: IconName };

export function ScreenHeader(props: Props) {
  if (props.kind === 'brand') {
    return <View style={styles.header}><ProofMark /><ConnectivityStatus online={props.online} syncing={props.syncing} /></View>;
  }
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={props.onBack} style={styles.back}>
        <Icon name={props.icon ?? 'back'} color={colors.navy} size={27} />
      </Pressable>
      <Text style={styles.title} numberOfLines={2}>{props.title}</Text>
      {props.online !== undefined ? (
        <ConnectivityStatus online={props.online} compact />
      ) : props.rightLabel ? (
        <Pressable accessibilityRole="button" onPress={props.onRight} style={styles.rightButton}>
          <Text style={styles.rightLabel}>{props.rightLabel}</Text>
        </Pressable>
      ) : <View style={styles.placeholder} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 48, height: 48, marginLeft: -12, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: fonts.sansSemiBold, fontSize: 25, lineHeight: 29, color: colors.navy },
  rightButton: { minWidth: 64, minHeight: 48, alignItems: 'flex-end', justifyContent: 'center' },
  rightLabel: { fontFamily: fonts.sansMedium, fontSize: 17, color: colors.navy },
  placeholder: { width: 48 },
});
