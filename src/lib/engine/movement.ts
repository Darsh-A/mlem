import type { Position } from "../types";
import { CONFIG } from "../config";

/**
 * Handles the cat's position and movement on screen.
 * In fixed mode, the cat stays at its anchor position and does not roam.
 * In roaming mode, the cat walks along the bottom edge between random destinations.
 */
export class MovementEngine {
  private _position: Position;
  private targetX: number;
  private _isMoving = false;
  private _direction: 1 | -1 = 1; // 1 = right, -1 = left
  private screenWidth: number;
  private screenHeight: number;
  private windowWidth: number;
  private windowHeight: number;

  constructor(
    screenWidth: number,
    screenHeight: number,
    windowWidth: number,
    windowHeight: number,
  ) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.windowWidth = windowWidth;
    this.windowHeight = windowHeight;

    this._position = this.getAnchorPosition();
    this.targetX = this._position.x;
  }

  /** Calculate the position for the configured anchor point. */
  private getAnchorPosition(): Position {
    const anchor = CONFIG.position.defaultAnchor;
    const margin = CONFIG.position.edgeMargin;
    const y =
      this.screenHeight -
      this.windowHeight -
      CONFIG.movement.taskbarOffset;

    let x: number;
    switch (anchor) {
      case "bottom-right":
        x = this.screenWidth - this.windowWidth - margin;
        break;
      case "bottom-left":
        x = margin;
        break;
      case "bottom-center":
      default:
        x = (this.screenWidth - this.windowWidth) / 2;
        break;
    }

    return { x, y };
  }

  /** Current position (logical screen coordinates). */
  get position(): Position {
    return { ...this._position };
  }

  /** Current walking direction: 1 = right, -1 = left. */
  get direction(): 1 | -1 {
    return this._direction;
  }

  /** Whether the cat is currently moving. */
  get isMoving(): boolean {
    return this._isMoving;
  }

  /** Begin walking to a random destination. No-op when position is fixed. */
  startWalking(): void {
    if (CONFIG.position.fixed) return;

    this._isMoving = true;
    const margin = 50;
    this.targetX =
      margin +
      Math.random() * (this.screenWidth - this.windowWidth - margin * 2);
    this._direction = this.targetX > this._position.x ? 1 : -1;
  }

  /** Stop moving. */
  stop(): void {
    this._isMoving = false;
  }

  /** Directly set the cat's position (used after drag). */
  setPosition(pos: Position): void {
    this._position = { ...pos };
  }

  /** Reset position to the configured anchor point. */
  resetPosition(): void {
    this._position = this.getAnchorPosition();
  }

  /** Update screen bounds (e.g. on monitor change). */
  updateScreenBounds(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    this._position.y =
      height - this.windowHeight - CONFIG.movement.taskbarOffset;
    this._position.x = Math.max(
      0,
      Math.min(this._position.x, width - this.windowWidth),
    );
  }

  /** Advance movement by dt milliseconds. No-op when position is fixed. */
  update(dt: number): void {
    if (!this._isMoving || CONFIG.position.fixed) return;

    const speed = CONFIG.movement.walkSpeed;
    const dx = speed * this._direction * (dt / 1000);

    this._position.x += dx;

    // Check if we've reached or passed the target
    if (
      (this._direction === 1 && this._position.x >= this.targetX) ||
      (this._direction === -1 && this._position.x <= this.targetX)
    ) {
      this._position.x = this.targetX;
      this._isMoving = false;
    }

    // Clamp to screen bounds
    this._position.x = Math.max(
      0,
      Math.min(this._position.x, this.screenWidth - this.windowWidth),
    );
  }
}
