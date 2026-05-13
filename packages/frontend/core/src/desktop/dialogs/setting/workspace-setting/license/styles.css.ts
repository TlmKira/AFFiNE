import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const paymentMethod = style({
  marginTop: '24px',
});

export const planCard = style({
  display: 'flex',
  flexDirection: 'column',
  padding: '12px',
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  backgroundColor: cssVarV2('layer/white'),
  borderRadius: '8px',
});

export const sectionCard = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  padding: '16px',
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  backgroundColor: cssVarV2('layer/white'),
  borderRadius: '8px',
  marginTop: '16px',
});

export const cardHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
});

export const cardTitle = style({
  margin: 0,
  fontSize: cssVar('fontBase'),
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const cardDescription = style({
  margin: 0,
  fontSize: cssVar('fontSm'),
  color: cssVarV2('text/secondary'),
});

export const statusGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
});

export const statusItem = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  minWidth: 0,
  padding: '10px',
  borderRadius: '8px',
  backgroundColor: cssVarV2('layer/background/secondary'),
});

export const statusLabel = style({
  fontSize: cssVar('fontXs'),
  color: cssVarV2('text/secondary'),
});

export const statusValue = style({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  minWidth: 0,
  fontSize: cssVar('fontSm'),
  color: cssVarV2('text/primary'),
});

export const statusText = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const statusDot = style({
  width: '8px',
  height: '8px',
  borderRadius: '999px',
  flex: '0 0 auto',
  selectors: {
    '&[data-status="ok"]': {
      backgroundColor: '#19a974',
    },
    '&[data-status="warning"]': {
      backgroundColor: '#f5a623',
    },
    '&[data-status="disabled"]': {
      backgroundColor: cssVarV2('text/disable'),
    },
    '&[data-status="error"]': {
      backgroundColor: cssVarV2('status/error'),
    },
    '&[data-status="loading"]': {
      backgroundColor: cssVarV2('text/secondary'),
    },
  },
});

export const container = style({
  display: 'flex',
  justifyContent: 'space-between',
});

export const currentPlan = style({
  flex: '1 0 0',
});

export const planPrice = style({
  fontSize: cssVar('fontH6'),
  fontWeight: 600,
  display: 'flex',
  gap: '4px',
  margin: '0px 4px',
  justifyContent: 'center',
  height: '100%',
  alignItems: 'center',
  selectors: {
    '&.hidden': {
      visibility: 'hidden',
    },
  },
});

export const buttonContainer = style({
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: '12px',
  selectors: {
    '&.left': {
      justifyContent: 'flex-start',
    },
  },
});
export const activeButton = style({
  marginTop: '8px',
});
export const uploadButton = style({
  marginTop: '8px',
  marginRight: '9px',
});

export const seat = style({
  fontSize: cssVar('fontXs'),
  fontWeight: 400,
});

export const activateModalContent = style({
  padding: '0',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  marginTop: '12px',
  marginBottom: '20px',
});

export const tips = style({
  color: cssVarV2('text/secondary'),
  fontSize: cssVar('fontSm'),
});

export const footer = style({
  marginTop: 'auto',
  marginBottom: '0',
  display: 'flex',
  alignItems: 'center',
  paddingTop: '20px',
  justifyContent: 'space-between',
});

export const rightActions = style({
  display: 'flex',
  gap: '20px',
});
