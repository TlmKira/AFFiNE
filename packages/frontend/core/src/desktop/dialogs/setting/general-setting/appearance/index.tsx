import type { RadioItem } from '@affine/component';
import { Menu, notify, RadioGroup, Slider, Switch } from '@affine/component';
import {
  SettingHeader,
  SettingRow,
  SettingWrapper,
} from '@affine/component/setting-components';
import { LanguageMenu } from '@affine/core/components/affine/language-menu';
import {
  getAutoCloudSyncPreference,
  setAutoCloudSyncPreference,
} from '@affine/core/components/cloud/auto-cloud-sync';
import {
  applyDynamicWallpaperUserSettings,
  DYNAMIC_BACKGROUND_CHANGE_EVENT,
  getDynamicBackgroundPreference,
  getLocalDynamicWallpaperUserSettings,
  getDynamicWallpaperClarityPreference,
  getDynamicWallpaperOpacityPreference,
  hasLocalDynamicWallpaperPreference,
  MAX_DYNAMIC_WALLPAPER_CLARITY,
  setDynamicBackgroundPreference,
  setDynamicWallpaperClarityPreference,
  setDynamicWallpaperOpacityPreference,
  type DynamicWallpaperUserSettings,
} from '@affine/core/components/theme-provider/dynamic-background';
import { useDynamicWallpaper } from '@affine/core/components/theme-provider/dynamic-wallpaper-background';
import { UserSettingsService } from '@affine/core/modules/cloud';
import { SHOW_OPEN_IN_APP } from '@affine/core/modules/brand/constant';
import { TraySettingService } from '@affine/core/modules/editor-setting/services/tray-settings';
import { FeatureFlagService } from '@affine/core/modules/feature-flag';
import { UserFriendlyError } from '@affine/error';
import { useI18n } from '@affine/i18n';
import {
  useLiveData,
  useService,
  useServiceOptional,
} from '@toeverything/infra';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAppSettingHelper } from '../../../../../components/hooks/affine/use-app-setting-helper';
import { OpenInAppLinksMenu } from './links';
import {
  settingWrapper,
  wallpaperPreviewControl,
  wallpaperPreviewButton,
  wallpaperPreviewImage,
  wallpaperPickerGrid,
  wallpaperPickerImage,
  wallpaperPickerItem,
  wallpaperSliderControl,
  wallpaperSliderValue,
} from './style.css';
import { ThemeEditorSetting } from './theme-editor-setting';

export const getThemeOptions = (t: ReturnType<typeof useI18n>) =>
  [
    {
      value: 'system',
      label: t['com.affine.themeSettings.system'](),
      testId: 'system-theme-trigger',
    },
    {
      value: 'light',
      label: t['com.affine.themeSettings.light'](),
      testId: 'light-theme-trigger',
    },
    {
      value: 'dark',
      label: t['com.affine.themeSettings.dark'](),
      testId: 'dark-theme-trigger',
    },
    {
      value: 'research',
      label: t.t('com.affine.themeSettings.research'),
      testId: 'research-theme-trigger',
    },
  ] satisfies RadioItem[];

export const ThemeSettings = () => {
  const t = useI18n();
  const { setTheme, theme } = useTheme();

  const radioItems = useMemo<RadioItem[]>(() => getThemeOptions(t), [t]);

  return (
    <RadioGroup
      items={radioItems}
      value={theme}
      width={250}
      className={settingWrapper}
      onChange={useCallback(
        (value: string) => {
          setTheme(value);
        },
        [setTheme]
      )}
    />
  );
};

