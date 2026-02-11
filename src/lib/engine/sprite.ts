import type { AnimationData, SpriteFrame, RenderFrame } from "../types";
import { CONFIG } from "../config";

/**
 * Aseprite JSON sprite sheet format (array variant).
 * This is what Aseprite exports with: File -> Export Sprite Sheet -> JSON Data (Array).
 */
interface AsepriteJSON {
  frames: Array<{
    filename: string;
    frame: { x: number; y: number; w: number; h: number };
    duration: number;
  }>;
  meta: {
    size: { w: number; h: number };
    image: string;
  };
}

/** Load an image from a URL, returning a promise. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Generate a placeholder animation with a simple drawn cat silhouette.
 * Used when real sprite sheets aren't available yet.
 */
function createPlaceholderAnimation(name: string): AnimationData {
  const size = CONFIG.sprite.defaultSize;
  const frameCount = 2; // 2 frames for a subtle idle animation
  const canvas = document.createElement("canvas");
  canvas.width = size * frameCount;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Different colors for different placeholder animations
  const colors: Record<string, string> = {
    petha_default: "#FFB6C1",
    petha_sit: "#98FB98",
    petha_sleep: "#DDA0DD",
  };
  const color = colors[name] || "#FFB6C1";

  for (let i = 0; i < frameCount; i++) {
    const ox = i * size;
    const s = size;
    const bounce = i * 1; // subtle bounce between frames

    // Body (round shape)
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(
      ox + s * 0.5,
      s * 0.6 - bounce,
      s * 0.3,
      s * 0.28,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(ox + s * 0.5, s * 0.35 - bounce, s * 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Ears (triangles)
    ctx.beginPath();
    ctx.moveTo(ox + s * 0.32, s * 0.28 - bounce);
    ctx.lineTo(ox + s * 0.28, s * 0.08 - bounce);
    ctx.lineTo(ox + s * 0.45, s * 0.22 - bounce);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ox + s * 0.68, s * 0.28 - bounce);
    ctx.lineTo(ox + s * 0.72, s * 0.08 - bounce);
    ctx.lineTo(ox + s * 0.55, s * 0.22 - bounce);
    ctx.fill();

    // Eyes
    ctx.fillStyle = "#333";
    ctx.fillRect(
      Math.round(ox + s * 0.4),
      Math.round(s * 0.32 - bounce),
      2,
      2,
    );
    ctx.fillRect(
      Math.round(ox + s * 0.56),
      Math.round(s * 0.32 - bounce),
      2,
      2,
    );

    // Tail
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ox + s * 0.78, s * 0.55 - bounce);
    ctx.quadraticCurveTo(
      ox + s * 0.95,
      s * 0.35 - bounce,
      ox + s * 0.85,
      s * 0.25 - bounce,
    );
    ctx.stroke();
  }

  const image = new Image();
  image.src = canvas.toDataURL();

  const frames: SpriteFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    frames.push({
      x: i * size,
      y: 0,
      w: size,
      h: size,
      duration: 500,
    });
  }

  return { image, frames };
}

/**
 * Manages loading, switching, and animating sprite sheets.
 */
export class SpriteManager {
  private animations: Map<string, AnimationData> = new Map();
  private currentAnimation = "";
  private currentFrameIndex = 0;
  private elapsed = 0;
  private _flipX = false;

  /** Load all sprite sheets defined in CONFIG.animations. */
  async loadAll(): Promise<void> {
    // Get unique sprite sheet names
    const animNames = new Set(Object.values(CONFIG.animations));

    for (const name of animNames) {
      try {
        // Strategy 1: Try loading Aseprite-exported JSON + PNG sprite sheet
        const jsonResponse = await fetch(`/sprites/${name}.json`);
        if (!jsonResponse.ok) throw new Error("JSON not found");

        const json: AsepriteJSON = await jsonResponse.json();
        const image = await loadImage(`/sprites/${name}.png`);

        const frames: SpriteFrame[] = json.frames.map((f) => ({
          x: f.frame.x,
          y: f.frame.y,
          w: f.frame.w,
          h: f.frame.h,
          duration: f.duration,
        }));

        this.animations.set(name, { image, frames });
        console.log(`Loaded sprite sheet: ${name} (${frames.length} frames)`);
      } catch {
        // Strategy 2: Try loading individual frame PNGs (name1.png, name2.png, ...)
        const loaded = await this.tryLoadIndividualFrames(name);
        if (!loaded) {
          // Strategy 3: Try loading a single PNG as a one-frame animation
          const singleLoaded = await this.tryLoadSingleImage(name);
          if (!singleLoaded) {
            console.warn(
              `Could not load sprite "${name}", using placeholder. ` +
                `Place ${name}.png + ${name}.json in public/sprites/, ` +
                `or individual frames as ${name}1.png, ${name}2.png, etc.`,
            );
            this.animations.set(name, createPlaceholderAnimation(name));
          }
        }
      }
    }

    this.setAnimation("idle");
  }

