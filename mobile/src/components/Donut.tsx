import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../lib/util';

export type Slice = { label: string; value: number; color: string };

// Point on a circle; angle 0 = 12 o'clock, clockwise.
const at = (cx: number, cy: number, r: number, a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];

// Ring segment between two angles.
function arc(cx: number, cy: number, r: number, inner: number, a0: number, a1: number) {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = at(cx, cy, r, a0), [x1, y1] = at(cx, cy, r, a1);
  const [x2, y2] = at(cx, cy, inner, a1), [x3, y3] = at(cx, cy, inner, a0);
  return `M${x0} ${y0}A${r} ${r} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${inner} ${inner} 0 ${large} 0 ${x3} ${y3}Z`;
}

// Donut with a 2px card-coloured gap between slices; the selected slice is drawn full strength,
// the others dimmed. The centre shows whatever the caller passes (e.g. total or the selected slice).
export function Donut({ slices, size = 200, thickness = 26, selected, center }: {
  slices: Slice[];
  size?: number;
  thickness?: number;
  selected?: number | null;
  center?: { top: string; bottom: string };
}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const c = size / 2, r = c - 2, inner = r - thickness;
  let a = 0;

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size}>
        {total <= 0 ? (
          <Circle cx={c} cy={c} r={r - thickness / 2} stroke={colors.fill} strokeWidth={thickness} fill="none" />
        ) : slices.length === 1 ? (
          <Circle cx={c} cy={c} r={r - thickness / 2} stroke={slices[0].color} strokeWidth={thickness} fill="none" />
        ) : (
          slices.map((s, i) => {
            const a0 = a, a1 = a + (s.value / total) * Math.PI * 2;
            a = a1;
            const dim = selected != null && selected !== i;
            return <Path key={s.label} d={arc(c, c, r, inner, a0, a1)} fill={s.color} opacity={dim ? 0.3 : 1} stroke={colors.card} strokeWidth={2} />;
          })
        )}
      </Svg>
      {center && (
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: thickness + 8, right: thickness + 8, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: '600' }} numberOfLines={1}>{center.top}</Text>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 2, fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>{center.bottom}</Text>
        </View>
      )}
    </View>
  );
}
