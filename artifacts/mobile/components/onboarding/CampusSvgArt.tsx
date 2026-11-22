import React, { useMemo } from "react";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  Path,
  G,
} from "react-native-svg";

interface CampusSvgArtProps {
  progress?: number; // 0 to 1 progress for parallax
  width?: number | string;
  height?: number | string;
}

export default function CampusSvgArt({
  progress = 0,
  width = "100%",
  height = "100%",
}: CampusSvgArtProps) {
  const p = Math.max(0, Math.min(1, progress));

  // Pre-calculate window rectangles
  const windows = useMemo(() => {
    const list: { x: number; y: number }[] = [];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 14; c++) {
        const x = 22 + c * 19;
        if (x > 106 && x < 196) continue;
        list.push({ x, y: 403 + r * 24 });
      }
    }
    return list;
  }, []);

  // Pre-calculate student silhouettes on the lawn
  const students = useMemo(() => {
    const list: { x: number; y: number; scale: number }[] = [];
    const rows = [
      [478, 0.85, 12],
      [493, 1.05, 14],
      [510, 1.3, 17],
    ];
    rows.forEach(([y, k, g], r) => {
      for (let x = 8 + (r % 2) * 6; x < 300; x += g) {
        list.push({ x, y, scale: k });
      }
    });
    return list;
  }, []);

  const sunCy = 400 - 26 * p;
  const l1TransX = -6 * p;
  const l2TransX = -11 * p;
  const l3TransX = -16 * p;
  const l4TransX = -26 * p;
  const l4TransY = -6 * p;

  return (
    <Svg
      viewBox="0 0 300 620"
      preserveAspectRatio="xMidYMid slice"
      width={width}
      height={height}
      aria-hidden={true}
    >
      <Defs>
        <LinearGradient id="protoSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2A1466" />
          <Stop offset="0.45" stopColor="#7A4FD0" />
          <Stop offset="0.7" stopColor="#F09FB4" />
          <Stop offset="1" stopColor="#FFD8A8" />
        </LinearGradient>
        <RadialGradient id="protoSun" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor="#FFF3D6" />
          <Stop offset="0.3" stopColor="#FFC98A" stopOpacity="0.85" />
          <Stop offset="1" stopColor="#FFC98A" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="protoLawn" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3F6F55" />
          <Stop offset="1" stopColor="#12302B" />
        </LinearGradient>
      </Defs>

      {/* Sky Background */}
      <Rect width="300" height="620" fill="url(#protoSky)" />

      {/* Golden Glowing Sun */}
      <Circle cx="205" cy={sunCy} r="95" fill="url(#protoSun)" />

      {/* Layer 1: Distant hills */}
      <G transform={`translate(${l1TransX}, 0)`}>
        <Path
          d="M-30 405Q40 350 110 392T250 372T340 400V480H-30Z"
          fill="#6A58A8"
          opacity="0.8"
        />
      </G>

      {/* Layer 2: Mid-distance hills */}
      <G transform={`translate(${l2TransX}, 0)`}>
        <Path
          d="M-30 425Q60 390 140 418T340 410V480H-30Z"
          fill="#3D3478"
        />
      </G>

      {/* Layer 3: Main Navodaya Vidyalaya Campus Building */}
      <G transform={`translate(${l3TransX}, 0)`}>
        {/* Main Building Wings */}
        <Rect x="14" y="396" width="272" height="64" fill="#F1E6D6" />
        <Rect x="14" y="390" width="272" height="8" fill="#A99AE0" />

        {/* Central Portico / Architecture */}
        <Rect x="112" y="370" width="76" height="90" fill="#F7EEE0" />
        <Path d="M104 372L150 342L196 372Z" fill="#7A3FC0" />

        {/* Building Columns */}
        <G fill="#8A6A76">
          <Rect x="120" y="396" width="8" height="64" />
          <Rect x="136" y="396" width="8" height="64" />
          <Rect x="156" y="396" width="8" height="64" />
          <Rect x="172" y="396" width="8" height="64" />
        </G>

        {/* Archway Entrance */}
        <Rect x="144" y="420" width="12" height="40" rx="6" fill="#2D2554" />

        {/* Classroom Windows */}
        <G fill="#3A3270">
          {windows.map((w, idx) => (
            <Rect key={`w-${idx}`} x={w.x} y={w.y} width="8" height="12" rx="1" />
          ))}
        </G>

        {/* Indian Flagpole & Tricolor */}
        <Rect x="258" y="300" width="2.2" height="160" fill="#EEEEEE" />
        <G>
          <Rect x="260" y="301" width="24" height="5" fill="#FF9933" />
          <Rect x="260" y="306" width="24" height="5" fill="#FFFFFF" />
          <Rect x="260" y="311" width="24" height="5" fill="#138808" />
        </G>

        {/* Trees & Campus Foliage */}
        <G fill="#1C3A3A">
          <Circle cx="8" cy="430" r="30" />
          <Circle cx="292" cy="436" r="26" />
          <Circle cx="44" cy="446" r="20" />
        </G>
      </G>

      {/* Layer 4: Fore lawn & Pathways & Student Silhouettes */}
      <G transform={`translate(${l4TransX}, ${l4TransY})`}>
        <Rect y="458" width="300" height="170" fill="url(#protoLawn)" />
        <Path d="M150 460L96 620H204Z" fill="#D6C3A4" opacity="0.45" />

        {/* Students standing on lawn */}
        {students.map((st, idx) => (
          <G
            key={`st-${idx}`}
            transform={`translate(${st.x}, ${st.y}) scale(${st.scale})`}
          >
            <Circle cy="-9" r="2.4" fill="#2B2118" />
            <Rect x="-3" y="-6" width="6" height="7" rx="1.5" fill="#9CC3EF" />
            <Rect x="-3" y="1" width="6" height="7" fill="#1C2F5C" />
          </G>
        ))}
      </G>
    </Svg>
  );
}