  /**
   * Try to load individual frame PNGs: name1.png, name2.png, ...
   * Stitches them into a virtual sprite sheet in memory.
   * Returns true if at least one frame was loaded.
   */
  private async tryLoadIndividualFrames(name: string): Promise<boolean> {
    const frameImages: HTMLImageElement[] = [];

    // Try loading frames 1, 2, 3, ... up to 20
    for (let i = 1; i <= 20; i++) {
      try {
        const img = await loadImage(`/sprites/${name}${i}.png`);
        frameImages.push(img);
      } catch {
        break; // Stop at first missing frame
      }
    }

    if (frameImages.length === 0) return false;

    // Stitch frames into a horizontal sprite sheet in memory
    const frameW = frameImages[0].naturalWidth;
    const frameH = frameImages[0].naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = frameW * frameImages.length;
    canvas.height = frameH;
    const ctx = canvas.getContext("2d")!;

    for (let i = 0; i < frameImages.length; i++) {
      ctx.drawImage(frameImages[i], i * frameW, 0);
    }

    const sheetImage = new Image();
    sheetImage.src = canvas.toDataURL();

    // Wait for the data URL image to be ready
    await new Promise<void>((resolve) => {
      if (sheetImage.complete) resolve();
      else sheetImage.onload = () => resolve();
    });

    const frames: SpriteFrame[] = frameImages.map((_, i) => ({
      x: i * frameW,
      y: 0,
      w: frameW,
      h: frameH,
      duration: 500, // default 500ms per frame
    }));

    this.animations.set(name, { image: sheetImage, frames });
    console.log(
      `Loaded individual frames: ${name} (${frameImages.length} frames of ${frameW}x${frameH})`,
    );
    return true;
  }

  /**
   * Try to load a single PNG as a one-frame animation.
   * Returns true if the image was loaded successfully.
   */
  private async tryLoadSingleImage(name: string): Promise<boolean> {
    try {
      const img = await loadImage(`/sprites/${name}.png`);
      const frames: SpriteFrame[] = [
        {
          x: 0,
          y: 0,
          w: img.naturalWidth,
          h: img.naturalHeight,
          duration: 500,
        },
      ];
      this.animations.set(name, { image: img, frames });
      console.log(
        `Loaded single image: ${name} (${img.naturalWidth}x${img.naturalHeight})`,
      );
      return true;
    } catch {
      return false;
    }
  }

  /** Switch to the animation for the given cat state. */
  setAnimation(state: string): void {
    const animName = CONFIG.animations[state] || CONFIG.animations.idle;
    if (animName !== this.currentAnimation) {
      this.currentAnimation = animName;
      this.currentFrameIndex = 0;
      this.elapsed = 0;
    }
  }

  /** Set horizontal flip (for walking left). */
  setFlipX(flip: boolean): void {
    this._flipX = flip;
  }

  /** Advance the animation by dt milliseconds. */
  update(dt: number): void {
    const anim = this.animations.get(this.currentAnimation);
    if (!anim || anim.frames.length === 0) return;

    this.elapsed += dt;
    const frame = anim.frames[this.currentFrameIndex];

    if (this.elapsed >= frame.duration) {
      this.elapsed -= frame.duration;
      this.currentFrameIndex =
        (this.currentFrameIndex + 1) % anim.frames.length;
    }
  }

  /** Get the current frame data for rendering. Returns null if no animation is loaded. */
  getCurrentFrame(): RenderFrame | null {
    const anim = this.animations.get(this.currentAnimation);
    if (!anim || anim.frames.length === 0) return null;

    const frame = anim.frames[this.currentFrameIndex];
    return {
      image: anim.image,
      sx: frame.x,
      sy: frame.y,
      sw: frame.w,
      sh: frame.h,
      flipX: this._flipX,
    };
  }

  /** Get the base frame dimensions of the current animation. */
  getFrameSize(): { w: number; h: number } {
    const anim = this.animations.get(this.currentAnimation);
    if (!anim || anim.frames.length === 0) {
      return {
        w: CONFIG.sprite.defaultSize,
        h: CONFIG.sprite.defaultSize,
      };
    }
    return { w: anim.frames[0].w, h: anim.frames[0].h };
  }
}
