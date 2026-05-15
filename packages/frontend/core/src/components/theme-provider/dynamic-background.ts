export const DYNAMIC_BACKGROUND_STORAGE_KEY = 'affine:dynamic-background';
export const DYNAMIC_WALLPAPER_OPACITY_STORAGE_KEY =
  'affine:dynamic-wallpaper-opacity';
export const DYNAMIC_WALLPAPER_CLARITY_STORAGE_KEY =
  'affine:dynamic-wallpaper-clarity';
export const DYNAMIC_WALLPAPER_ID_STORAGE_KEY = 'affine:dynamic-wallpaper-id';
export const DYNAMIC_BACKGROUND_CHANGE_EVENT =
  'affine-dynamic-background-change';
export const DEFAULT_DYNAMIC_WALLPAPER_OPACITY = 75;
export const DEFAULT_DYNAMIC_WALLPAPER_CLARITY = 85;
export const MAX_DYNAMIC_WALLPAPER_CLARITY = 120;
const MAX_DYNAMIC_WALLPAPER_BLUR = 20;

export type DynamicWallpaperUserSettings = {
  dynamicWallpaperEnabled?: boolean;
  dynamicWallpaperOpacity?: number;
  dynamicWallpaperClarity?: number;
  dynamicWallpaperId?: string | null;
};

function normalizeWallpaperRange(value: number, fallback: number, max = 100) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(0, Math.round(value)));
}

export function getDynamicWallpaperBlur(clarity: number) {
  const normalizedClarity = normalizeWallpaperRange(
    clarity,
    DEFAULT_DYNAMIC_WALLPAPER_CLARITY,
    MAX_DYNAMIC_WALLPAPER_CLARITY
  );

  if (normalizedClarity >= 100) {
    return 0;
  }

  return Math.round(
    (MAX_DYNAMIC_WALLPAPER_BLUR * (100 - normalizedClarity)) / 100
  );
}

export function getDynamicWallpaperSharpnessFilter(clarity: number) {
  const normalizedClarity = normalizeWallpaperRange(
    clarity,
    DEFAULT_DYNAMIC_WALLPAPER_CLARITY,
    MAX_DYNAMIC_WALLPAPER_CLARITY
  );
  const extraClarity = Math.max(0, normalizedClarity - 100) / 20;
  const contrast = 1 + extraClarity * 0.1;
  const saturate = 1 + extraClarity * 0.14;

  return `contrast(${contrast.toFixed(2)}) saturate(${saturate.toFixed(2)})`;
}

export function getDynamicBackgroundPreference() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(DYNAMIC_BACKGROUND_STORAGE_KEY) === 'true';
}

export function getDynamicWallpaperOpacityPreference() {
  if (typeof window === 'undefined') return DEFAULT_DYNAMIC_WALLPAPER_OPACITY;

  const storedValue = window.localStorage.getItem(
    DYNAMIC_WALLPAPER_OPACITY_STORAGE_KEY
  );
  if (storedValue === null) {
    return DEFAULT_DYNAMIC_WALLPAPER_OPACITY;
  }

  return normalizeWallpaperRange(
    Number(storedValue),
    DEFAULT_DYNAMIC_WALLPAPER_OPACITY
  );
}

export function getDynamicWallpaperClarityPreference() {
  if (typeof window === 'undefined') return DEFAULT_DYNAMIC_WALLPAPER_CLARITY;

  const storedValue = window.localStorage.getItem(
    DYNAMIC_WALLPAPER_CLARITY_STORAGE_KEY
  );
  if (storedValue === null) {
    return DEFAULT_DYNAMIC_WALLPAPER_CLARITY;
  }

  return normalizeWallpaperRange(
    Number(storedValue),
    DEFAULT_DYNAMIC_WALLPAPER_CLARITY,
    MAX_DYNAMIC_WALLPAPER_CLARITY
  );
}

export function getDynamicWallpaperIdPreference() {
  if (typeof window === 'undefined') return undefined;

  return (
    window.localStorage.getItem(DYNAMIC_WALLPAPER_ID_STORAGE_KEY) ?? undefined
  );
}

export function getLocalDynamicWallpaperUserSettings() {
  return {
    dynamicWallpaperEnabled: getDynamicBackgroundPreference(),
    dynamicWallpaperOpacity: getDynamicWallpaperOpacityPreference(),
    dynamicWallpaperClarity: getDynamicWallpaperClarityPreference(),
    dynamicWallpaperId: getDynamicWallpaperIdPreference() ?? null,
  } satisfies Required<DynamicWallpaperUserSettings>;
}

