import { useMemo } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

interface RoomData {
  name: string;
  width_m: number;
  height_m: number;
  connections: string[];
  notable_features?: string[];
  floor_type?: string;
}

interface Props {
  room: RoomData;
  position: [number, number, number];
  wallHeight: number;
  scale: number;
  selected?: boolean;
  onClick?: () => void;
}

const FLOOR_COLORS: Record<string, string> = {
  hardwood: '#8B6914',
  tile: '#D4C5B9',
  carpet: '#6B8E7A',
  other: '#7A7A8C',
};

const WALL_COLORS: Record<string, string> = {
  default: '#2A2A3E',
  selected: '#3B3B5C',
};

export function RoomMesh({ room, position, wallHeight, scale, selected, onClick }: Props) {
  const w = room.width_m * scale;
  const d = room.height_m * scale;
  const h = wallHeight;
  const floorColor = FLOOR_COLORS[room.floor_type || 'other'] || FLOOR_COLORS.other;
  const wallColor = selected ? WALL_COLORS.selected : WALL_COLORS.default;

  // Floor
  const floorGeo = useMemo(() => new THREE.PlaneGeometry(w, d), [w, d]);

  return (
    <group
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    >
      {/* Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[w / 2, 0.01, d / 2]}
        receiveShadow
      >
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={floorColor} roughness={0.8} />
      </mesh>

      {/* Walls — 4 sides */}
      <Wall pos={[0, h / 2, d / 2]} size={[w, h, 0.15]} color={wallColor} />
      <Wall pos={[0, h / 2, -d / 2]} size={[w, h, 0.15]} color={wallColor} />
      <Wall pos={[-w / 2, h / 2, 0]} size={[0.15, h, d]} color={wallColor} />
      <Wall pos={[w / 2, h / 2, 0]} size={[0.15, h, d]} color={wallColor} />

      {/* Ceiling (semi-transparent for top-down view) */}
      <mesh position={[w / 2, h, d / 2]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#2A2A3E" transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Room label */}
      <Text
        position={[w / 2, 0.1, d / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.5}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="black"
      >
        {room.name}
      </Text>

      {/* Door indicators on connected walls */}
      {room.connections?.map((conn, i) => {
        // Place door indicators on the wall closest to connected room
        // Simplified: put them on alternating walls
        const side = i % 4;
        const doorPos: [number, number, number] =
          side === 0 ? [w / 2, 1.2, 0] :
          side === 1 ? [0, 1.2, d / 2] :
          side === 2 ? [-w / 2, 1.2, 0] :
          [0, 1.2, -d / 2];

        return (
          <group key={i}>
            <mesh position={doorPos}>
              <boxGeometry args={[0.8, 2, 0.05]} />
              <meshStandardMaterial color="#4A6FA5" emissive="#2A4F85" emissiveIntensity={0.2} />
            </mesh>
            <Text
              position={[doorPos[0], doorPos[1] + 1.2, doorPos[2]]}
              fontSize={0.3}
              color="#8899BB"
              anchorX="center"
            >
              → {conn}
            </Text>
          </group>
        );
      })}
    </group>
  );
}

function Wall({ pos, size, color }: { pos: [number, number, number]; size: [number, number, number]; color: string }) {
  return (
    <mesh position={pos} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}
