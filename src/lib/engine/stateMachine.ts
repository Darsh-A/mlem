import type { CatState } from "../types";
import { CONFIG } from "../config";

interface Transition {
  target: CatState;
  weight: number;
}

interface StateConfig {
  transitions: Transition[];
  minDuration: number;
  maxDuration: number;
}

/** Build state configs, excluding walking transitions when position is fixed. */
function buildStateConfigs(): Record<CatState, StateConfig> {
  const fixed = CONFIG.position.fixed;

  return {
    idle: {
      transitions: fixed
        ? [{ target: "sitting", weight: 1 }]
        : [
            { target: "walking", weight: 3 },
            { target: "sitting", weight: 2 },
          ],
      minDuration: CONFIG.behavior.idleMinTime,
      maxDuration: CONFIG.behavior.idleMaxTime,
    },
    walking: {
      transitions: [
        { target: "idle", weight: 3 },
        { target: "sitting", weight: 2 },
      ],
      minDuration: CONFIG.behavior.walkMinTime,
      maxDuration: CONFIG.behavior.walkMaxTime,
    },
    sitting: {
      transitions: fixed
        ? [
            { target: "idle", weight: 3 },
            { target: "sleeping", weight: 1 },
          ]
        : [
            { target: "idle", weight: 3 },
            { target: "sleeping", weight: 1 },
            { target: "walking", weight: 1 },
          ],
      minDuration: CONFIG.behavior.sitMinTime,
      maxDuration: CONFIG.behavior.sitMaxTime,
    },
    sleeping: {
      transitions: [
        { target: "idle", weight: 3 },
        { target: "sitting", weight: 2 },
      ],
      minDuration: CONFIG.behavior.sleepMinTime,
      maxDuration: CONFIG.behavior.sleepMaxTime,
    },
    petted: {
      transitions: [{ target: "idle", weight: 1 }],
      minDuration: CONFIG.behavior.petDuration,
      maxDuration: CONFIG.behavior.petDuration,
    },
    dragged: {
      // Dragged has no auto-transitions; it ends via forceState()
      transitions: [],
      minDuration: 0,
      maxDuration: 0,
    },
  };
}

const STATE_CONFIGS = buildStateConfigs();

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Pick a random transition target weighted by the given weights. */
function weightedRandom(transitions: Transition[]): CatState | null {
  if (transitions.length === 0) return null;
  const totalWeight = transitions.reduce((sum, t) => sum + t.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const t of transitions) {
    roll -= t.weight;
    if (roll <= 0) return t.target;
  }
  return transitions[transitions.length - 1].target;
}

/**
 * Simple finite state machine for the cat's behavior.
 * Automatically transitions between states based on timers and weighted randomness.
 */
export class StateMachine {
  private _state: CatState = "idle";
  private timer = 0;
  private duration = 0;
  private onStateChange: (state: CatState) => void;

  constructor(onStateChange: (state: CatState) => void) {
    this.onStateChange = onStateChange;
    this.enterState("idle");
  }

  get state(): CatState {
    return this._state;
  }

  private enterState(state: CatState): void {
    this._state = state;
    this.timer = 0;
    const config = STATE_CONFIGS[state];
    this.duration = randomRange(config.minDuration, config.maxDuration);
    this.onStateChange(state);
  }

  /** Advance the state machine by dt milliseconds. */
  update(dt: number): void {
    // Dragged state is controlled externally
    if (this._state === "dragged") return;

    this.timer += dt;

    if (this.timer >= this.duration) {
      const config = STATE_CONFIGS[this._state];
      const nextState = weightedRandom(config.transitions);
      if (nextState) {
        this.enterState(nextState);
      }
    }
  }

  /** Force an immediate state transition (e.g. from user interaction). */
  forceState(state: CatState): void {
    this.enterState(state);
  }
}
