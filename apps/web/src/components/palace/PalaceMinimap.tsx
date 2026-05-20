interface RoomData {
  name: string;
  width_m: number;
  height_m: number;
  connections: string[];
  x: number;
  z: number;
}

interface Props {
  rooms: Array<RoomData>;
  selectedRoom?: string;
}

const SCALE = 15; // pixels per meter

export function PalaceMinimap({ rooms, selectedRoom }: Props) {
  if (!rooms?.length) return null;

  // Calculate bounding box
  let maxX = 0, maxZ = 0;
  rooms.forEach(r => {
    maxX = Math.max(maxX, r.x + r.width_m);
    maxZ = Math.max(maxZ, r.z + r.height_m);
  });

  const padding = 20;
  const width = Math.max(maxX * SCALE + padding * 2, 150);
  const height = Math.max(maxZ * SCALE + padding * 2, 100);

  return (
    <div className="absolute bottom-3 right-3 bg-slate-900/90 backdrop-blur rounded-lg p-2 border border-slate-700/50 shadow-xl">
      <p className="text-[10px] text-slate-500 mb-1 text-center">Floor Plan</p>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block"
      >
        {rooms.map((room, i) => {
          const rx = room.x * SCALE + padding;
          const rz = room.z * SCALE + padding;
          const rw = room.width_m * SCALE;
          const rh = room.height_m * SCALE;
          const isSelected = room.name === selectedRoom;

          return (
            <g key={i}>
              <rect
                x={rx}
                y={rz}
                width={rw}
                height={rh}
                fill={isSelected ? '#4A6FA5' : '#2A2A3E'}
                stroke={isSelected ? '#6B9FD5' : '#4A4A5E'}
                strokeWidth={1}
                rx={2}
                className="transition-colors"
              />
              <text
                x={rx + rw / 2}
                y={rz + rh / 2 + 4}
                textAnchor="middle"
                fill="white"
                fontSize={Math.min(10, rw / room.name.length * 2)}
                fontFamily="sans-serif"
              >
                {room.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
