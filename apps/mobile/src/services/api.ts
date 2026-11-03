import { Platform } from 'react-native';
import type {
  Coordinate,
  LocalizationEstimate,
  WalkingRoute,
} from '../domain/navigation';

const apiUrl =
  process.env.EXPO_PUBLIC_API_URL
  ?? (__DEV__
    ? Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000'
    : '');

if (!apiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL must be configured for a non-development build.');
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    headers.set('x-device-id', 'mobile-anonymous-local');
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers,
    });
    if (!response.ok) {
      const problem = await response.json().catch(() => null) as {
        detail?: string;
        title?: string;
      } | null;
      throw new Error(problem?.detail ?? problem?.title ?? `Navigation API returned ${response.status}.`);
    }
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

export interface PlaceCandidate {
  providerPlaceId: string;
  displayName: string;
  formattedAddress: string;
  location: Coordinate;
  attribution: string;
}

export interface NavigationSession {
  sessionId: string;
  routeId: string;
  state: 'active' | 'paused';
}

export const api = {
  async searchPlaces(query: string, near: Coordinate): Promise<PlaceCandidate[]> {
    const response = await request<{ mode: 'SIMULATED'; results: PlaceCandidate[] }>(
      '/v1/places/search',
      { method: 'POST', body: JSON.stringify({ query, near }) },
    );
    if (response.mode !== 'SIMULATED') {
      throw new Error('The local demo provider returned an unexpected mode.');
    }
    return response.results;
  },

  createRoute(origin: Coordinate, destination: Coordinate): Promise<WalkingRoute> {
    return request('/v1/routes/walking', {
      method: 'POST',
      headers: { 'idempotency-key': `route-${Date.now()}-${Math.random().toString(16).slice(2)}` },
      body: JSON.stringify({ origin, destination, language: 'en' }),
    });
  },

  createSession(routeId: string): Promise<NavigationSession> {
    return request('/v1/sessions', {
      method: 'POST',
      body: JSON.stringify({ routeId, visualConsent: false }),
    });
  },

  updateSession(
    sessionId: string,
    state: 'active' | 'paused',
    routeId?: string,
  ): Promise<NavigationSession> {
    return request(`/v1/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ state, ...(routeId ? { routeId } : {}) }),
    });
  },

  endSession(sessionId: string): Promise<void> {
    return request(`/v1/sessions/${sessionId}`, { method: 'DELETE' });
  },

  localize(
    sessionId: string,
    location: Coordinate,
    accuracy: number,
    heading?: number,
  ): Promise<LocalizationEstimate> {
    return request('/v1/localize', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        location,
        horizontalAccuracyMeters: accuracy,
        ...(heading === undefined ? {} : { headingDegrees: heading }),
        visualConsent: false,
        capturedAt: new Date().toISOString(),
      }),
    });
  },
};
