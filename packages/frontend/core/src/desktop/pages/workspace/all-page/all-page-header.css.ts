import { cssVarV2 } from '@toeverything/theme/v2';
import { globalStyle, style } from '@vanilla-extract/css';

export const header = style({
  width: '100%',
  height: '100%',
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  overflow: 'hidden',
});

globalStyle(`${header} > *:first-child`, {
  minWidth: 0,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
});

export const actions = style({
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  gap: 8,
});

export const viewToggle = style({
  backgroundColor: 'transparent',
});
export const viewToggleItem = style({
  padding: 0,
  fontSize: 16,
  width: 24,
  color: cssVarV2.icon.primary,
  selectors: {
    '&[data-state=checked]': {
      color: cssVarV2.icon.primary,
    },
  },
});

export const newPageButtonLabel = style({
  fontSize: '12px',
  color: cssVarV2.text.primary,
  fontWeight: 500,
});
