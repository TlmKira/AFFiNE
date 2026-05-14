import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';

import {
  DYNAMIC_BACKGROUND_CHANGE_EVENT,
  getDynamicBackgroundPreference,
  getDynamicWallpaperOpacityPreference,
} from './dynamic-background';

const WALLPAPERS = [
  '/dynamic-background/wallpapers/wallpaper-lolita-01.jpg',
  '/dynamic-background/wallpapers/wallpaper-lolita-02.jpg',
  '/dynamic-background/wallpapers/wallpaper-lolita-03.jpg',
] as const;

const WALLPAPER_MANIFEST = '/dynamic-background/wallpapers/manifest.json';

type WallpaperManifestItem = {
  path?: unknown;
};

let selectedWallpaper: string | undefined;

function pickWallpaper(wallpapers: readonly string[] = WALLPAPERS) {
  selectedWallpaper =
    wallpapers[Math.floor(Math.random() * wallpapers.length)] ?? WALLPAPERS[0];

  return selectedWallpaper;
}

function isWallpaperPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/dynamic-background/wallpapers/') &&
    /\.(jpe?g|png|webp)$/i.test(value)
  );
}

function getWallpaperPath(item: unknown) {
  if (item && typeof item === 'object' && 'path' in item) {
    return (item as WallpaperManifestItem).path;
  }

  return undefined;
}

export function useDynamicWallpaperImage() {
  const [wallpaper, setWallpaper] = useState(pickWallpaper);

  useEffect(() => {
    let cancelled = false;

    fetch(WALLPAPER_MANIFEST)
      .then(response => (response.ok ? response.json() : []))
      .then((manifest: unknown) => {
        if (cancelled || !Array.isArray(manifest)) {
          return;
        }

        const wallpapers = manifest
          .map(getWallpaperPath)
          .filter(isWallpaperPath);

        if (wallpapers.length > 0) {
          setWallpaper(pickWallpaper(wallpapers));
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return wallpaper;
}

export function DynamicWallpaperBackground() {
  const [enabled, setEnabled] = useState(() =>
    getDynamicBackgroundPreference()
  );
  const [opacity, setOpacity] = useState(() =>
    getDynamicWallpaperOpacityPreference()
  );
  const wallpaper = useDynamicWallpaperImage();

  useEffect(() => {
    const update = () => {
      setEnabled(getDynamicBackgroundPreference());
      setOpacity(getDynamicWallpaperOpacityPreference());
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
          '--affine-dynamic-wallpaper-image': `url("${wallpaper}")`,
          '--affine-dynamic-wallpaper-opacity': `${opacity / 100}`,
        } as CSSProperties
      }
    />
  );
}
