export const DYNAMIC_BACKGROUND_STORAGE_KEY = 'affine:dynamic-background';
export const DYNAMIC_BACKGROUND_CHANGE_EVENT =
  'affine-dynamic-background-change';

export function getDynamicBackgroundPreference() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(DYNAMIC_BACKGROUND_STORAGE_KEY) === 'true';
}

export function applyDynamicBackgroundPreference() {
  if (typeof document === 'undefined') return;

  const enabled = getDynamicBackgroundPreference();
  document.documentElement.dataset.dynamicBackground = enabled ? 'on' : 'off';
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
