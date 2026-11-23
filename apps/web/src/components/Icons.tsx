import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const DoorOpen = (p: P) => (
  <Svg {...p}>
    <path d="M3 14V2h7v12M10 3l3 1.5V14" />
  </Svg>
);
export const DoorClosed = (p: P) => (
  <Svg {...p}>
    <path d="M3 14V2h10v12M10 8.5h.5" />
  </Svg>
);
export const Clock = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.5V8l2.5 1.5" />
  </Svg>
);
export const SlashCircle = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M3.8 12.2l8.4-8.4" />
  </Svg>
);
export const Question = (p: P) => (
  <Svg {...p}>
    <path d="M5.8 6a2.3 2.3 0 1 1 3.3 2.1c-.7.3-1.1.9-1.1 1.6v.3M8 12.2v.1" />
  </Svg>
);
export const ChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="M10 3L5 8l5 5" />
  </Svg>
);
export const ChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="M6 3l5 5-5 5" />
  </Svg>
);
export const External = (p: P) => (
  <Svg {...p}>
    <path d="M6 3h7v7M13 3L5 11" />
  </Svg>
);
export const Info = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="6.5" />
    <path d="M8 7v4M8 4.8v.2" />
  </Svg>
);
export const ListIcon = (p: P) => (
  <Svg {...p}>
    <path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.1M2.5 8h.1M2.5 12h.1" />
  </Svg>
);
export const MapIcon = (p: P) => (
  <Svg {...p}>
    <path d="M1.5 3.5l4-1.5 5 2 4-1.5v10l-4 1.5-5-2-4 1.5zM5.5 2v10M10.5 4v10" />
  </Svg>
);
export const Copy = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" />
    <path d="M10.5 5V3.5A1.5 1.5 0 0 0 9 2H3.5A1.5 1.5 0 0 0 2 3.5V9A1.5 1.5 0 0 0 3.5 10.5H5" />
  </Svg>
);
export const Check = (p: P) => (
  <Svg {...p}>
    <path d="M3 8.5l3 3 7-7" />
  </Svg>
);
export const Close = (p: P) => (
  <Svg {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Svg>
);
export const Search = (p: P) => (
  <Svg {...p}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </Svg>
);
export const Sun = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
  </Svg>
);
export const Moon = (p: P) => (
  <Svg {...p}>
    <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" />
  </Svg>
);
export const ChevronUp = (p: P) => (
  <Svg {...p}>
    <path d="M3 10l5-5 5 5" />
  </Svg>
);
export const Locate = (p: P) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="4.5" />
    <circle cx="8" cy="8" r="1.2" fill="currentColor" />
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2" />
  </Svg>
);
export const Calendar = (p: P) => (
  <Svg {...p}>
    <rect x="2" y="3" width="12" height="11" rx="2" />
    <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
  </Svg>
);
export const GitHub = (p: P) => (
  <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
  </svg>
);