const MenubarSetting = () => {
  const t = useI18n();
  const traySettingService = useService(TraySettingService);
  const traySetting = useLiveData(traySettingService.settings$);

  return (
    <>
      <SettingWrapper
        id="menubar"
        title={t['com.affine.appearanceSettings.menubar.title']()}
      >
        <SettingRow
          name={t['com.affine.appearanceSettings.menubar.toggle']()}
          desc={t['com.affine.appearanceSettings.menubar.description']()}
        >
          <Switch
            checked={traySetting.enabled}
            onChange={checked => traySettingService.setEnabled(checked)}
          />
        </SettingRow>
      </SettingWrapper>
      {traySetting.enabled && !environment.isMacOs ? (
        <SettingWrapper
          id="windowBehavior"
          title={t[
            'com.affine.appearanceSettings.menubar.windowBehavior.title'
          ]()}
        >
          <SettingRow
            name={t[
              'com.affine.appearanceSettings.menubar.windowBehavior.openOnLeftClick.toggle'
            ]()}
            desc={t[
              'com.affine.appearanceSettings.menubar.windowBehavior.openOnLeftClick.description'
            ]()}
          >
            <Switch
              checked={traySetting.openOnLeftClick}
              onChange={checked =>
                traySettingService.setOpenOnLeftClick(checked)
              }
            />
          </SettingRow>
          <SettingRow
            name={t[
              'com.affine.appearanceSettings.menubar.windowBehavior.minimizeToTray.toggle'
            ]()}
            desc={t[
              'com.affine.appearanceSettings.menubar.windowBehavior.minimizeToTray.description'
            ]()}
          >
            <Switch
              checked={traySetting.minimizeToTray}
              onChange={checked =>
                traySettingService.setMinimizeToTray(checked)
              }
            />
          </SettingRow>
          <SettingRow
            name={t[
              'com.affine.appearanceSettings.menubar.windowBehavior.closeToTray.toggle'
            ]()}
            desc={t[
              'com.affine.appearanceSettings.menubar.windowBehavior.closeToTray.description'
            ]()}
          >
            <Switch
              checked={traySetting.closeToTray}
              onChange={checked => traySettingService.setCloseToTray(checked)}
            />
          </SettingRow>
          <SettingRow
            name={t[
              'com.affine.appearanceSettings.menubar.windowBehavior.startMinimized.toggle'
            ]()}
            desc={t[
              'com.affine.appearanceSettings.menubar.windowBehavior.startMinimized.description'
            ]()}
          >
            <Switch
              checked={traySetting.startMinimized}
              onChange={checked =>
                traySettingService.setStartMinimized(checked)
              }
            />
          </SettingRow>
        </SettingWrapper>
      ) : null}
    </>
  );
};