export function hasLocalDynamicWallpaperPreference() {
  if (typeof window === 'undefined') return false;

  return [
    DYNAMIC_BACKGROUND_STORAGE_KEY,
    DYNAMIC_WALLPAPER_OPACITY_STORAGE_KEY,
    DYNAMIC_WALLPAPER_CLARITY_STORAGE_KEY,
    DYNAMIC_WALLPAPER_ID_STORAGE_KEY,
  ].some(key => window.localStorage.getItem(key) !== null);
}

export function applyDynamicBackgroundPreference() {
  if (typeof document === 'undefined') return;

  const enabled = getDynamicBackgroundPreference();
  document.documentElement.dataset.dynamicBackground = enabled ? 'on' : 'off';
  document.documentElement.style.setProperty(
    '--affine-dynamic-wallpaper-opacity',
    `${getDynamicWallpaperOpacityPreference() / 100}`
  );
  document.documentElement.style.setProperty(
    '--affine-dynamic-wallpaper-blur',
    `${getDynamicWallpaperBlur(getDynamicWallpaperClarityPreference())}px`
  );
  document.documentElement.style.setProperty(
    '--affine-dynamic-wallpaper-sharpness-filter',
    getDynamicWallpaperSharpnessFilter(getDynamicWallpaperClarityPreference())
  );
}

function dispatchDynamicBackgroundChange() {
  window.dispatchEvent(new CustomEvent(DYNAMIC_BACKGROUND_CHANGE_EVENT));
}

export function setDynamicBackgroundPreference(enabled: boolean) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    DYNAMIC_BACKGROUND_STORAGE_KEY,
    enabled ? 'true' : 'false'
  );
  applyDynamicBackgroundPreference();
  dispatchDynamicBackgroundChange();
}

export function setDynamicWallpaperOpacityPreference(opacity: number) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    DYNAMIC_WALLPAPER_OPACITY_STORAGE_KEY,
    String(normalizeWallpaperRange(opacity, DEFAULT_DYNAMIC_WALLPAPER_OPACITY))
  );
  applyDynamicBackgroundPreference();
  dispatchDynamicBackgroundChange();
}

export function setDynamicWallpaperClarityPreference(clarity: number) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    DYNAMIC_WALLPAPER_CLARITY_STORAGE_KEY,
    String(
      normalizeWallpaperRange(
        clarity,
        DEFAULT_DYNAMIC_WALLPAPER_CLARITY,
        MAX_DYNAMIC_WALLPAPER_CLARITY
      )
    )
  );
  applyDynamicBackgroundPreference();
  dispatchDynamicBackgroundChange();
}

export function setDynamicWallpaperIdPreference(id: string | null) {
  if (typeof window === 'undefined') return;

  if (id) {
    window.localStorage.setItem(DYNAMIC_WALLPAPER_ID_STORAGE_KEY, id);
  } else {
    window.localStorage.removeItem(DYNAMIC_WALLPAPER_ID_STORAGE_KEY);
  }
  dispatchDynamicBackgroundChange();
}

export function applyDynamicWallpaperUserSettings(
  settings: DynamicWallpaperUserSettings
) {
  if (typeof window === 'undefined') return;

  if (typeof settings.dynamicWallpaperEnabled === 'boolean') {
    window.localStorage.setItem(
      DYNAMIC_BACKGROUND_STORAGE_KEY,
      settings.dynamicWallpaperEnabled ? 'true' : 'false'
    );
  }

  if (typeof settings.dynamicWallpaperOpacity === 'number') {
    window.localStorage.setItem(
      DYNAMIC_WALLPAPER_OPACITY_STORAGE_KEY,
      String(
        normalizeWallpaperRange(
          settings.dynamicWallpaperOpacity,
          DEFAULT_DYNAMIC_WALLPAPER_OPACITY
        )
      )
    );
  }

  if (typeof settings.dynamicWallpaperClarity === 'number') {
    window.localStorage.setItem(
      DYNAMIC_WALLPAPER_CLARITY_STORAGE_KEY,
      String(
        normalizeWallpaperRange(
          settings.dynamicWallpaperClarity,
          DEFAULT_DYNAMIC_WALLPAPER_CLARITY,
          MAX_DYNAMIC_WALLPAPER_CLARITY
        )
      )
    );
  }

  if ('dynamicWallpaperId' in settings) {
    if (settings.dynamicWallpaperId) {
      window.localStorage.setItem(
        DYNAMIC_WALLPAPER_ID_STORAGE_KEY,
        settings.dynamicWallpaperId
      );
    } else {
      window.localStorage.removeItem(DYNAMIC_WALLPAPER_ID_STORAGE_KEY);
    }
  }

  applyDynamicBackgroundPreference();
  dispatchDynamicBackgroundChange();
}
