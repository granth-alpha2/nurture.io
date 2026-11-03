import { z } from 'zod';

export const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
}).strict();

export type Coordinate = z.infer<typeof coordinateSchema>;

export const placeSearchSchema = z.object({
  query: z.string().trim().min(1).max(256),
  sessionToken: z.string().max(128).optional(),
  near: coordinateSchema.optional(),
}).strict();

export const walkingRouteSchema = z.object({
  origin: coordinateSchema,
  destination: coordinateSchema,
  language: z.string().max(16).default('en'),
}).strict();

export const createSessionSchema = z.object({
  routeId: z.string().uuid(),
  visualConsent: z.boolean().default(false),
}).strict();

export const navigationStateSchema = z.enum([
  'idle',
  'active',
  'paused',
  'relocalizing',
  'rerouting',
  'arrived',
]);

export type NavigationState = z.infer<typeof navigationStateSchema>;

export const updateSessionSchema = z.object({
  state: z.enum(['active', 'paused', 'relocalizing', 'rerouting', 'arrived']),
  routeId: z.string().uuid().optional(),
}).strict();

export const visualFeatureInputSchema = z.object({
  matched: z.boolean().default(false),
  landmarkName: z.string().nullable().optional(),
  landmarkLocation: coordinateSchema.nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
  distanceMeters: z.number().min(0).nullable().optional(),
  blurScore: z.number().optional(),
  ocrTokens: z.array(z.string()).optional(),
  isSimulated: z.boolean().optional(),
}).strict();

export type VisualFeatureInput = z.infer<typeof visualFeatureInputSchema>;

export const localizationSchema = z.object({
  sessionId: z.string().uuid(),
  location: coordinateSchema,
  horizontalAccuracyMeters: z.number().min(0).max(100_000),
  headingDegrees: z.number().min(0).max(360).optional(),
  routeStepSequence: z.number().int().min(0).optional(),
  visualConsent: z.boolean().default(false),
  visualMatch: visualFeatureInputSchema.optional(),
  capturedAt: z.string().datetime({ offset: true }),
}).strict();

export type LocalizationInput = z.infer<typeof localizationSchema>;

export const feedbackSchema = z.object({
  sessionId: z.string().uuid(),
  category: z.enum(['wrong_instruction', 'confusing', 'accessibility', 'other']),
  comment: z.string().trim().max(1000).optional(),
}).strict();

export interface LandmarkReference {
  landmarkId: string;
  name: string;
  location: Coordinate;
  distanceAlongStepMeters?: number;
  description?: string;
}

export interface RouteStep {
  sequence: number;
  instruction: string;
  maneuver: string;
  distanceMeters: number;
  crossing: boolean;
  landmarks?: LandmarkReference[];
}

export interface WalkingRoute {
  routeId: string;
  mode: 'SIMULATED';
  distanceMeters: number;
  durationSeconds: number;
  path: Coordinate[];
  steps: RouteStep[];
  warning: string;
}

export interface NavigationSession {
  sessionId: string;
  routeId: string;
  state: NavigationState;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  requestId: string;
}

export interface EvidenceItem {
  type: 'gps' | 'route' | 'vision' | 'heading' | 'relocalization_trigger' | string;
  validated: boolean;
  source: string;
  score?: number;
  reason?: string;
  value?: number;
}

export interface LocalizationEstimate {
  landmark_name: string | null;
  match_confidence: number;
  location_confirmed: boolean;
  distance_to_landmark_meters: number | null;
  next_instruction: string | null;
  next_maneuver: string | null;
  distance_to_next_maneuver_meters: number | null;
  requires_relocalization: boolean;
  evidence: EvidenceItem[];
  model_version: string;
  mode: 'GPS_ONLY' | 'VISUAL_FUSED' | 'SIMULATED';
}
