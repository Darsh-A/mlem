/**
 * Game configuration.
 * Tweak these values to adjust the cat's behavior, appearance, and animations.
 */
export const CONFIG = {
  /** Window dimensions (should match tauri.conf.json) */
  window: {
    width: 200,
    height: 200,
  },

  /** Sprite rendering settings */
  sprite: {
    /** Scale multiplier for pixel art (e.g. 3 = 32px sprite -> 96px on screen) */
    scale: 3,
    /** Default sprite frame size when no sprite sheet is loaded */
    defaultSize: 32,
  },

  /** Position settings */
  position: {
    /** When true, the cat stays in place and does not roam */
    fixed: true,
    /** Default anchor point: "bottom-right", "bottom-left", "bottom-center" */
    defaultAnchor: "bottom-right" as
      | "bottom-right"
      | "bottom-left"
      | "bottom-center",
    /** Margin from screen edge in pixels */
    edgeMargin: 20,
  },

  /** Movement settings (only used when position.fixed is false) */
  movement: {
    /** Walking speed in logical pixels per second */
    walkSpeed: 30,
    /** Offset from screen bottom edge (to sit above taskbar) */
    taskbarOffset: 48,
  },

  /** Behavior timers (in milliseconds) */
  behavior: {
    idleMinTime: 3000,
    idleMaxTime: 8000,
    walkMinTime: 2000,
    walkMaxTime: 6000,
    sitMinTime: 4000,
    sitMaxTime: 10000,
    sleepMinTime: 8000,
    sleepMaxTime: 20000,
    petDuration: 2000,
    /** Minimum time between random speech bubbles */
    bubbleMinInterval: 15000,
    /** How long a speech bubble stays visible */
    bubbleDuration: 3000,
  },

  /** Random messages the cat can say */
  bubbleMessages: [
    "mlem",
    "meow!",
    "zzz...",
    "*purr*",
    ":3",
    "nya~",
    "*stretch*",
    "...",
    "*yawn*",
    "mrrp?",
  ],

  /**
   * Maps each cat state to a sprite sheet filename (without extension).
   * Place matching .png + .json files in public/sprites/
   * States without unique sprites reuse petha_default as placeholder.
   */
  animations: {
    idle: "petha_sit", // placeholder until petha_default is exported
    walking: "petha_sit", // placeholder until petha_walk is created
    sitting: "petha_sit",
    sleeping: "petha_sleep",
    petted: "petha_sit", // placeholder until petha_petted is created
    // Use the dedicated drag sprite sheet (petha_dra.png / petha_dra.json)
    dragged: "petha_dra",
  } as Record<string, string>,
};
