<script lang="ts">
  import { CONFIG } from "../lib/config";

  let {
    text,
    scale = 3,
    canvasHeight = CONFIG.window.height,
  }: { text: string; scale?: number; canvasHeight?: number } = $props();

  // The cat sprite is bottom-aligned in the canvas.
  // Its top edge is (defaultSize * scale) px from the bottom.
  // Place the bubble a fixed 8px above the cat, independent of scale.
  const gap = 8;
  let bottomOffset = $derived(CONFIG.sprite.defaultSize * scale + gap);
</script>

<div
  class="speech-bubble"
  style="bottom: {bottomOffset}px;"
>
  <span>{text}</span>
</div>

<style>
  .speech-bubble {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    background: transparent;
    border: none;
    border-image-source: url('/sprites/container.png');
    border-image-slice: 8 fill;
    border-image-width: 10px;
    border-image-repeat: round;
    border-style: solid;
    border-width: 10px;
    image-rendering: pixelated;
    padding: 2px 6px;
    font-family: 'PressStart2P', monospace;
    font-size: 9px;
    color: #3b2a1a;
    white-space: nowrap;
    z-index: 10;
    pointer-events: none;
    animation: bubble-in 0.2s ease-out;
  }

  /* Speech tail pointing down, styled to match pixel container */
  .speech-bubble::after {
    content: "";
    position: absolute;
    bottom: -14px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid #3b2a1a;
    image-rendering: pixelated;
  }

  @keyframes bubble-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(5px) scale(0.8);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0) scale(1);
    }
  }
</style>
