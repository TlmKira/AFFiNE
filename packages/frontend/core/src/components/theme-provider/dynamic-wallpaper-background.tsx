import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';

import {
  DYNAMIC_BACKGROUND_CHANGE_EVENT,
  getDynamicBackgroundPreference,
  getDynamicWallpaperBlur,
  getDynamicWallpaperClarityPreference,
  getDynamicWallpaperIdPreference,
  getDynamicWallpaperOpacityPreference,
  getDynamicWallpaperSharpnessFilter,
  setDynamicWallpaperIdPreference,
} from './dynamic-background';

export type DynamicWallpaper = {
  path: string;
  id?: string;
  file?: string;
  width?: number;
  height?: number;
};

const WALLPAPERS: DynamicWallpaper[] = [
  {
    id: 'wallpaper-lolita-01',
    file: 'wallpaper-lolita-01.jpg',
    path: '/dynamic-background/wallpapers/wallpaper-lolita-01.jpg',
  },
  {
    id: 'wallpaper-lolita-02',
    file: 'wallpaper-lolita-02.jpg',
    path: '/dynamic-background/wallpapers/wallpaper-lolita-02.jpg',
  },
  {
    id: 'wallpaper-lolita-03',
    file: 'wallpaper-lolita-03.jpg',
    path: '/dynamic-background/wallpapers/wallpaper-lolita-03.jpg',
  },
];

const WALLPAPER_MANIFEST = '/dynamic-background/wallpapers/manifest.json';

type WallpaperManifestItem = {
  id?: unknown;
  file?: unknown;
  path?: unknown;
  width?: unknown;
  height?: unknown;
};

let availableWallpapers = WALLPAPERS;
let selectedWallpaper = getPreferredWallpaper(WALLPAPERS);
let wallpaperManifestRequest: Promise<void> | undefined;
const wallpaperListeners = new Set<(state: DynamicWallpaperState) => void>();

type DynamicWallpaperState = {
  wallpaper: DynamicWallpaper;
  wallpapers: readonly DynamicWallpaper[];
};

function pickRandomWallpaper(
  wallpapers: readonly DynamicWallpaper[] = WALLPAPERS
) {
  return (
    wallpapers[Math.floor(Math.random() * wallpapers.length)] ?? WALLPAPERS[0]
  );
}

function findWallpaperById(id: string | undefined) {
  if (!id) return undefined;
  return availableWallpapers.find(wallpaper => wallpaper.id === id);
}

function getPreferredWallpaper(
  wallpapers: readonly DynamicWallpaper[],
  currentWallpaper?: DynamicWallpaper
) {
  const preferredId = getDynamicWallpaperIdPreference();
  return (
    wallpapers.find(wallpaper => wallpaper.id === preferredId) ??
    currentWallpaper ??
    pickRandomWallpaper(wallpapers)
  );
}

function notifyWallpaperListeners() {
  const state = {
    wallpaper: selectedWallpaper,
    wallpapers: availableWallpapers,
  };
  wallpaperListeners.forEach(listener => listener(state));
}

function setSelectedWallpaper(wallpaper: DynamicWallpaper) {
  selectedWallpaper = wallpaper;
  notifyWallpaperListeners();
}

function isWallpaperPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/dynamic-background/wallpapers/') &&
    /\.(jpe?g|png|webp)$/i.test(value)
  );
}

function getOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function getOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function getWallpaperFromManifestItem(item: unknown): DynamicWallpaper | null {
  if (!item || typeof item !== 'object' || !('path' in item)) {
    return null;
  }

  const manifestItem = item as WallpaperManifestItem;
  if (!isWallpaperPath(manifestItem.path)) {
    return null;
  }

  return {
    id: getOptionalString(manifestItem.id),
    file: getOptionalString(manifestItem.file),
    path: manifestItem.path,
    width: getOptionalNumber(manifestItem.width),
    height: getOptionalNumber(manifestItem.height),
  };
}

function ensureWallpaperManifestLoaded() {
  wallpaperManifestRequest ??= fetch(WALLPAPER_MANIFEST)
    .then(response => (response.ok ? response.json() : []))
    .then((manifest: unknown) => {
      if (!Array.isArray(manifest)) {
        return;
      }

      const wallpapers = manifest
        .map(getWallpaperFromManifestItem)
        .filter((wallpaper): wallpaper is DynamicWallpaper => !!wallpaper);

      if (wallpapers.length > 0) {
        availableWallpapers = wallpapers;
        setSelectedWallpaper(
          getPreferredWallpaper(wallpapers, selectedWallpaper)
        );
      }
    })
    .catch(() => {});

  return wallpaperManifestRequest;
}

export function useDynamicWallpaper() {
  const [state, setState] = useState<DynamicWallpaperState>(() => ({
    wallpaper: selectedWallpaper,
    wallpapers: availableWallpapers,
  }));

  useEffect(() => {
    const updateFromPreference = () => {
      const wallpaper = findWallpaperById(getDynamicWallpaperIdPreference());
      if (wallpaper && wallpaper.id !== selectedWallpaper.id) {
        setSelectedWallpaper(wallpaper);
      }
    };

    wallpaperListeners.add(setState);
    ensureWallpaperManifestLoaded();
    window.addEventListener(
      DYNAMIC_BACKGROUND_CHANGE_EVENT,
      updateFromPreference
    );
    window.addEventListener('storage', updateFromPreference);

    return () => {
      wallpaperListeners.delete(setState);
      window.removeEventListener(
        DYNAMIC_BACKGROUND_CHANGE_EVENT,
        updateFromPreference
      );
      window.removeEventListener('storage', updateFromPreference);
    };
  }, []);

  return {
    ...state,
    selectWallpaper: (id: string) => {
      const wallpaper = findWallpaperById(id);
      if (!wallpaper) return;

      setDynamicWallpaperIdPreference(id);
      setSelectedWallpaper(wallpaper);
    },
  };
}

export function useDynamicWallpaperImage() {
  return useDynamicWallpaper().wallpaper.path;
}

export function DynamicWallpaperBackground() {
  const [enabled, setEnabled] = useState(() =>
    getDynamicBackgroundPreference()
  );
  const [opacity, setOpacity] = useState(() =>
    getDynamicWallpaperOpacityPreference()
  );
  const [clarity, setClarity] = useState(() =>
    getDynamicWallpaperClarityPreference()
  );
  const { wallpaper } = useDynamicWallpaper();

  useEffect(() => {
    const update = () => {
      setEnabled(getDynamicBackgroundPreference());
      setOpacity(getDynamicWallpaperOpacityPreference());
      setClarity(getDynamicWallpaperClarityPreference());
    };

    window.addEventListener(DYNAMIC_BACKGROUND_CHANGE_EVENT, update);
    window.addEventListener('storage', update);

    return () => {
      window.removeEventListener(DYNAMIC_BACKGROUND_CHANGE_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="affine-dynamic-wallpaper-background"
      style={
        {
          '--affine-dynamic-wallpaper-image': `url("${wallpaper.path}")`,
          '--affine-dynamic-wallpaper-opacity': `${opacity / 100}`,
          '--affine-dynamic-wallpaper-blur': `${getDynamicWallpaperBlur(
            clarity
          )}px`,
          '--affine-dynamic-wallpaper-sharpness-filter':
            getDynamicWallpaperSharpnessFilter(clarity),
        } as CSSProperties
      }
    />
  );
}
