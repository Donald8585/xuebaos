import { lazy } from 'react';

/** Lazy-load the 3D Palace View to avoid bundling Three.js in the main bundle */
export const Palace3DView = lazy(() => import('./Palace3DViewContent'));
