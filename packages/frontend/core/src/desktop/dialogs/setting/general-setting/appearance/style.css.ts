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

export const wallpaperPreviewControl = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '12px',
  width: '250px',
});

export const wallpaperPreviewImage = style({
  display: 'block',
  maxWidth: '96px',
  maxHeight: '54px',
  width: 'auto',
  height: 'auto',
  objectFit: 'contain',
  borderRadius: '6px',
  outline: '1px solid var(--affine-border-color)',
  background: 'var(--affine-background-secondary-color)',
});

export const wallpaperPreviewButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  borderRadius: '6px',
  selectors: {
    '&:focus-visible': {
      outline: '2px solid var(--affine-primary-color)',
      outlineOffset: '2px',
    },
  },
});

export const wallpaperPickerGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 88px)',
  gap: '8px',
  maxHeight: '320px',
  overflowY: 'auto',
  padding: '4px',
});

export const wallpaperPickerItem = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '88px',
  height: '58px',
  padding: '4px',
  border: '1px solid var(--affine-border-color)',
  borderRadius: '6px',
  background: 'var(--affine-background-secondary-color)',
  cursor: 'pointer',
  selectors: {
    '&[data-selected="true"]': {
      borderColor: 'var(--affine-primary-color)',
      outline: '2px solid var(--affine-primary-color)',
      outlineOffset: '-2px',
    },
    '&:hover': {
      borderColor: 'var(--affine-primary-color)',
    },
    '&:focus-visible': {
      outline: '2px solid var(--affine-primary-color)',
      outlineOffset: '2px',
    },
  },
});

export const wallpaperPickerImage = style({
  display: 'block',
  maxWidth: '100%',
  maxHeight: '100%',
  width: 'auto',
  height: 'auto',
  objectFit: 'contain',
  borderRadius: '4px',
});
