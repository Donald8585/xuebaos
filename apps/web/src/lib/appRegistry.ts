/**
 * XueBaOS App Manifest System
 * Typed registry for all apps in the OS ecosystem.
 */

export interface AppManifest {
  id: string;
  name: string;
  icon: string; // lucide icon name
  version: string;
  permissions: string[];
  exports?: Record<string, string>;
  defaultWindow?: {
    width: number;
    height: number;
    minWidth?: number;
    minHeight?: number;
  };
}

const registry = new Map<string, AppManifest>();

/**
 * Register an app manifest. Must be called before the app can be opened.
 */
export function registerApp(manifest: AppManifest): void {
  if (registry.has(manifest.id)) {
    console.warn(`[appRegistry] App "${manifest.id}" already registered — overwriting`);
  }
  registry.set(manifest.id, { ...manifest });
}

/**
 * Get an app manifest by id. Returns undefined if not registered.
 */
export function getApp(id: string): AppManifest | undefined {
  return registry.get(id);
}

/**
 * Get all registered apps.
 */
export function listApps(): AppManifest[] {
  return Array.from(registry.values());
}

// ── Pre-registered apps ──────────────────────────────────────
registerApp({
  id: 'memory-palace',
  name: 'Memory Palace',
  icon: 'Building2',
  version: '2.0.0',
  permissions: ['palaces:read', 'palaces:write', 'videos:read', 'videos:upload'],
  defaultWindow: {
    width: 900,
    height: 640,
    minWidth: 600,
    minHeight: 400,
  },
});

registerApp({
  id: 'qbank',
  name: 'Question Bank',
  icon: 'HelpCircle',
  version: '1.0.0',
  permissions: ['questions:read', 'questions:write', 'reviews:read', 'reviews:write'],
  defaultWindow: {
    width: 800,
    height: 600,
    minWidth: 500,
    minHeight: 400,
  },
});

registerApp({
  id: 'recall-arena',
  name: 'Recall Arena',
  icon: 'Target',
  version: '1.0.0',
  permissions: ['recall:read', 'recall:write'],
  defaultWindow: {
    width: 800,
    height: 640,
    minWidth: 500,
    minHeight: 400,
  },
});

registerApp({
  id: 'symbol-forge',
  name: 'Symbol Forge',
  icon: 'Sparkles',
  version: '1.0.0',
  permissions: ['symbols:read', 'symbols:write'],
  defaultWindow: {
    width: 700,
    height: 560,
    minWidth: 480,
    minHeight: 360,
  },
});

export { registry };
