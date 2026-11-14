import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../lib/util';

// Cranes in flight, seen from above, redrawn every frame onto a fixed grid of square pixels.
// Each pixel's brightness is how much of the bird covers it, so the wings change shape as they
// beat and pixels brighten and dim as a bird glides across the grid.
const CELL = 4; // grid step in px
const P = CELL - 1; // drawn pixel size (1px gap between pixels)
const FPS = 12;
const LEVELS = [0.22, 0.45, 0.7, 1]; // brightness steps
const HOME_HEADING = -Math.PI / 4; // the flock drifts up and to the right
type Bird = {
  x: number; y: number; heading: number; home: number; speed: number; size: number; alpha: number;
  phase: number; flap: number; wobble: number;
  lead: Bird | null; slot: [number, number]; // a follower's leader and its place in the V (back, sideways)
  margin: number; // how far past the edge a leader or loner goes before it is brought back in
  course: number; // its usual direction; each re-entry varies a little around this
  lane: number; // 0..1 across the screen, perpendicular to the flight path; each flock and loner keeps its own
  px: number; py: number; // where it is drawn: its path position plus any nudge
  ox: number; oy: number; kx: number; ky: number; hurry: number; // nudge away from a tap (fades back), and how startled it is
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

const bird = (o: Partial<Bird>): Bird => ({
  course: HOME_HEADING, lane: 0.5, x: 0, y: 0, heading: HOME_HEADING, home: HOME_HEADING, speed: 24, size: 56, alpha: 0.85,
  phase: rand(0, 6.28), flap: 5, wobble: rand(0, 6.28), lead: null, slot: [0, 0], margin: 0, px: 0, py: 0, ox: 0, oy: 0, kx: 0, ky: 0, hurry: 0, ...o,
});

// Puts a leader or loner on its lane: `along` (-0.5..0.5) is how far along the flight path, as a share of the screen.
function place(b: Bird, w: number, h: number, along: number) {
  const cs = Math.cos(b.heading), sn = Math.sin(b.heading);
  const span = Math.abs(w * sn) + Math.abs(h * cs), length = Math.abs(w * cs) + Math.abs(h * sn); // screen width across / along the path
  const across = (b.lane - 0.5) * span * 0.92;
  b.x = w / 2 - sn * across + cs * along * length;
  b.y = h / 2 + cs * across + sn * along * length;
}

// One V-formation: a leader with `ranks` birds trailing on each side, spaced wide so the V reads clearly.
function formation(lane: number, along: number, ranks: number, size: number, alpha: number, speed: number): Bird[] {
  const gap = size * 1.2;
  const lead = bird({ lane, size: size * 1.06, alpha, speed, margin: gap * ranks + size });
  lead.x = along; // starting position along the path, applied in makeFlock
  const followers = Array.from({ length: ranks * 2 }, (_, i) => {
    const rank = Math.floor(i / 2) + 1, side = i % 2 ? 1 : -1;
    return bird({ lead, slot: [rank * gap, side * rank * gap * 0.9], size: size * rand(0.9, 1.02), alpha, flap: rand(4.6, 5.4) });
  });
  return [lead, ...followers];
}

// Lanes across the screen (top-left to bottom-right): far flock, small loner, near flock in the middle,
// large loner, middle flock. Everyone flies the same way, so lanes never cross and the loners stay in the
// open space between flocks.
const makeFlock = (w: number, h: number): Bird[] => {
  const birds = [
    ...formation(0.14, 0.2, 2, 32, 0.6, 15),
    bird({ lane: 0.3, x: -0.3, size: 34, alpha: 0.55, speed: 13, flap: 6.2, margin: 30 }),
    ...formation(0.5, -0.05, 2, 48, 0.9, 23),
    bird({ lane: 0.74, x: 0.3, size: 54, alpha: 0.95, speed: 29, flap: 4.3, margin: 45 }),
    ...formation(0.89, -0.2, 1, 40, 0.72, 19),
  ];
  for (const b of birds) if (!b.lead) place(b, w, h, b.x);
  return birds;
};

// How much of a pixel at (px, py) is covered by a rounded line from A to B whose half-width goes from ra to rb.
function cover(px: number, py: number, ax: number, ay: number, bx: number, by: number, ra: number, rb: number) {
  const dx = bx - ax, dy = by - ay;
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const ex = px - ax - dx * t, ey = py - ay - dy * t;
  const c = 0.5 - (Math.sqrt(ex * ex + ey * ey) - (ra + (rb - ra) * t)) / CELL;
  return c < 0 ? 0 : c > 1 ? 1 : c;
}

// Brings a leader or loner back after it has left: back on its own lane, started just past the edge,
// so it is in view again within a second or two (its followers trail in behind it).
function enter(b: Bird, w: number, h: number) {
  b.heading = b.home = b.course + rand(-0.02, 0.02);
  place(b, w, h, rand(-0.15, 0.15));
  const cs = Math.cos(b.heading), sn = Math.sin(b.heading), pad = b.size * 0.55;
  while (b.x > -pad && b.x < w + pad && b.y > -pad && b.y < h + pad) { b.x -= cs * 16; b.y -= sn * 16; }
  b.ox = 0; b.oy = 0;
}

function step(flock: Bird[], dt: number, time: number, w: number, h: number) {
  for (const b of flock) {
    const lead = b.lead;
    if (lead) {
      // Followers keep their place in the V behind their leader, drifting a few pixels so it doesn't look rigid.
      const cs = Math.cos(lead.heading), sn = Math.sin(lead.heading);
      const back = b.slot[0] + Math.sin(time * 0.7 + b.wobble) * 4, side = b.slot[1] + Math.cos(time * 0.6 + b.wobble) * 4;
      b.x = lead.x - cs * back - sn * side;
      b.y = lead.y - sn * back + cs * side;
      b.heading = lead.heading;
    } else {
      // The leader and the loners hold their own direction with a slow meander, and wrap around the edges.
      const d = b.home - b.heading;
      b.heading += Math.atan2(Math.sin(d), Math.cos(d)) * 0.5 * dt + Math.sin(time * 0.4 + b.wobble) * 0.04 * dt; // gentle, so lanes stay apart
      b.x += Math.cos(b.heading) * b.speed * dt;
      b.y += Math.sin(b.heading) * b.speed * dt;
      const m = b.margin; // a leader waits until its whole V is off-screen
      if (b.x < -m || b.x > w + m || b.y < -m || b.y > h + m) enter(b, w, h);
    }
    // A tap pushes a bird off its path; the push dies out and the bird eases back into place.
    b.ox += b.kx * dt; b.oy += b.ky * dt;
    const fade = Math.exp(-3.2 * dt), settle = Math.exp(-0.9 * dt);
    b.kx *= fade; b.ky *= fade; b.ox *= settle; b.oy *= settle;
    b.hurry *= Math.exp(-2 * dt);
    b.phase += b.flap * (1 + 0.8 * b.hurry) * dt;
    b.px = b.x + b.ox; b.py = b.y + b.oy;
  }
}

// Returns one SVG path per brightness level, plus one for the red crowns.
// A bird is `size` long from beak tip (+0.5) to toes (-0.5); x runs forward, y out to the side.
export function draw(flock: Bird[], cols: number, rows: number, buf: Float32Array, touched: number[]): string[] {
  for (const i of touched) buf[i] = 0;
  touched.length = 0;
  let crowns = '';

  for (const b of flock) {
    const s = b.size, cs = Math.cos(b.heading), sn = Math.sin(b.heading);
    // Wing beat seen from above: mid-beat the wings look shorter, bend back more at the wrist, and catch less light.
    const open = 0.5 + 0.5 * Math.cos(b.phase);
    const reach = 0.35 + 0.65 * open;
    const wristX = s * (0.11 - 0.05 * (1 - open)), wristY = s * 0.25 * reach;
    const tipX = wristX - s * (0.08 + 0.16 * (1 - open)), tipY = s * 0.54 * reach;
    const wingLight = 0.6 + 0.4 * open;

    const r = s * 0.6 + CELL;
    const x0 = Math.max(0, Math.floor((b.px - r) / CELL)), x1 = Math.min(cols - 1, Math.ceil((b.px + r) / CELL));
    const y0 = Math.max(0, Math.floor((b.py - r) / CELL)), y1 = Math.min(rows - 1, Math.ceil((b.py + r) / CELL));
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        // Pixel centre in the bird's own frame.
        const wx = (gx + 0.5) * CELL - b.px, wy = (gy + 0.5) * CELL - b.py;
        const lx = wx * cs + wy * sn, ly = -wx * sn + wy * cs;
        const ay = ly < 0 ? -ly : ly; // the bird is symmetric left/right
        let v = 0;
        if (ay < s * 0.06 + CELL) {
          v = Math.max(
            cover(lx, ly, s * 0.5, 0, s * 0.43, 0, s * 0.006, s * 0.014), // beak
            cover(lx, ly, s * 0.415, 0, s * 0.385, 0, s * 0.028, s * 0.028), // head
            cover(lx, ly, s * 0.385, 0, s * 0.12, 0, s * 0.016, s * 0.024), // long neck
            cover(lx, ly, s * 0.12, 0, -s * 0.12, 0, s * 0.052, s * 0.046), // body
            cover(lx, ly, -s * 0.12, 0, -s * 0.21, 0, s * 0.04, s * 0.014), // tail
            cover(lx, ly, -s * 0.19, 0, -s * 0.5, 0, s * 0.012, s * 0.007), // trailing legs
          );
        }
        if (lx > tipX - s * 0.07 - CELL && lx < s * 0.2 + CELL) {
          const wing = Math.max(
            cover(lx, ay, s * 0.05, s * 0.03, wristX, wristY, s * 0.07, s * 0.058), // inner wing, shoulder to wrist
            cover(lx, ay, wristX, wristY, tipX, tipY, s * 0.058, s * 0.022), // outer wing, wrist to tip
          ) * wingLight;
          if (wing > v) v = wing;
        }
        v *= b.alpha;
        if (v > 0.08) {
          const i = gy * cols + gx;
          if (buf[i] === 0) touched.push(i);
          if (v > buf[i]) buf[i] = v;
        }
      }
    }
    const hx = Math.floor((b.px + cs * s * 0.4) / CELL), hy = Math.floor((b.py + sn * s * 0.4) / CELL);
    if (hx >= 0 && hx < cols && hy >= 0 && hy < rows) crowns += `M${hx * CELL} ${hy * CELL}h${P}v${P}h-${P}z`;
  }

  const out = ['', '', '', '', crowns];
  for (const i of touched) out[Math.min(3, Math.floor(buf[i] * 4))] += `M${(i % cols) * CELL} ${Math.floor(i / cols) * CELL}h${P}v${P}h-${P}z`;
  return out;
}

