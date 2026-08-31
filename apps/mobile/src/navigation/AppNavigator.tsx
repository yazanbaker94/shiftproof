import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { AddHoursScreen } from '../screens/AddHoursScreen';
import { ApprovedReceiptScreen } from '../screens/ApprovedReceiptScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { NeedsAttentionScreen } from '../screens/NeedsAttentionScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SavedOfflineScreen } from '../screens/SavedOfflineScreen';
import { TimesheetScreen } from '../screens/TimesheetScreen';
import { BottomNavigation } from './BottomNavigation';
import type { MainTabParamList, RootStackParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme: Theme = {
  dark: false,
  colors: {
    primary: colors.navy,
    background: colors.paper,
    card: colors.paperLight,
    text: colors.navy,
    border: colors.divider,
    notification: colors.amber,
  },
  fonts: {
    regular: { fontFamily: 'SpaceGrotesk_400Regular', fontWeight: '400' },
    medium: { fontFamily: 'SpaceGrotesk_500Medium', fontWeight: '500' },
    bold: { fontFamily: 'SpaceGrotesk_700Bold', fontWeight: '700' },
    heavy: { fontFamily: 'SpaceGrotesk_700Bold', fontWeight: '700' },
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <BottomNavigation {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper } }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Timesheet" component={TimesheetScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName="Main"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.paper },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="AddHours" component={AddHoursScreen} />
        <Stack.Screen name="SavedOffline" component={SavedOfflineScreen} />
        <Stack.Screen name="Attention" component={NeedsAttentionScreen} />
        <Stack.Screen name="Receipt" component={ApprovedReceiptScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
