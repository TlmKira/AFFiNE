import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const stack = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
});

export const panel = style({
  display: 'flex',
  flexDirection: 'column',
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 8,
  overflow: 'hidden',
  background: cssVarV2('layer/background/primary'),
});

export const panelHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '12px 16px',
  borderBottom: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
});

export const title = style({
  fontSize: cssVar('fontSm'),
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const description = style({
  fontSize: cssVar('fontXs'),
  lineHeight: '20px',
  color: cssVarV2('text/secondary'),
});

export const badge = style({
  flexShrink: 0,
  padding: '2px 8px',
  borderRadius: '999px',
  fontSize: cssVar('fontXs'),
  lineHeight: '18px',
  color: cssVarV2('text/secondary'),
  background: cssVarV2('layer/background/secondary'),
});

export const configuredBadge = style([
  badge,
  {
    color: '#168a58',
    background: '#edf8f3',
  },
]);

export const providerRows = style({
  display: 'flex',
  flexDirection: 'column',
});

export const providerRow = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(180px, 1fr) minmax(280px, 1.25fr)',
  gap: 16,
  padding: '14px 16px',
  borderBottom: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  selectors: {
    '&:last-child': {
      borderBottom: 0,
    },
  },
  '@media': {
    '(max-width: 860px)': {
      gridTemplateColumns: '1fr',
      gap: 12,
    },
  },
});

export const providerMeta = style({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const providerTitleLine = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 8,
});

export const providerName = style({
  minWidth: 0,
  fontSize: cssVar('fontSm'),
  lineHeight: '22px',
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const form = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

export const field = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const label = style({
  fontSize: cssVar('fontXs'),
  color: cssVarV2('text/secondary'),
});

export const input = style({
  height: 40,
  width: '100%',
  boxSizing: 'border-box',
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 8,
  padding: '0 10px',
  background: cssVarV2('layer/background/primary'),
  color: cssVarV2('text/primary'),
  fontSize: cssVar('fontSm'),
  lineHeight: '24px',
  outline: 'none',
  selectors: {
    '&::placeholder': {
      color: cssVarV2('text/placeholder'),
    },
    '&:focus': {
      borderColor: cssVarV2('button/primary'),
      boxShadow: '0px 0px 0px 2px rgba(30, 150, 235, 0.30)',
    },
    '&:disabled': {
      cursor: 'not-allowed',
      color: cssVarV2('text/disable'),
      background: cssVarV2('layer/background/secondary'),
    },
  },
});

export const actions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  paddingTop: 2,
});

export const error = style({
  color: cssVar('errorColor'),
  fontSize: cssVar('fontXs'),
  lineHeight: '20px',
});

export const loading = style({
  color: cssVar('textSecondaryColor'),
  fontSize: cssVar('fontSm'),
  lineHeight: '22px',
});

export const previewNotice = style({
  marginBottom: '12px',
  padding: '10px 12px',
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 8,
  color: cssVarV2('text/secondary'),
  background: cssVarV2('layer/background/secondary'),
  fontSize: cssVar('fontSm'),
  lineHeight: '22px',
});
