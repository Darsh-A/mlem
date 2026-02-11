/** All possible states the cat can be in */
export type CatState =
  | "idle"
  | "walking"
  | "sitting"
  | "sleeping"
  | "petted"
  | "dragged";

/** Screen position in logical pixels */
export interface Position {
  x: number;
  y: number;
}

/** A single frame within a sprite sheet */
export interface SpriteFrame {
  /** Source X in sprite sheet */
  x: number;
  /** Source Y in sprite sheet */
  y: number;
  /** Frame width */
  w: number;
  /** Frame height */
  h: number;
  /** Frame duration in ms */
  duration: number;
}

/** A loaded animation: sprite sheet image + frame data */
export interface AnimationData {
  image: HTMLImageElement;
  frames: SpriteFrame[];
}

/** Data needed to render the current frame */
export interface RenderFrame {
  image: HTMLImageElement;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  flipX: boolean;
}
