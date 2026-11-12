/**
 * 아이콘 하나를 그린다.
 *
 * `assets/icons.js`의 모양 데이터를 받아 선으로 그린다. 크기와 색만 바꿔 쓰며,
 * 모르는 이름이 들어오면 아무것도 그리지 않고 자리만 차지한다(화면이 깨지지 않게).
 *
 * @param {{name: string, size?: number, color?: string, strokeWidth?: number}} props
 */
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import ICONS from '../assets/icons';
import { colors } from '../theme';

export default function Icon({ name, size = 22, color = colors.text, strokeWidth = 1.8 }) {
  const shapes = ICONS[name] ?? [];

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {shapes.map((shape, index) =>
        shape.d ? (
          <Path
            key={index}
            d={shape.d}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <Circle
            key={index}
            cx={shape.cx}
            cy={shape.cy}
            r={shape.r}
            stroke={color}
            strokeWidth={strokeWidth}
          />
        ),
      )}
    </Svg>
  );
}
