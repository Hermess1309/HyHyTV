import { createStyles } from '../styleEngine';
import { theme } from '../theme';

export const focusRingStyles = createStyles({
  ring: (isFocused: boolean, scale: number, transformOrigin: string) => ({
    transition: `transform ${theme.animation.focusDuration}ms cubic-bezier(0.16, 1, 0.3, 1), outline ${theme.animation.focusDuration}ms ease-out, box-shadow ${theme.animation.focusDuration}ms ease-out`,
    transform: isFocused ? `scale(${scale})` : 'scale(1)',
    transformOrigin,
    zIndex: isFocused ? 25 : 1,
    position: 'relative' as const,
    outline: isFocused ? '3.5px solid #ffffff' : 'none',
    outlineOffset: '2px',
    boxShadow: isFocused ? '0 6px 18px rgba(0,0,0,0.8)' : 'none',
    borderRadius: theme.tile.borderRadius,
    willChange: isFocused ? ('transform' as const) : ('auto' as const),
  }),
});
