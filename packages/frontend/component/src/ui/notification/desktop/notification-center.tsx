import { assignInlineVars } from '@vanilla-extract/dynamic';
import { useTheme } from 'next-themes';
import { type CSSProperties, useMemo } from 'react';
import { Toaster } from 'sonner';

import type { NotificationCenterProps } from '../types';
import { cardWrapper } from './styles.css';

const toastOptions = {
  style: {
    width: '100%',
  },
  className: cardWrapper,
};

export function DesktopNotificationCenter({
  width = 380,
}: NotificationCenterProps) {
  const theme = useTheme();
  const resolvedTheme = theme.resolvedTheme === 'dark' ? 'dark' : 'light';
  const style = useMemo(() => {
    return {
      ...assignInlineVars({
        // override css vars inside sonner
        '--width': `${width}px`,
      }),
      // radix-ui will lock pointer-events when dialog is open
      pointerEvents: 'auto',
    } satisfies CSSProperties;
  }, [width]);

  return (
    <Toaster
      className="affine-notification-center"
      style={style}
      toastOptions={toastOptions}
      theme={resolvedTheme}
    />
  );
}
