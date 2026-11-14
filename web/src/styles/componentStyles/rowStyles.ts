import { createStyles } from '../styleEngine';
import { theme } from '../theme';

export const rowStyles = createStyles({
  container: {},

  // TV mode
  overflowWrapper: {
    overflow: 'hidden',
    paddingTop: 40,
    paddingBottom: 40,
    marginTop: -40,
    marginBottom: -40,
  },

  // Hardware compositor accelerated 3D transform
  tilesWrapper: (scrollOffset: number) => ({
    display: 'flex' as const,
    gap: theme.spacing.tileGap,
    paddingLeft: theme.spacing.edgePadding,
    paddingRight: theme.spacing.edgePadding,
    transform: `translate3d(-${scrollOffset}px, 0, 0)`,
    willChange: 'transform' as const,
  }),

  leftSpacer: (width: number) => ({
    width,
    flexShrink: 0,
  }),

  // Web mode
  webRowContainer: {
    position: 'relative' as const,
  },

  webTilesWrapper: {
    display: 'flex' as const,
    gap: theme.spacing.tileGap,
    paddingLeft: theme.spacing.edgePadding,
    paddingRight: theme.spacing.edgePadding,
    overflowX: 'auto' as const,
    overflowY: 'hidden' as const,
    scrollSnapType: 'x mandatory' as const,
    scrollPaddingLeft: theme.spacing.edgePadding,
    scrollbarWidth: 'none' as const,
    msOverflowStyle: 'none' as const,
    paddingTop: 16,
    paddingBottom: 16,
  },

  chevron: (side: 'left' | 'right') => ({
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    [side]: 0,
    width: 48,
    zIndex: 5,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    background: 'rgba(0,0,0,0.5)',
    color: '#fff',
    border: 'none',
    fontSize: 32,
    cursor: 'pointer',
    opacity: 0,
    transition: 'opacity 200ms ease, background 200ms ease',
  }),
});
