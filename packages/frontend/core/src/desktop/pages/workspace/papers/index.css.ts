import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { style } from '@vanilla-extract/css';

export const header = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  gap: 12,
  padding: '0 12px',
});

export const headerTitle = style({
  fontSize: cssVar('fontSm'),
  color: cssVarV2('text/secondary'),
});

export const headerStats = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: cssVar('fontXs'),
  color: cssVarV2('text/tertiary'),
});

export const body = style({
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'auto',
  borderTop: `0.5px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/primary'),
});

export const pageDropOverlay = style({
  position: 'absolute',
  inset: 0,
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'rgba(255, 255, 255, 0.72)',
  backdropFilter: 'blur(3px)',
  pointerEvents: 'none',
});

export const pageDropCard = style({
  width: 'min(460px, 100%)',
  borderRadius: 8,
  border: `1px dashed ${cssVarV2('button/primary')}`,
  padding: '22px 24px',
  textAlign: 'center',
  background: cssVarV2('layer/background/primary'),
  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.10)',
});

export const pageDropTitle = style({
  fontSize: cssVar('fontBase'),
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const pageDropHint = style({
  marginTop: 6,
  fontSize: cssVar('fontXs'),
  lineHeight: '18px',
  color: cssVarV2('text/secondary'),
});

export const content = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 1180,
  minWidth: 0,
  margin: '0 auto',
  padding: '18px 24px 32px',
  '@media': {
    '(max-width: 760px)': {
      padding: '14px 14px 28px',
    },
  },
});

export const shelfContent = style({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: '100%',
  padding: '18px 24px 32px',
  '@media': {
    '(max-width: 760px)': {
      padding: '14px 14px 28px',
    },
  },
});

export const shelfQuickActions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginBottom: 12,
  '@media': {
    '(max-width: 520px)': {
      justifyContent: 'flex-start',
      flexWrap: 'wrap',
    },
  },
});

export const importQueue = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginBottom: 12,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 8,
  padding: 10,
  background: cssVarV2('layer/background/secondary'),
});

export const importQueueTitle = style({
  fontSize: cssVar('fontXs'),
  fontWeight: 600,
  color: cssVarV2('text/secondary'),
});

export const importQueueItem = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 10,
  alignItems: 'start',
  borderRadius: 8,
  padding: 10,
  background: cssVarV2('layer/background/primary'),
  '@media': {
    '(max-width: 620px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const importQueueMain = style({
  minWidth: 0,
});

export const importQueueLabel = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: cssVar('fontSm'),
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const importQueueMessage = style({
  marginTop: 3,
  fontSize: cssVar('fontXs'),
  lineHeight: '18px',
  color: cssVarV2('text/secondary'),
});

export const importQueueStatus = style({
  display: 'inline-flex',
  alignItems: 'center',
  width: 'fit-content',
  borderRadius: 999,
  padding: '2px 8px',
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2('text/secondary'),
  background: cssVarV2('layer/background/secondary'),
  selectors: {
    '&[data-status="done"]': {
      color: '#147a3d',
      background: '#e8f7ee',
    },
    '&[data-status="failed"]': {
      color: '#9a3412',
      background: '#fff0e8',
    },
    '&[data-status="multiple"]': {
      color: cssVarV2('button/primary'),
    },
  },
});

export const importCandidates = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginTop: 8,
});

export const importCandidate = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  width: '100%',
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 8,
  padding: '7px 9px',
  textAlign: 'left',
  fontSize: cssVar('fontXs'),
  color: cssVarV2('text/primary'),
  background: cssVarV2('layer/background/primary'),
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      borderColor: cssVarV2('button/primary'),
      color: cssVarV2('button/primary'),
    },
  },
});

export const importCandidatePrimary = style([
  importCandidate,
  {
    fontWeight: 600,
    color: cssVarV2('button/primary'),
    background: cssVarV2('layer/background/secondary'),
  },
]);

export const shelfPanel = style({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: '100%',
  background: cssVarV2('layer/background/primary'),
});

export const topGrid = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.15fr) minmax(280px, 0.85fr)',
  gap: 16,
  alignItems: 'stretch',
  '@media': {
    '(max-width: 980px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const panel = style({
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 8,
  background: cssVarV2('layer/background/primary'),
  overflow: 'hidden',
});

export const panelHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minHeight: 48,
  padding: '12px 14px',
  borderBottom: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
});

export const panelTitle = style({
  fontSize: cssVar('fontSm'),
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const panelDescription = style({
  marginTop: 2,
  fontSize: cssVar('fontXs'),
  lineHeight: '18px',
  color: cssVarV2('text/secondary'),
});

export const panelBody = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 14,
});

export const settingsStack = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});

export const settingsSummary = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  fontSize: cssVar('fontSm'),
  lineHeight: '22px',
  color: cssVarV2('text/secondary'),
  '@media': {
    '(max-width: 620px)': {
      alignItems: 'stretch',
      flexDirection: 'column',
    },
  },
});

export const formRow = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 10,
  alignItems: 'end',
  '@media': {
    '(max-width: 620px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const formActionButton = style({
  '@media': {
    '(max-width: 620px)': {
      justifySelf: 'start',
      minWidth: 132,
    },
  },
});

export const field = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 0,
});

export const label = style({
  fontSize: cssVar('fontXs'),
  color: cssVarV2('text/secondary'),
});

export const input = style({
  width: '100%',
  height: 36,
  boxSizing: 'border-box',
  borderRadius: 8,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  padding: '0 10px',
  fontSize: cssVar('fontSm'),
  color: cssVarV2('text/primary'),
  background: cssVarV2('layer/background/primary'),
  outline: 'none',
  selectors: {
    '&::placeholder': {
      color: cssVarV2('text/placeholder'),
    },
    '&:focus': {
      borderColor: cssVarV2('button/primary'),
      boxShadow: '0px 0px 0px 2px rgba(30, 150, 235, 0.24)',
    },
  },
});

export const textarea = style([
  input,
  {
    height: 88,
    padding: '8px 10px',
    lineHeight: '20px',
    resize: 'vertical',
  },
]);

export const dropZone = style({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 6,
  minHeight: 112,
  borderRadius: 8,
  border: `1px dashed ${cssVarV2('layer/insideBorder/border')}`,
  padding: 14,
  color: cssVarV2('text/secondary'),
  background: cssVarV2('layer/background/secondary'),
  transition: 'border-color 0.16s ease, background 0.16s ease',
  selectors: {
    '&[data-dragging="true"]': {
      borderColor: cssVarV2('button/primary'),
      background: cssVarV2('layer/background/primary'),
    },
  },
});

export const dropTitle = style({
  fontSize: cssVar('fontSm'),
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const dropHint = style({
  fontSize: cssVar('fontXs'),
  lineHeight: '18px',
});

export const toolbar = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
});

export const filters = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
});

export const shelfGroups = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  padding: '0 14px 14px',
});

export const shelfGroup = style({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  borderTop: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
});

export const shelfGroupHeader = style({
  display: 'grid',
  gridTemplateColumns: '18px minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 8,
  minHeight: 44,
  width: '100%',
  border: 0,
  padding: '10px 0',
  textAlign: 'left',
  background: 'transparent',
  cursor: 'pointer',
  '@media': {
    '(max-width: 620px)': {
      gridTemplateColumns: '18px minmax(0, 1fr)',
    },
  },
});

export const shelfGroupChevron = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  color: cssVarV2('text/tertiary'),
  transition: 'transform 0.16s ease',
  selectors: {
    [`${shelfGroupHeader}[data-collapsed="true"] &`]: {
      transform: 'rotate(-90deg)',
    },
  },
});

export const shelfGroupTitle = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: cssVar('fontSm'),
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const shelfGroupMeta = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: cssVar('fontXs'),
  color: cssVarV2('text/secondary'),
  '@media': {
    '(max-width: 620px)': {
      gridColumn: '2',
      whiteSpace: 'normal',
    },
  },
});

export const paperGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: 14,
  paddingBottom: 6,
  '@media': {
    '(max-width: 520px)': {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: 10,
    },
    '(max-width: 360px)': {
      gridTemplateColumns: '1fr',
    },
  },
});

export const paperCard = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minWidth: 0,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  borderRadius: 8,
  padding: 10,
  background: cssVarV2('layer/background/primary'),
  transition: 'border-color 0.16s ease, box-shadow 0.16s ease',
  selectors: {
    '&:hover': {
      borderColor: cssVarV2('button/primary'),
      boxShadow: '0 6px 18px rgba(0, 0, 0, 0.06)',
    },
  },
});

export const coverButton = style({
  width: '100%',
  border: 0,
  padding: 0,
  background: 'transparent',
  cursor: 'pointer',
});

export const coverFrame = style({
  position: 'relative',
  width: '100%',
  aspectRatio: '3 / 4',
  overflow: 'hidden',
  borderRadius: 6,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/secondary'),
});

export const coverCanvas = style({
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  background: cssVarV2('layer/background/primary'),
});

export const coverPlaceholder = style({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: 10,
  padding: 14,
  color: cssVarV2('text/primary'),
  background:
    'linear-gradient(160deg, rgba(250,250,250,0.96), rgba(238,243,247,0.96))',
});

export const coverSource = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 11,
  color: cssVarV2('text/secondary'),
});

export const coverTitle = style({
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 5,
  fontSize: 17,
  lineHeight: '22px',
  fontWeight: 650,
  color: cssVarV2('text/primary'),
});

export const coverMeta = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 11,
  color: cssVarV2('text/secondary'),
});

export const cardTitle = style({
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  minHeight: 38,
  border: 0,
  padding: 0,
  textAlign: 'left',
  background: 'transparent',
  color: cssVarV2('text/primary'),
  fontSize: cssVar('fontSm'),
  lineHeight: '19px',
  fontWeight: 600,
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      color: cssVarV2('button/primary'),
    },
  },
});

export const cardMeta = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: cssVar('fontXs'),
  lineHeight: '18px',
  color: cssVarV2('text/secondary'),
});

export const cardBadges = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  minHeight: 20,
});

export const tagBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: '100%',
  borderRadius: 6,
  padding: '2px 7px',
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2('text/secondary'),
  background: cssVarV2('layer/background/secondary'),
});

export const tagEditor = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});

export const cardActions = style({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
});

export const select = style([
  input,
  {
    width: 'auto',
    minWidth: 116,
    paddingRight: 28,
  },
]);

export const search = style([
  input,
  {
    width: 260,
    '@media': {
      '(max-width: 620px)': {
        width: '100%',
      },
    },
  },
]);

export const table = style({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
});

export const tableHead = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(240px, 1.5fr) 120px 124px 120px',
  gap: 12,
  padding: '10px 14px',
  borderBottom: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  fontSize: cssVar('fontXs'),
  color: cssVarV2('text/tertiary'),
  '@media': {
    '(max-width: 860px)': {
      display: 'none',
    },
  },
});

export const paperRow = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(240px, 1.5fr) 120px 124px 120px',
  gap: 12,
  alignItems: 'center',
  padding: '12px 14px',
  borderBottom: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  selectors: {
    '&:last-child': {
      borderBottom: 0,
    },
  },
  '@media': {
    '(max-width: 860px)': {
      gridTemplateColumns: '1fr',
      gap: 8,
      alignItems: 'stretch',
    },
  },
});

export const paperMain = style({
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
});

export const paperTitle = style({
  width: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  border: 0,
  padding: 0,
  textAlign: 'left',
  background: 'transparent',
  color: cssVarV2('text/primary'),
  fontSize: cssVar('fontSm'),
  fontWeight: 600,
  cursor: 'pointer',
  selectors: {
    '&:hover': {
      color: cssVarV2('button/primary'),
    },
  },
});

export const paperMeta = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: cssVar('fontXs'),
  color: cssVarV2('text/secondary'),
});

export const badge = style({
  display: 'inline-flex',
  alignItems: 'center',
  width: 'fit-content',
  maxWidth: '100%',
  borderRadius: 999,
  padding: '2px 8px',
  fontSize: 11,
  lineHeight: '16px',
  color: cssVarV2('text/secondary'),
  background: cssVarV2('layer/background/secondary'),
});

export const warningBadge = style([
  badge,
  {
    color: '#9a5b00',
    background: '#fff7e6',
  },
]);

export const rowActions = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  '@media': {
    '(max-width: 860px)': {
      justifyContent: 'flex-start',
      flexWrap: 'wrap',
    },
  },
});

export const linkButton = style({
  border: 0,
  padding: 0,
  background: 'transparent',
  color: cssVarV2('button/primary'),
  fontSize: cssVar('fontXs'),
  cursor: 'pointer',
});

export const empty = style({
  padding: '32px 16px',
  textAlign: 'center',
  color: cssVarV2('text/secondary'),
  fontSize: cssVar('fontSm'),
});

export const emptyAction = style({
  display: 'flex',
  justifyContent: 'center',
  marginTop: 12,
});

export const notice = style({
  borderRadius: 8,
  border: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  background: cssVarV2('layer/background/secondary'),
  padding: 12,
  fontSize: cssVar('fontXs'),
  lineHeight: '18px',
  color: cssVarV2('text/secondary'),
});

export const feedRows = style({
  display: 'flex',
  flexDirection: 'column',
});

export const feedRow = style({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 10,
  alignItems: 'center',
  padding: '10px 14px',
  borderBottom: `1px solid ${cssVarV2('layer/insideBorder/border')}`,
  selectors: {
    '&:last-child': {
      borderBottom: 0,
    },
  },
  '@media': {
    '(max-width: 620px)': {
      gridTemplateColumns: '1fr',
      alignItems: 'stretch',
    },
  },
});

export const feedTitle = style({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: cssVar('fontSm'),
  fontWeight: 600,
  color: cssVarV2('text/primary'),
});

export const feedMeta = style({
  marginTop: 3,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: cssVar('fontXs'),
  color: cssVarV2('text/secondary'),
});

export const quickFeeds = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
});

export const smallButtonGroup = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
});