export const AppearanceSettings = () => {
  const t = useI18n();

  const featureFlagService = useService(FeatureFlagService);
  const userSettingsService = useServiceOptional(UserSettingsService);
  const userSettings = useLiveData(
    userSettingsService ? userSettingsService.userSettings$ : null
  );
  const migrationAttemptedRef = useRef(false);
  const enableThemeEditor = useLiveData(
    featureFlagService.flags.enable_theme_editor.$
  );
  const { appSettings, updateSettings } = useAppSettingHelper();
  const [dynamicBackground, setDynamicBackground] = useState(() =>
    getDynamicBackgroundPreference()
  );
  const [wallpaperOpacity, setWallpaperOpacity] = useState(() =>
    getDynamicWallpaperOpacityPreference()
  );
  const [wallpaperClarity, setWallpaperClarity] = useState(() =>
    getDynamicWallpaperClarityPreference()
  );
  const [wallpaperPickerOpen, setWallpaperPickerOpen] = useState(false);
  const { selectWallpaper, wallpaper, wallpapers } = useDynamicWallpaper();
  const [autoCloudSync, setAutoCloudSync] = useState(() =>
    getAutoCloudSyncPreference()
  );

  const syncDynamicWallpaperSettings = useCallback(
    (settings: DynamicWallpaperUserSettings) => {
      if (!userSettingsService) return;

      userSettingsService.updateUserSettings(settings).catch(err => {
        const userFriendlyError = UserFriendlyError.fromAny(err);
        notify.error({
          title: t[`error.${userFriendlyError.name}`](userFriendlyError.data),
        });
      });
    },
    [t, userSettingsService]
  );

  useEffect(() => {
    userSettingsService?.revalidate();
  }, [userSettingsService]);

  useEffect(() => {
    if (!userSettings || !userSettingsService) return;

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
      userSettingsService.updateUserSettings(localSettings).catch(() => {});
      return;
    }

    applyDynamicWallpaperUserSettings(cloudSettings);
  }, [userSettings, userSettingsService]);

  useEffect(() => {
    const update = () => {
      setDynamicBackground(getDynamicBackgroundPreference());
      setWallpaperOpacity(getDynamicWallpaperOpacityPreference());
      setWallpaperClarity(getDynamicWallpaperClarityPreference());
    };

    window.addEventListener(DYNAMIC_BACKGROUND_CHANGE_EVENT, update);
    window.addEventListener('storage', update);

    return () => {
      window.removeEventListener(DYNAMIC_BACKGROUND_CHANGE_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);

  return (
    <>
      <SettingHeader
        title={t['com.affine.appearanceSettings.title']()}
        subtitle={t['com.affine.appearanceSettings.subtitle']()}
      />

      <SettingWrapper title={t['com.affine.appearanceSettings.theme.title']()}>
        <SettingRow
          name={t['com.affine.appearanceSettings.color.title']()}
          desc={t['com.affine.appearanceSettings.color.description']()}
        >
          <ThemeSettings />
        </SettingRow>
        <SettingRow
          name={t['com.affine.appearanceSettings.language.title']()}
          desc={t['com.affine.appearanceSettings.language.description']()}
        >
          <div className={settingWrapper}>
            <LanguageMenu />
          </div>
        </SettingRow>
        {BUILD_CONFIG.isElectron ? (
          <SettingRow
            name={t['com.affine.appearanceSettings.clientBorder.title']()}
            desc={t['com.affine.appearanceSettings.clientBorder.description']()}
            data-testid="client-border-style-trigger"
          >
            <Switch
              checked={appSettings.clientBorder}
              onChange={checked => updateSettings('clientBorder', checked)}
            />
          </SettingRow>
        ) : null}
        {enableThemeEditor ? <ThemeEditorSetting /> : null}
        <SettingRow
          name={t.t('com.affine.appearanceSettings.dynamicBackground.title')}
          desc={t.t(
            'com.affine.appearanceSettings.dynamicBackground.description'
          )}
        >
          <div className={wallpaperPreviewControl}>
            <Menu
              contentOptions={{ align: 'end' }}
              rootOptions={{
                open: wallpaperPickerOpen,
                onOpenChange: setWallpaperPickerOpen,
              }}
              items={
                <div
                  className={wallpaperPickerGrid}
                  data-testid="dynamic-wallpaper-picker"
                >
                  {wallpapers.map(item => (
                    <button
                      className={wallpaperPickerItem}
                      data-selected={item.id === wallpaper.id}
                      data-testid={`dynamic-wallpaper-option-${item.id}`}
                      key={item.path}
                      onClick={() => {
                        if (!item.id) return;

                        selectWallpaper(item.id);
                        setWallpaperPickerOpen(false);
                        syncDynamicWallpaperSettings({
                          dynamicWallpaperId: item.id,
                        });
                      }}
                      title={item.file ?? item.id}
                      type="button"
                    >
                      <img
                        alt=""
                        className={wallpaperPickerImage}
                        src={item.path}
                      />
                    </button>
                  ))}
                </div>
              }
            >
              <button
                className={wallpaperPreviewButton}
                data-testid="dynamic-wallpaper-preview-trigger"
                title={wallpaper.file ?? wallpaper.id}
                type="button"
              >
                <img
                  alt=""
                  className={wallpaperPreviewImage}
                  data-testid="dynamic-wallpaper-preview"
                  src={wallpaper.path}
                />
              </button>
            </Menu>
            <Switch
              checked={dynamicBackground}
              onChange={checked => {
                setDynamicBackground(checked);
                setDynamicBackgroundPreference(checked);
                syncDynamicWallpaperSettings({
                  dynamicWallpaperEnabled: checked,
                });
              }}
            />
          </div>
        </SettingRow>
        <SettingRow
          name={t.t(
            'com.affine.appearanceSettings.dynamicBackground.opacity.title'
          )}
          desc={t.t(
            'com.affine.appearanceSettings.dynamicBackground.opacity.description'
          )}
          disabled={!dynamicBackground}
        >
          <div className={wallpaperSliderControl}>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[wallpaperOpacity]}
              width={196}
              disabled={!dynamicBackground}
              onValueChange={value => {
                const nextOpacity = value[0] ?? wallpaperOpacity;
                setWallpaperOpacity(nextOpacity);
                setDynamicWallpaperOpacityPreference(nextOpacity);
              }}
              onValueCommit={value => {
                const nextOpacity = value[0] ?? wallpaperOpacity;
                syncDynamicWallpaperSettings({
                  dynamicWallpaperOpacity: nextOpacity,
                });
              }}
            />
            <span className={wallpaperSliderValue}>{wallpaperOpacity}%</span>
          </div>
        </SettingRow>
        <SettingRow
          name={t.t(
            'com.affine.appearanceSettings.dynamicBackground.clarity.title'
          )}
          desc={t.t(
            'com.affine.appearanceSettings.dynamicBackground.clarity.description'
          )}
          disabled={!dynamicBackground}
        >
          <div className={wallpaperSliderControl}>
            <Slider
              min={0}
              max={MAX_DYNAMIC_WALLPAPER_CLARITY}
              step={5}
              value={[wallpaperClarity]}
              width={196}
              disabled={!dynamicBackground}
              onValueChange={value => {
                const nextClarity = value[0] ?? wallpaperClarity;
                setWallpaperClarity(nextClarity);
                setDynamicWallpaperClarityPreference(nextClarity);
              }}
              onValueCommit={value => {
                const nextClarity = value[0] ?? wallpaperClarity;
                syncDynamicWallpaperSettings({
                  dynamicWallpaperClarity: nextClarity,
                });
              }}
            />
            <span className={wallpaperSliderValue}>{wallpaperClarity}%</span>
          </div>
        </SettingRow>
        <SettingRow
          name={t.t('com.affine.appearanceSettings.autoCloudSync.title')}
          desc={t.t('com.affine.appearanceSettings.autoCloudSync.description')}
        >
          <Switch
            checked={autoCloudSync}
            onChange={checked => {
              setAutoCloudSync(checked);
              setAutoCloudSyncPreference(checked);
            }}
          />
        </SettingRow>
      </SettingWrapper>

      <SettingWrapper title={t['com.affine.appearanceSettings.images.title']()}>
        <SettingRow
          name={t['com.affine.appearanceSettings.images.antialiasing.title']()}
          desc={t[
            'com.affine.appearanceSettings.images.antialiasing.description'
          ]()}
          data-testid="image-antialiasing-trigger"
        >
          <Switch
            checked={!appSettings.disableImageAntialiasing}
            onChange={checked =>
              updateSettings('disableImageAntialiasing', !checked)
            }
          />
        </SettingRow>
      </SettingWrapper>

      {BUILD_CONFIG.isWeb && !environment.isMobile && SHOW_OPEN_IN_APP ? (
        <SettingWrapper title={t['com.affine.setting.appearance.links']()}>
          <SettingRow
            name={t['com.affine.setting.appearance.open-in-app']()}
            desc={t['com.affine.setting.appearance.open-in-app.hint']()}
            data-testid="open-in-app-links-trigger"
          >
            <OpenInAppLinksMenu />
          </SettingRow>
        </SettingWrapper>
      ) : null}

      <SettingWrapper
        title={t['com.affine.appearanceSettings.sidebar.title']()}
      >
        {BUILD_CONFIG.isElectron ? (
          <SettingRow
            name={t['com.affine.appearanceSettings.noisyBackground.title']()}
            desc={t[
              'com.affine.appearanceSettings.noisyBackground.description'
            ]()}
          >
            <Switch
              checked={appSettings.enableNoisyBackground}
              onChange={checked =>
                updateSettings('enableNoisyBackground', checked)
              }
            />
          </SettingRow>
        ) : null}
        {BUILD_CONFIG.isElectron && environment.isMacOs && (
          <SettingRow
            name={t['com.affine.appearanceSettings.translucentUI.title']()}
            desc={t[
              'com.affine.appearanceSettings.translucentUI.description'
            ]()}
          >
            <Switch
              checked={appSettings.enableBlurBackground}
              onChange={checked =>
                updateSettings('enableBlurBackground', checked)
              }
            />
          </SettingRow>
        )}
        <SettingRow
          name={t[
            'com.affine.appearanceSettings.showLinkedDocInSidebar.title'
          ]()}
          desc={t[
            'com.affine.appearanceSettings.showLinkedDocInSidebar.description'
          ]()}
        >
          <Switch
            checked={!!appSettings.showLinkedDocInSidebar}
            onChange={checked =>
              updateSettings('showLinkedDocInSidebar', checked)
            }
          />
        </SettingRow>
      </SettingWrapper>

      {BUILD_CONFIG.isElectron ? <MenubarSetting /> : null}
    </>
  );
};
