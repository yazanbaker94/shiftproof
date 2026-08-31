import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '../theme';

interface Props { totalHours: number; targetHours?: number; compact?: boolean }

function ProgressRing({ percent }: { percent: number }) {
  const size = 94;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalized = Math.min(100, Math.max(0, percent));
  const offset = circumference * (1 - normalized / 100);
  return (
    <View style={styles.ringWrap} accessibilityLabel={`${Math.round(normalized)} percent of target recorded`}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.divider} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.green}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          fill="none"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={styles.percent}>{Math.round(normalized)}%</Text>
    </View>
  );
}

export function PeriodHeader({ totalHours, targetHours = 40, compact = false }: Props) {
  const percent = targetHours === 0 ? 0 : (totalHours / targetHours) * 100;
  return (
    <View style={[styles.container, compact && styles.compact]}>
      <View>
        <Text style={styles.period}>AUG 24 — SEP 06</Text>
        <View style={styles.totalRow}>
          <Text style={[styles.total, compact && styles.totalCompact]}>{totalHours.toFixed(1)}</Text>
          <Text style={styles.unit}>h</Text>
        </View>
        <Text style={styles.target}>of {targetHours} h</Text>
      </View>
      <ProgressRing percent={percent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 34, marginBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compact: { marginTop: 22, marginBottom: 12 },
  period: { fontFamily: fonts.monoSemiBold, color: colors.navy, fontSize: 16, letterSpacing: 0.6 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 7 },
  total: { fontFamily: fonts.sansBold, fontSize: 68, lineHeight: 74, letterSpacing: -3.5, color: colors.navy, fontVariant: ['tabular-nums'] },
  totalCompact: { fontSize: 52, lineHeight: 58 },
  unit: { marginLeft: 8, fontFamily: fonts.sansSemiBold, fontSize: 29, color: colors.navy },
  target: { fontFamily: fonts.mono, fontSize: 17, color: colors.slate },
  ringWrap: { width: 94, height: 94, alignItems: 'center', justifyContent: 'center' },
  percent: { position: 'absolute', fontFamily: fonts.sansSemiBold, fontSize: 22, color: colors.navy, fontVariant: ['tabular-nums'] },
});
