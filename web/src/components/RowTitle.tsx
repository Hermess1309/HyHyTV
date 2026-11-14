import { rowTitleStyles } from '../styles/componentStyles/rowTitleStyles';

interface RowTitleProps {
  title: string;
  isRowFocused: boolean;
  paddingLeft?: number;
}

export function RowTitle({ title, isRowFocused, paddingLeft }: RowTitleProps) {
  return (
    <div
      style={{
        ...rowTitleStyles.title(isRowFocused, paddingLeft),
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span>{title}</span>
      <span
        style={{
          fontSize: 12,
          color: '#54b9c5',
          fontWeight: 600,
          opacity: isRowFocused ? 1 : 0,
          transform: isRowFocused ? 'translateX(0)' : 'translateX(-8px)',
          transition: 'all 0.2s ease',
        }}
      >
        Khám phá &gt;
      </span>
    </div>
  );
}
