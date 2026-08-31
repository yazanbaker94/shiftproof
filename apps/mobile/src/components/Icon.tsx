import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

export type IconName =
  | 'home'
  | 'timesheet'
  | 'history'
  | 'profile'
  | 'calendar'
  | 'plus'
  | 'back'
  | 'check'
  | 'phone'
  | 'cloud'
  | 'edit'
  | 'note'
  | 'chevron'
  | 'download'
  | 'share'
  | 'shield'
  | 'receipt'
  | 'refresh';

interface Props { name: IconName; size?: number; color?: string; strokeWidth?: number }

export function Icon({ name, size = 24, color = '#0B2033', strokeWidth = 1.8 }: Props) {
  const common = { fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {name === 'home' && <><Path {...common} d="M3 10.8 12 3l9 7.8V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><Path {...common} d="M9 22v-7h6v7" /></>}
      {name === 'timesheet' && <><Rect {...common} x="4" y="3" width="16" height="18" rx="2" /><Line {...common} x1="8" y1="8" x2="9" y2="8" /><Line {...common} x1="12" y1="8" x2="17" y2="8" /><Line {...common} x1="8" y1="12" x2="9" y2="12" /><Line {...common} x1="12" y1="12" x2="17" y2="12" /><Line {...common} x1="8" y1="16" x2="9" y2="16" /><Line {...common} x1="12" y1="16" x2="17" y2="16" /></>}
      {name === 'history' && <><Circle {...common} cx="12" cy="12" r="9" /><Polyline {...common} points="12 7 12 12 15.5 14" /></>}
      {name === 'profile' && <><Circle {...common} cx="12" cy="7" r="4" /><Path {...common} d="M4 22a8 8 0 0 1 16 0" /></>}
      {name === 'calendar' && <><Rect {...common} x="3" y="5" width="18" height="16" rx="2" /><Line {...common} x1="7" y1="3" x2="7" y2="7" /><Line {...common} x1="17" y1="3" x2="17" y2="7" /><Line {...common} x1="3" y1="10" x2="21" y2="10" /><Circle cx="8" cy="14" r="1" fill={color} /><Circle cx="12" cy="14" r="1" fill={color} /><Circle cx="16" cy="14" r="1" fill={color} /></>}
      {name === 'plus' && <><Line {...common} x1="12" y1="4" x2="12" y2="20" /><Line {...common} x1="4" y1="12" x2="20" y2="12" /></>}
      {name === 'back' && <><Line {...common} x1="20" y1="12" x2="4" y2="12" /><Polyline {...common} points="10 18 4 12 10 6" /></>}
      {name === 'check' && <Polyline {...common} points="4 12.5 9.5 18 20 6" />}
      {name === 'phone' && <><Rect {...common} x="7" y="2" width="10" height="20" rx="2" /><Line {...common} x1="10" y1="18" x2="14" y2="18" /></>}
      {name === 'cloud' && <><Path {...common} d="M7 18h10a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.3 9.2 4.5 4.5 0 0 0 7 18Z" /><Polyline {...common} points="9 14 12 11 15 14" /><Line {...common} x1="12" y1="11" x2="12" y2="17" /></>}
      {name === 'edit' && <><Path {...common} d="M4 20h4l11-11-4-4L4 16Z" /><Line {...common} x1="13" y1="7" x2="17" y2="11" /></>}
      {name === 'note' && <><Path {...common} d="M4 4h16v13H9l-5 4Z" /><Line {...common} x1="8" y1="9" x2="16" y2="9" /><Line {...common} x1="8" y1="13" x2="13" y2="13" /></>}
      {name === 'chevron' && <Polyline {...common} points="9 5 16 12 9 19" />}
      {name === 'download' && <><Line {...common} x1="12" y1="3" x2="12" y2="15" /><Polyline {...common} points="7 11 12 16 17 11" /><Line {...common} x1="5" y1="21" x2="19" y2="21" /></>}
      {name === 'share' && <><Path {...common} d="M8 8H5v13h14V8h-3" /><Line {...common} x1="12" y1="3" x2="12" y2="15" /><Polyline {...common} points="7 7 12 2 17 7" /></>}
      {name === 'shield' && <><Path {...common} d="M12 2 20 5v6c0 5-3.3 9-8 11-4.7-2-8-6-8-11V5Z" /><Polyline {...common} points="8.5 12 11 14.5 16 9.5" /></>}
      {name === 'receipt' && <Path {...common} d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />}
      {name === 'refresh' && <><Path {...common} d="M20 11a8 8 0 1 0-2.3 5.7" /><Polyline {...common} points="20 5 20 11 14 11" /></>}
    </Svg>
  );
}
