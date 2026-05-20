import { useState, useRef, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface RoomData {
  name: string;
  width_m: number;
  height_m: number;
  connections: string[];
  notable_features?: string[];
  floor_type?: string;
  x: number;
  z: number;
}

interface PlacedLocus {
  concept: string;
  description: string;
  mnemonic: string;
  image_url?: string;
  room_id: string;
  x: number;
  y: number;
  z: number;
}

interface TourEvent {
  locusIndex: number;
  concept: string;
  correct: boolean;
  recallTimeMs: number;
}

interface Props {
  rooms: Array<RoomData>;
  loci: PlacedLocus[];
  onComplete: (events: TourEvent[]) => void;
  onExit: () => void;
}

const MOVE_SPEED = 2.5; // m/s
const ROOM_TRANSITION_DURATION = 1500;

function buildTourPath(rooms: Array<RoomData>, loci: PlacedLocus[]): PlacedLocus[] {
  // Sort loci by room traversal order, then position within room
  const roomOrder = rooms.map(r => r.name);
  return [...loci].sort((a, b) => {
    const roomA = roomOrder.indexOf(a.room_id);
    const roomB = roomOrder.indexOf(b.room_id);
    if (roomA !== roomB) return roomA - roomB;
    return (a.x + a.z) - (b.x + b.z); // front-to-back within room
  });
}

function TourCamera({ target, onArrived }: { target: THREE.Vector3; onArrived?: () => void }) {
  const { camera } = useThree();
  const startPos = useRef(camera.position.clone());
  const startTime = useRef(Date.now());
  const arrived = useRef(false);

  useFrame(() => {
    if (arrived.current) return;
    const elapsed = Date.now() - startTime.current;
    const t = Math.min(elapsed / ROOM_TRANSITION_DURATION, 1);
    // Ease in-out
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    camera.position.lerpVectors(startPos.current, target, eased);
    camera.lookAt(target.x, target.y - 0.5, target.z + 1);

    if (t >= 1 && !arrived.current) {
      arrived.current = true;
      onArrived?.();
    }
  });

  return null;
}

export function Palace3DTour({ rooms, loci, onComplete, onExit }: Props) {
  const [currentLocusIndex, setCurrentLocusIndex] = useState(0);
  const [showConcept, setShowConcept] = useState(false);
  const [recallStart, setRecallStart] = useState<number | null>(null);
  const [events, setEvents] = useState<TourEvent[]>([]);
  const [tourComplete, setTourComplete] = useState(false);
  const [moving, setMoving] = useState(true);

  const tourPath = buildTourPath(rooms, loci);
  const currentLocus = tourPath[currentLocusIndex];
  const room = rooms.find(r => r.name === currentLocus?.room_id);

  // Camera target position
  const targetPos = room && currentLocus
    ? new THREE.Vector3(
        room.x + currentLocus.x * room.width_m,
        1.6, // eye height
        room.z + currentLocus.z * room.height_m - 1.5
      )
    : new THREE.Vector3(5, 1.6, 3);

  const handleArrived = useCallback(() => {
    setMoving(false);
    setRecallStart(Date.now());
  }, []);

  const handleRecall = useCallback((remembered: boolean) => {
    const recallTime = recallStart ? Date.now() - recallStart : 0;
    const newEvent: TourEvent = {
      locusIndex: currentLocusIndex,
      concept: currentLocus.concept,
      correct: remembered,
      recallTimeMs: recallTime,
    };
    setEvents(prev => [...prev, newEvent]);

    if (currentLocusIndex + 1 >= tourPath.length) {
      setTourComplete(true);
      onComplete([...events, newEvent]);
    } else {
      setCurrentLocusIndex(prev => prev + 1);
      setShowConcept(false);
      setMoving(true);
      setRecallStart(null);
    }
  }, [currentLocusIndex, currentLocus, recallStart, events, tourPath.length, onComplete]);

  if (tourComplete) {
    const correct = events.filter(e => e.correct).length;
    const avgTime = events.reduce((s, e) => s + e.recallTimeMs, 0) / events.length;
    return (
      <div className="flex flex-col items-center justify-center h-96 p-8">
        <h3 className="text-2xl font-bold text-white mb-4">Tour Complete! 🎉</h3>
        <div className="space-y-2 text-center mb-6">
          <p className="text-lg">
            <span className="text-green-400 font-bold">{correct}/{events.length}</span> loci recalled correctly
          </p>
          <p className="text-sm text-slate-400">Avg recall time: {(avgTime / 1000).toFixed(1)}s</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => { setCurrentLocusIndex(0); setEvents([]); setTourComplete(false); setMoving(true); }}>
            Retry Tour
          </Button>
          <Button variant="outline" onClick={onExit}>Exit</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[600px] rounded-xl overflow-hidden bg-black border border-slate-800">
      <Canvas shadows camera={{ position: [5, 5, 10], fov: 70 }}>
        <TourCamera target={targetPos} onArrived={handleArrived} />

        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 10, 5]} intensity={0.5} />

        {/* Simple room wireframes */}
        {rooms.map((room, i) => (
          <group key={i} position={[room.x, 0, room.z]}>
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(room.width_m, 2.5, room.height_m)]} />
              <lineBasicMaterial color="#4A4A6A" transparent opacity={0.3} />
            </lineSegments>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[room.width_m / 2, 0.01, room.height_m / 2]}>
              <planeGeometry args={[room.width_m, room.height_m]} />
              <meshStandardMaterial color="#1a1a2e" />
            </mesh>
          </group>
        ))}

        {/* Current locus highlight */}
        {currentLocus && room && (
          <Billboard position={[
            room.x + currentLocus.x * room.width_m,
            currentLocus.y,
            room.z + currentLocus.z * room.height_m
          ]} follow>
            <mesh>
              <sphereGeometry args={[0.3, 16, 16]} />
              <meshStandardMaterial
                color={showConcept ? '#22C55E' : '#F59E0B'}
                emissive={showConcept ? '#22C55E' : '#F59E0B'}
                emissiveIntensity={0.5}
              />
            </mesh>
          </Billboard>
        )}
      </Canvas>

      {/* Tour HUD overlay */}
      <div className="absolute bottom-0 left-0 right-0">
        <div className="p-4 bg-gradient-to-t from-black/90 to-transparent">
          <Progress
            value={(currentLocusIndex / Math.max(tourPath.length - 1, 1)) * 100}
            className="h-1 mb-3"
          />

          {moving ? (
            <p className="text-center text-slate-400 text-sm animate-pulse">
              Walking to next locus...
            </p>
          ) : (
            <Card className="p-4 bg-slate-900/95 border-slate-700 backdrop-blur">
              <p className="text-sm text-slate-400 mb-2">
                Locus {currentLocusIndex + 1} of {tourPath.length} • Room: {currentLocus.room_id}
              </p>
              <p className="text-lg text-white font-medium mb-3 text-center">
                What concept is anchored here?
              </p>

              {showConcept ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <p className="text-indigo-300 font-bold text-lg">{currentLocus.concept}</p>
                    <p className="text-slate-400 text-sm mt-1">{currentLocus.description}</p>
                  </div>
                  <div className="flex gap-2 justify-center">
                    <Button size="sm" variant="outline" onClick={() => handleRecall(false)}>
                      <X size={14} className="mr-1" /> Forgot
                    </Button>
                    <Button size="sm" onClick={() => handleRecall(true)}>
                      <Check size={14} className="mr-1" /> Remembered
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 justify-center">
                  <Button size="sm" onClick={() => setShowConcept(true)}>
                    <Eye size={14} className="mr-1" /> Reveal
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Exit button */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-3 left-3 bg-black/50"
        onClick={onExit}
      >
        <ArrowLeft size={14} className="mr-1" /> Exit Tour
      </Button>
    </div>
  );
}
