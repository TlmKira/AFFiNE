export const DYNAMIC_BACKGROUND_STORAGE_KEY = 'affine:dynamic-background';
export const DYNAMIC_WALLPAPER_OPACITY_STORAGE_KEY =
  'affine:dynamic-wallpaper-opacity';
export const DYNAMIC_WALLPAPER_CLARITY_STORAGE_KEY =
  'affine:dynamic-wallpaper-clarity';
export const DYNAMIC_BACKGROUND_CHANGE_EVENT =
  'affine-dynamic-background-change';
export const DEFAULT_DYNAMIC_WALLPAPER_OPACITY = 75;
export const DEFAULT_DYNAMIC_WALLPAPER_CLARITY = 70;
const MAX_DYNAMIC_WALLPAPER_BLUR = 24;

function normalizeWallpaperPercentage(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

export function getDynamicWallpaperBlur(clarity: number) {
  const normalizedClarity = normalizeWallpaperPercentage(
    clarity,
    DEFAULT_DYNAMIC_WALLPAPER_CLARITY
  );

  return Math.round(
    (MAX_DYNAMIC_WALLPAPER_BLUR * (100 - normalizedClarity)) / 100
  );
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

  return normalizeWallpaperPercentage(
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

  return normalizeWallpaperPercentage(
    Number(storedValue),
    DEFAULT_DYNAMIC_WALLPAPER_CLARITY
  );
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
}

export function setDynamicBackgroundPreference(enabled: boolean) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    DYNAMIC_BACKGROUND_STORAGE_KEY,
    enabled ? 'true' : 'false'
  );
  applyDynamicBackgroundPreference();
  window.dispatchEvent(new CustomEvent(DYNAMIC_BACKGROUND_CHANGE_EVENT));
}

export function setDynamicWallpaperOpacityPreference(opacity: number) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    DYNAMIC_WALLPAPER_OPACITY_STORAGE_KEY,
    String(
      normalizeWallpaperPercentage(opacity, DEFAULT_DYNAMIC_WALLPAPER_OPACITY)
    )
  );
  applyDynamicBackgroundPreference();
  window.dispatchEvent(new CustomEvent(DYNAMIC_BACKGROUND_CHANGE_EVENT));
}

export function setDynamicWallpaperClarityPreference(clarity: number) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    DYNAMIC_WALLPAPER_CLARITY_STORAGE_KEY,
    String(
      normalizeWallpaperPercentage(clarity, DEFAULT_DYNAMIC_WALLPAPER_CLARITY)
    )
  );
  applyDynamicBackgroundPreference();
  window.dispatchEvent(new CustomEvent(DYNAMIC_BACKGROUND_CHANGE_EVENT));
}
