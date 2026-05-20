import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { RoomMesh } from './RoomMesh';
import { PalaceMinimap } from './PalaceMinimap';
import { Loader2 } from 'lucide-react';

interface RoomData {
  name: string;
  width_m: number;
  height_m: number;
  connections: string[];
  notable_features?: string[];
  floor_type?: string;
}

interface Props {
  rooms: RoomData[];
  mode?: 'orbit' | 'walk';
  selectedRoom?: string;
  onRoomClick?: (roomName: string) => void;
}

const WALL_HEIGHT = 2.5;
const GRID_SCALE = 1.0; // 1 unit = 1 meter

function layoutRooms(rooms: RoomData[]): Array<RoomData & { x: number; z: number }> {
  // Simple grid layout: place rooms in a row, branching by connections
  const placed: Array<RoomData & { x: number; z: number }> = [];
  let x = 0;
  let z = 0;
  let maxWidthInRow = 0;

  for (const room of rooms) {
    const w = room.width_m * GRID_SCALE;
    const d = room.height_m * GRID_SCALE;

    placed.push({ ...room, x, z });
    x += w + 1; // 1m gap between rooms
    maxWidthInRow = Math.max(maxWidthInRow, d);

    if (x > 20) { x = 0; z += maxWidthInRow + 1; maxWidthInRow = 0; } // new row
  }

  return placed;
}

function FallbackUI() {
  return (
    <div className="flex items-center justify-center h-64 bg-slate-900 rounded-xl">
      <Loader2 size={32} className="animate-spin text-slate-500" />
    </div>
  );
}

export function PalaceRenderer({ rooms, mode = 'orbit', selectedRoom, onRoomClick }: Props) {
  const placedRooms = useMemo(() => layoutRooms(rooms), [rooms]);

  if (!rooms?.length) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-900/50 rounded-xl border border-slate-800">
        <p className="text-slate-500">No rooms detected — scan your home first</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[500px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
      <Suspense fallback={<FallbackUI />}>
        <Canvas shadows dpr={[1, 1.5]} camera={{ position: [10, 12, 15], fov: 50 }}>
          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[10, 15, 10]}
            intensity={0.8}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <hemisphereLight args={['#b1e1ff', '#3a3a3a', 0.3]} />

          {/* Ground plane */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5, -0.01, 5]} receiveShadow>
            <planeGeometry args={[50, 50]} />
            <meshStandardMaterial color="#1a1a2e" />
          </mesh>

          {/* Rooms */}
          {placedRooms.map((room, i) => (
            <RoomMesh
              key={i}
              room={room}
              position={[room.x, 0, room.z]}
              wallHeight={WALL_HEIGHT}
              scale={GRID_SCALE}
              selected={room.name === selectedRoom}
              onClick={() => onRoomClick?.(room.name)}
            />
          ))}

          {/* Controls */}
          {mode === 'orbit' ? (
            <OrbitControls
              enableDamping
              dampingFactor={0.1}
              maxPolarAngle={Math.PI / 2.2}
              target={[5, 1, 3]}
            />
          ) : (
            <PerspectiveCamera makeDefault position={[2, 1.6, 1]} fov={70} />
          )}
        </Canvas>
      </Suspense>

      {/* Minimap overlay */}
      <PalaceMinimap rooms={placedRooms} selectedRoom={selectedRoom} />
    </div>
  );
}
