import * as Application from 'expo-application';

export const buildMetadata = {
  applicationId: Application.applicationId ?? 'video.swoop.shiftproof',
  version: Application.nativeApplicationVersion ?? '0.1.1',
  buildVersion: Application.nativeBuildVersion ?? 'development',
  buildId: process.env.EXPO_PUBLIC_BUILD_ID ?? 'local',
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'local-demo',
} as const;
