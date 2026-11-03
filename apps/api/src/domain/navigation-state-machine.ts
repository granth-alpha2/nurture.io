import type { NavigationState } from './schemas.js';

export type NavigationEvent =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'CANCEL' }
  | { type: 'POSITION_UPDATE'; requiresRelocalization: boolean; consecutiveOffRouteCount: number; remainingMeters: number }
  | { type: 'REROUTE_SUCCESS'; newRouteId: string }
  | { type: 'ARRIVED' };

export interface StateMachineResult {
  currentState: NavigationState;
  previousState: NavigationState;
  actionRequired?: 'NONE' | 'RELOCALIZE_UI' | 'TRIGGER_REROUTE' | 'ANNOUNCE_ARRIVAL' | 'AUDIO_CROSSING' | undefined;
  ttsAnnouncement?: string | undefined;
}

export class NavigationStateMachine {
  private state: NavigationState;

  constructor(initialState: NavigationState = 'idle') {
    this.state = initialState;
  }

  public getState(): NavigationState {
    return this.state;
  }

  public transition(event: NavigationEvent): StateMachineResult {
    const prev = this.state;
    let action: StateMachineResult['actionRequired'] = 'NONE';
    let announcement: string | undefined;

    switch (this.state) {
      case 'idle':
        if (event.type === 'START') {
          this.state = 'active';
          announcement = 'Navigation started. Follow spoken instructions.';
        }
        break;

      case 'active':
        if (event.type === 'PAUSE') {
          this.state = 'paused';
          announcement = 'Navigation paused.';
        } else if (event.type === 'CANCEL') {
          this.state = 'idle';
          announcement = 'Navigation cancelled.';
        } else if (event.type === 'ARRIVED') {
          this.state = 'arrived';
          action = 'ANNOUNCE_ARRIVAL';
          announcement = 'You have arrived at your destination.';
        } else if (event.type === 'POSITION_UPDATE') {
          if (event.consecutiveOffRouteCount >= 2) {
            this.state = 'rerouting';
            action = 'TRIGGER_REROUTE';
            announcement = 'Off route detected. Recalculating walking route.';
          } else if (event.requiresRelocalization) {
            this.state = 'relocalizing';
            action = 'RELOCALIZE_UI';
            announcement = 'Signal degraded. Walk forward and point phone at street signs.';
          } else if (event.remainingMeters <= 15) {
            this.state = 'arrived';
            action = 'ANNOUNCE_ARRIVAL';
            announcement = 'You have arrived at your destination.';
          }
        }
        break;

      case 'relocalizing':
        if (event.type === 'PAUSE') {
          this.state = 'paused';
        } else if (event.type === 'CANCEL') {
          this.state = 'idle';
        } else if (event.type === 'POSITION_UPDATE') {
          if (event.consecutiveOffRouteCount >= 2) {
            this.state = 'rerouting';
            action = 'TRIGGER_REROUTE';
            announcement = 'Off route. Recalculating walking route.';
          } else if (!event.requiresRelocalization) {
            this.state = 'active';
            announcement = 'Position restored. Continuing navigation.';
          }
        }
        break;

      case 'rerouting':
        if (event.type === 'CANCEL') {
          this.state = 'idle';
        } else if (event.type === 'REROUTE_SUCCESS') {
          this.state = 'active';
          announcement = 'New walking route ready. Follow the updated guidance.';
        }
        break;

      case 'paused':
        if (event.type === 'RESUME') {
          this.state = 'active';
          announcement = 'Navigation resumed.';
        } else if (event.type === 'CANCEL') {
          this.state = 'idle';
        }
        break;

      case 'arrived':
        if (event.type === 'CANCEL' || event.type === 'START') {
          this.state = 'idle';
        }
        break;
    }

    return {
      currentState: this.state,
      previousState: prev,
      actionRequired: action,
      ttsAnnouncement: announcement,
    };
  }
}
