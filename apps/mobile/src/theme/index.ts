import { StyleSheet } from 'react-native';

export const colors = {
  paper: '#F8F5EE',
  paperLight: '#FCFAF6',
  paperRaised: '#FFFDFA',
  navy: '#0B2033',
  navySoft: '#24384A',
  slate: '#5F6D78',
  slateLight: '#8A949B',
  green: '#258447',
  greenDark: '#176A36',
  greenWash: '#EDF5EF',
  amber: '#EB8624',
  amberDark: '#C86513',
  amberWash: '#FFF4E8',
  blue: '#2566C1',
  divider: '#D8D5CD',
  dividerStrong: '#BEBAB1',
  white: '#FFFFFF',
  danger: '#B23A2A',
  black: '#0B1115',
  transparent: 'transparent',
} as const;

export const fonts = {
  sans: 'SpaceGrotesk_400Regular',
  sansMedium: 'SpaceGrotesk_500Medium',
  sansSemiBold: 'SpaceGrotesk_600SemiBold',
  sansBold: 'SpaceGrotesk_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  page: 22,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const sharedStyles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scrollContent: {
    paddingHorizontal: spacing.page,
    paddingBottom: 32,
  },
  eyebrow: {
    color: colors.navy,
    fontFamily: fonts.monoSemiBold,
    fontSize: 13,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.navy,
    fontFamily: fonts.sansBold,
    fontSize: 42,
    lineHeight: 48,
    letterSpacing: -1.5,
  },
  body: {
    color: colors.navySoft,
    fontFamily: fonts.sans,
    fontSize: 17,
    lineHeight: 25,
  },
  card: {
    borderColor: colors.divider,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    backgroundColor: colors.paperLight,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
  },
});
