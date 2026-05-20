import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';

interface PlacedLocus {
  concept: string;
  description: string;
  mnemonic: string;
  image_url?: string;
  room_id: string;
  x: number;
  y: number;
  z: number;
  auto_placed: boolean;
}

interface Props {
  locus: PlacedLocus;
  roomWidth: number;
  roomDepth: number;
  onDrag?: (id: string, x: number, y: number, z: number) => void;
}

export function LocusBillboard({ locus, roomWidth, roomDepth, onDrag }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  // Load image texture if available
  if (locus.image_url && !texture) {
    new THREE.TextureLoader().load(
      locus.image_url,
      (tex) => setTexture(tex),
      undefined,
      () => {} // silent fail — show fallback
    );
  }

  // Convert normalized coords to room-local 3D position
  const worldX = locus.x * roomWidth;
  const worldY = locus.y;
  const worldZ = locus.z * roomDepth;

  // Billboard always faces camera
  return (
    <group position={[worldX, worldY, worldZ]}>
      <Billboard
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false}
      >
        <mesh
          ref={meshRef}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
        >
          {/* Locus image or placeholder */}
          <planeGeometry args={[0.8, 0.6]} />
          {texture ? (
            <meshStandardMaterial
              map={texture}
              transparent
              opacity={hovered ? 1 : 0.9}
              side={THREE.DoubleSide}
            />
          ) : (
            <meshStandardMaterial
              color={hovered ? '#6366F1' : '#4F46E5'}
              transparent
              opacity={0.85}
              side={THREE.DoubleSide}
            />
          )}

          {/* Concept label above billboard */}
          <mesh position={[0, 0.45, 0]}>
            <planeGeometry args={[1.0, 0.25]} />
            <meshBasicMaterial color="#1E1B4B" transparent opacity={0.8} side={THREE.DoubleSide} />
          </mesh>
        </mesh>
      </Billboard>

      {/* Concept text */}
      <Billboard follow={true}>
        <Text
          position={[0, worldY + 0.7, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.02}
          outlineColor="black"
          maxWidth={1.5}
        >
          {locus.concept}
        </Text>
      </Billboard>

      {/* Hover tooltip */}
      {hovered && (
        <Billboard follow={true}>
          <Text
            position={[0, worldY - 0.4, 0]}
            fontSize={0.12}
            color="#A5B4FC"
            anchorX="center"
            anchorY="top"
            maxWidth={1.5}
          >
            {locus.description.slice(0, 60)}
          </Text>
        </Billboard>
      )}
    </group>
  );
}
