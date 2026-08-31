import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  Timesheet: undefined;
  History: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  AddHours: { entryId?: string } | undefined;
  SavedOffline: { entryId: string };
  Attention: { entryId: string };
  Receipt: { entryId?: string } | undefined;
};
