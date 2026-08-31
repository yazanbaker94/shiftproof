import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { Icon, type IconName } from '../components/Icon';

const icons: Record<string, IconName> = {
  Home: 'home',
  Timesheet: 'timesheet',
  History: 'history',
  Profile: 'profile',
};

export function BottomNavigation({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const label = descriptors[route.key]?.options.title ?? route.name;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={`${String(label)} tab`}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            style={styles.item}
          >
            <View style={[styles.activeRule, focused && styles.activeRuleVisible]} />
            <Icon name={icons[route.name] ?? 'home'} size={27} color={focused ? colors.navy : colors.slate} strokeWidth={focused ? 2.2 : 1.7} />
            <Text style={[styles.label, focused && styles.labelActive]}>{String(label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, backgroundColor: colors.paperLight },
  item: { flex: 1, minHeight: 72, alignItems: 'center', justifyContent: 'center', gap: 4 },
  activeRule: { position: 'absolute', top: 0, width: 42, height: 3, borderRadius: 2, backgroundColor: colors.transparent },
  activeRuleVisible: { backgroundColor: colors.navy },
  label: { fontFamily: fonts.sans, fontSize: 12, color: colors.slate },
  labelActive: { fontFamily: fonts.sansSemiBold, color: colors.navy },
});
