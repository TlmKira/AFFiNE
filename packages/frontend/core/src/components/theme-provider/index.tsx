import { UserSettingsService } from '@affine/core/modules/cloud';
import { AppThemeService } from '@affine/core/modules/theme';
import {
  useLiveData,
  useService,
  useServiceOptional,
} from '@toeverything/infra';
import { ThemeProvider as NextThemeProvider, useTheme } from 'next-themes';
import type { PropsWithChildren } from 'react';
import { useEffect, useRef } from 'react';

import {
  applyDynamicWallpaperUserSettings,
  applyDynamicBackgroundPreference,
  DYNAMIC_BACKGROUND_CHANGE_EVENT,
  getLocalDynamicWallpaperUserSettings,
  hasLocalDynamicWallpaperPreference,
} from './dynamic-background';
import { DynamicWallpaperBackground } from './dynamic-wallpaper-background';

const themes = ['dark', 'light', 'research'];

function ThemeObserver() {
  const { resolvedTheme } = useTheme();
  const service = useService(AppThemeService);

  useEffect(() => {
    service.appTheme.theme$.next(resolvedTheme);
  }, [resolvedTheme, service.appTheme.theme$]);

  return null;
}

function DynamicBackgroundObserver() {
  const userSettingsService = useServiceOptional(UserSettingsService);
  const userSettings = useLiveData(
    userSettingsService ? userSettingsService.userSettings$ : null
  );
  const migrationAttemptedRef = useRef(false);

  useEffect(() => {
    applyDynamicBackgroundPreference();
    userSettingsService?.revalidate();

    const update = () => applyDynamicBackgroundPreference();
    window.addEventListener(DYNAMIC_BACKGROUND_CHANGE_EVENT, update);
    window.addEventListener('storage', update);

    return () => {
      window.removeEventListener(DYNAMIC_BACKGROUND_CHANGE_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, [userSettingsService]);

  useEffect(() => {
    if (!userSettings) return;

    const localSettings = getLocalDynamicWallpaperUserSettings();
    const cloudSettings = {
      dynamicWallpaperEnabled: userSettings.dynamicWallpaperEnabled,
      dynamicWallpaperOpacity: userSettings.dynamicWallpaperOpacity,
      dynamicWallpaperClarity: userSettings.dynamicWallpaperClarity,
      dynamicWallpaperId: userSettings.dynamicWallpaperId,
    };

    const shouldMigrateLocalSettings =
      !migrationAttemptedRef.current &&
      !userSettings.dynamicWallpaperId &&
      hasLocalDynamicWallpaperPreference() &&
      (localSettings.dynamicWallpaperEnabled !==
        userSettings.dynamicWallpaperEnabled ||
        localSettings.dynamicWallpaperOpacity !==
          userSettings.dynamicWallpaperOpacity ||
        localSettings.dynamicWallpaperClarity !==
          userSettings.dynamicWallpaperClarity ||
        localSettings.dynamicWallpaperId !== userSettings.dynamicWallpaperId);

    if (shouldMigrateLocalSettings) {
      migrationAttemptedRef.current = true;
      userSettingsService?.updateUserSettings(localSettings).catch(() => {});
      return;
    }

    applyDynamicWallpaperUserSettings(cloudSettings);
  }, [userSettings, userSettingsService]);

  return null;
}

export const ThemeProvider = ({ children }: PropsWithChildren) => {
  return (
    <NextThemeProvider themes={themes} enableSystem={true}>
      {children}
      <DynamicWallpaperBackground />
      <ThemeObserver />
      <DynamicBackgroundObserver />
    </NextThemeProvider>
  );
};