export type PondHandle = { scatter: (x: number, y: number) => void };

// Decorative layer that sits behind the cards: never takes touches. Pass `paused` while its screen is hidden.
// ponytail: redrawn in JS at 12 fps; if it costs too much, lower FPS/COUNT or move to a native canvas (Skia).
export function CranePond({ ref, paused }: { ref?: Ref<PondHandle>; paused?: boolean }) {
  const { width, height } = useWindowDimensions();
  const flock = useRef<Bird[] | null>(null);
  const [paths, setPaths] = useState<string[]>([]);

  useEffect(() => {
    if (paused) return;
    const birds = (flock.current ??= makeFlock(width, height));
    const cols = Math.ceil(width / CELL), rows = Math.ceil(height / CELL);
    const buf = new Float32Array(cols * rows), touched: number[] = [];
    let raf = 0, last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 1000 / FPS) return;
      const dt = Math.min((now - last) / 1000, 0.12);
      last = now;
      step(birds, dt, now / 1000, width, height);
      setPaths(draw(birds, cols, rows, buf, touched));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, width, height]);

  // Tap: birds near the touch are nudged a short way off (at most ~40px) and beat faster for a moment.
  useImperativeHandle(ref, () => ({
    scatter(x, y) {
      for (const b of flock.current ?? []) {
        const dx = b.px - x, dy = b.py - y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d > 240) continue;
        const near = 1 - d / 240;
        b.kx += (dx / d) * 130 * near;
        b.ky += (dy / d) * 130 * near;
        b.hurry = Math.max(b.hurry, near);
      }
    },
  }), []);

  return (
    <View style={[StyleSheet.absoluteFill, { opacity: 0.72 }]} pointerEvents="none">
      <Svg width={width} height={height}>
        {LEVELS.map((o, i) => <Path key={o} d={paths[i] ?? ''} fill="#DADAE8" fillOpacity={o} />)}
        <Path d={paths[4] ?? ''} fill={colors.red} />
      </Svg>
    </View>
  );
}
