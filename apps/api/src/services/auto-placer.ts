/**
 * Auto-placer: distributes loci across rooms with sensible spatial positioning.
 *
 * Algorithm:
 *   1. Round-robin rooms by traversal order (entrance → deepest)
 *   2. Space loci evenly along walls/surfaces within each room
 *   3. Max ~5 loci per room to avoid clutter
 *   4. LLM hint ('suggested_room') overrides round-robin if room exists
 *
 * Output: each locus assigned to a room with normalized x/y/z coordinates
 */

interface RoomData {
  name: string;
  width_m: number;
  height_m: number;
  connections: string[];
}

interface LocusInput {
  concept: string;
  description: string;
  mnemonic: string;
  suggested_room?: string;  // LLM hint
  image_url?: string;
}

interface PlacedLocus extends LocusInput {
  room_id: string;
  x: number;  // normalized 0-1 within room width
  y: number;  // height from floor (0.5-2.0m)
  z: number;  // normalized 0-1 within room depth
  auto_placed: boolean;
}

const MAX_LOCI_PER_ROOM = 5;
const WALL_OFFSET = 0.15; // meters from wall
const MIN_Y = 0.5;
const MAX_Y = 2.0;

export function autoPlaceLoci(rooms: RoomData[], loci: LocusInput[]): PlacedLocus[] {
  if (!rooms.length || !loci.length) return [];

  // Build room traversal order (entrance = first room, then BFS by connections)
  const traversalOrder = buildTraversalOrder(rooms);

  // Track loci per room
  const roomLoad = new Map<string, number>();
  for (const room of traversalOrder) roomLoad.set(room.name, 0);

  return loci.map((locus, index) => {
    // Check LLM hint first
    let targetRoom: RoomData | undefined;
    if (locus.suggested_room) {
      targetRoom = rooms.find(r =>
        r.name.toLowerCase() === locus.suggested_room!.toLowerCase()
      );
    }

    // Fall back to round-robin
    if (!targetRoom) {
      const roomIdx = index % traversalOrder.length;
      targetRoom = traversalOrder[roomIdx];

      // Skip full rooms
      if ((roomLoad.get(targetRoom.name) ?? 0) >= MAX_LOCI_PER_ROOM) {
        // Find first room with capacity
        targetRoom = traversalOrder.find(r =>
          (roomLoad.get(r.name) ?? 0) < MAX_LOCI_PER_ROOM
        ) || targetRoom;
      }
    }

    const currentLoad = roomLoad.get(targetRoom.name) ?? 0;
    roomLoad.set(targetRoom.name, currentLoad + 1);

    // Position: spread along walls, alternating sides
    const side = currentLoad % 4;
    const spacing = 1 / Math.max(MAX_LOCI_PER_ROOM, currentLoad + 1);
    const pos = WALL_OFFSET + spacing * (currentLoad + 0.5);

    let x: number, z: number;
    switch (side) {
      case 0: x = pos; z = WALL_OFFSET; break;          // Left wall
      case 1: x = 1 - WALL_OFFSET; z = pos; break;       // Back wall
      case 2: x = 1 - pos; z = 1 - WALL_OFFSET; break;   // Right wall
      default: x = WALL_OFFSET; z = 1 - pos; break;       // Front wall
    }

    return {
      ...locus,
      room_id: targetRoom.name,
      x: Math.max(0.05, Math.min(0.95, x)),
      y: MIN_Y + (Math.random() * (MAX_Y - MIN_Y)),
      z: Math.max(0.05, Math.min(0.95, z)),
      auto_placed: true,
    };
  });
}

/** BFS traversal from first room through connections */
function buildTraversalOrder(rooms: RoomData[]): RoomData[] {
  if (!rooms.length) return [];
  const visited = new Set<string>();
  const order: RoomData[] = [];
  const queue: RoomData[] = [rooms[0]];

  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current.name)) continue;
    visited.add(current.name);
    order.push(current);

    for (const connName of current.connections || []) {
      const conn = rooms.find(r => r.name === connName);
      if (conn && !visited.has(conn.name)) {
        queue.push(conn);
      }
    }
  }

  // Add any remaining unvisited rooms
  for (const room of rooms) {
    if (!visited.has(room.name)) {
      order.push(room);
    }
  }

  return order;
}
