import { style } from '@vanilla-extract/css';

export const settingWrapper = style({
  flexGrow: 1,
  display: 'flex',
  justifyContent: 'flex-end',
  minWidth: '150px',
  maxWidth: '250px',
});

export const wallpaperSliderControl = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '12px',
  width: '250px',
});

export const wallpaperSliderValue = style({
  width: '42px',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
});
