import type { Pool } from 'pg';
import type { NavigationSession, WalkingRoute } from '../domain/schemas.js';

export interface NavigationRepository {
  checkHealth(): Promise<void>;
  saveRoute(route: WalkingRoute): Promise<void>;
  getRoute(routeId: string): Promise<WalkingRoute | null>;
  createSession(session: NavigationSession): Promise<void>;
  getSession(sessionId: string): Promise<NavigationSession | null>;
  updateSession(
    sessionId: string,
    state: NavigationSession['state'],
    routeId?: string,
  ): Promise<NavigationSession | null>;
  deleteSession(sessionId: string): Promise<boolean>;
  saveFeedback(sessionId: string, category: string, comment?: string): Promise<void>;
}

export class MemoryNavigationRepository implements NavigationRepository {
  private readonly routes = new Map<string, WalkingRoute>();
  private readonly sessions = new Map<string, NavigationSession>();
  private readonly feedback: Array<{ sessionId: string; category: string; comment?: string }> = [];

  async checkHealth(): Promise<void> {}

  async saveRoute(route: WalkingRoute): Promise<void> {
    this.routes.set(route.routeId, route);
  }

  async getRoute(routeId: string): Promise<WalkingRoute | null> {
    return this.routes.get(routeId) ?? null;
  }

  async createSession(session: NavigationSession): Promise<void> {
    this.sessions.set(session.sessionId, session);
  }

  async getSession(sessionId: string): Promise<NavigationSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async updateSession(
    sessionId: string,
    state: NavigationSession['state'],
    routeId?: string,
  ): Promise<NavigationSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (routeId && !this.routes.has(routeId)) return null;
    const updated = { ...session, state, ...(routeId ? { routeId } : {}) };
    this.sessions.set(sessionId, updated);
    if (routeId && routeId !== session.routeId) {
      if (![...this.sessions.values()].some((candidate) => candidate.routeId === session.routeId)) {
        this.routes.delete(session.routeId);
      }
    }
    return updated;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    this.sessions.delete(sessionId);
    if (![...this.sessions.values()].some((candidate) => candidate.routeId === session.routeId)) {
      this.routes.delete(session.routeId);
    }
    for (let index = this.feedback.length - 1; index >= 0; index -= 1) {
      if (this.feedback[index]?.sessionId === sessionId) this.feedback.splice(index, 1);
    }
    return true;
  }

  async saveFeedback(sessionId: string, category: string, comment?: string): Promise<void> {
    if (!this.sessions.has(sessionId)) {
      throw new Error('Cannot save feedback for a missing session');
    }
    this.feedback.push({ sessionId, category, ...(comment === undefined ? {} : { comment }) });
  }
}

export class PostgresNavigationRepository implements NavigationRepository {
  constructor(private readonly pool: Pool) {}

  async checkHealth(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async saveRoute(route: WalkingRoute): Promise<void> {
    await this.pool.query(
      'INSERT INTO demo_routes (route_id, route_json) VALUES ($1, $2::jsonb)',
      [route.routeId, JSON.stringify(route)],
    );
  }

  async getRoute(routeId: string): Promise<WalkingRoute | null> {
    const result = await this.pool.query<{ route_json: WalkingRoute }>(
      'SELECT route_json FROM demo_routes WHERE route_id = $1',
      [routeId],
    );
    return result.rows[0]?.route_json ?? null;
  }

  async createSession(session: NavigationSession): Promise<void> {
    await this.pool.query(
      `INSERT INTO navigation_sessions (session_id, route_id, state)
       VALUES ($1, $2, $3)`,
      [session.sessionId, session.routeId, session.state],
    );
  }

  async getSession(sessionId: string): Promise<NavigationSession | null> {
    const result = await this.pool.query<NavigationSession>(
      `SELECT session_id AS "sessionId", route_id AS "routeId", state
       FROM navigation_sessions WHERE session_id = $1`,
      [sessionId],
    );
    return result.rows[0] ?? null;
  }

  async updateSession(
    sessionId: string,
    state: NavigationSession['state'],
    routeId?: string,
  ): Promise<NavigationSession | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query<{ route_id: string }>(
        'SELECT route_id FROM navigation_sessions WHERE session_id = $1 FOR UPDATE',
        [sessionId],
      );
      if (!existing.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      if (routeId && routeId !== existing.rows[0].route_id) {
        const route = await client.query('SELECT 1 FROM demo_routes WHERE route_id = $1', [routeId]);
        if (route.rowCount !== 1) {
          await client.query('ROLLBACK');
          return null;
        }
      }
      const result = await client.query<NavigationSession>(
        `UPDATE navigation_sessions
         SET state = $2, route_id = COALESCE($3, route_id), updated_at = now()
         WHERE session_id = $1
         RETURNING session_id AS "sessionId", route_id AS "routeId", state`,
        [sessionId, state, routeId ?? null],
      );
      if (routeId && routeId !== existing.rows[0].route_id) {
        await client.query(
          `DELETE FROM demo_routes
           WHERE route_id = $1
             AND NOT EXISTS (
               SELECT 1 FROM navigation_sessions WHERE route_id = $1
             )`,
          [existing.rows[0].route_id],
        );
      }
      await client.query('COMMIT');
      return result.rows[0] ?? null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query<{ route_id: string }>(
        'SELECT route_id FROM navigation_sessions WHERE session_id = $1 FOR UPDATE',
        [sessionId],
      );
      if (!existing.rows[0]) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query('DELETE FROM navigation_sessions WHERE session_id = $1', [sessionId]);
      await client.query(
        `DELETE FROM demo_routes
         WHERE route_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM navigation_sessions WHERE route_id = $1
           )`,
        [existing.rows[0].route_id],
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async saveFeedback(sessionId: string, category: string, comment?: string): Promise<void> {
    const result = await this.pool.query(
      `INSERT INTO navigation_feedback (feedback_id, session_id, category, comment)
       SELECT gen_random_uuid(), $1, $2, $3
       WHERE EXISTS (
         SELECT 1 FROM navigation_sessions WHERE session_id = $1
       )`,
      [sessionId, category, comment ?? null],
    );
    if (result.rowCount !== 1) {
      throw new Error('Cannot save feedback for a missing session');
    }
  }
}
