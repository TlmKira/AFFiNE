import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';

import {
  DYNAMIC_BACKGROUND_CHANGE_EVENT,
  getDynamicBackgroundPreference,
  getDynamicWallpaperOpacityPreference,
} from './dynamic-background';

const WALLPAPERS = [
  '/dynamic-background/wallpapers/wallpaper-01.jpg',
  '/dynamic-background/wallpapers/wallpaper-02.jpg',
  '/dynamic-background/wallpapers/wallpaper-03.jpg',
  '/dynamic-background/wallpapers/wallpaper-04.png',
  '/dynamic-background/wallpapers/wallpaper-05.jpg',
  '/dynamic-background/wallpapers/wallpaper-06.png',
  '/dynamic-background/wallpapers/wallpaper-07.png',
  '/dynamic-background/wallpapers/wallpaper-08.jpg',
  '/dynamic-background/wallpapers/wallpaper-09.jpg',
  '/dynamic-background/wallpapers/wallpaper-10.png',
  '/dynamic-background/wallpapers/wallpaper-11.png',
  '/dynamic-background/wallpapers/wallpaper-12.jpg',
  '/dynamic-background/wallpapers/wallpaper-13.jpg',
] as const;

let selectedWallpaper: string | undefined;

function pickWallpaper() {
  selectedWallpaper ??=
    WALLPAPERS[Math.floor(Math.random() * WALLPAPERS.length)] ?? WALLPAPERS[0];

  return selectedWallpaper;
}

export function DynamicWallpaperBackground() {
  const [enabled, setEnabled] = useState(() =>
    getDynamicBackgroundPreference()
  );
  const [opacity, setOpacity] = useState(() =>
    getDynamicWallpaperOpacityPreference()
  );
  const [wallpaper] = useState(pickWallpaper);

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
