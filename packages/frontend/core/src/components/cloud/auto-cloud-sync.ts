export const AUTO_CLOUD_SYNC_STORAGE_KEY = 'affine:auto-cloud-sync';
export const AUTO_CLOUD_SYNC_CHANGE_EVENT = 'affine-auto-cloud-sync-change';

export function getAutoCloudSyncPreference() {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(AUTO_CLOUD_SYNC_STORAGE_KEY) !== 'false';
}

export function setAutoCloudSyncPreference(enabled: boolean) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    AUTO_CLOUD_SYNC_STORAGE_KEY,
    enabled ? 'true' : 'false'
  );
  window.dispatchEvent(new CustomEvent(AUTO_CLOUD_SYNC_CHANGE_EVENT));
}
