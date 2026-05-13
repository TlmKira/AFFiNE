export const DYNAMIC_BACKGROUND_STORAGE_KEY = 'affine:dynamic-background';
export const DYNAMIC_WALLPAPER_OPACITY_STORAGE_KEY =
  'affine:dynamic-wallpaper-opacity';
export const DYNAMIC_BACKGROUND_CHANGE_EVENT =
  'affine-dynamic-background-change';
export const DEFAULT_DYNAMIC_WALLPAPER_OPACITY = 75;

function normalizeWallpaperOpacity(value: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_DYNAMIC_WALLPAPER_OPACITY;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
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

  return normalizeWallpaperOpacity(Number(storedValue));
}

export function applyDynamicBackgroundPreference() {
  if (typeof document === 'undefined') return;

  const enabled = getDynamicBackgroundPreference();
  document.documentElement.dataset.dynamicBackground = enabled ? 'on' : 'off';
  document.documentElement.style.setProperty(
    '--affine-dynamic-wallpaper-opacity',
    `${getDynamicWallpaperOpacityPreference() / 100}`
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
    String(normalizeWallpaperOpacity(opacity))
  );
  applyDynamicBackgroundPreference();
  window.dispatchEvent(new CustomEvent(DYNAMIC_BACKGROUND_CHANGE_EVENT));
}
