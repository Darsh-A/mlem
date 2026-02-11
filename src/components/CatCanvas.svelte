<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { SpriteManager } from "../lib/engine/sprite";
  import { StateMachine } from "../lib/engine/stateMachine";
  import { MovementEngine } from "../lib/engine/movement";
  import { CONFIG } from "../lib/config";
  import type { CatState } from "../lib/types";
  import SpeechBubble from "./SpeechBubble.svelte";
  import ContextMenu from "./ContextMenu.svelte";
  import SettingsPanel from "./SettingsPanel.svelte";

  // These are set inside onMount once Tauri runtime is available
  let appWindow: Awaited<
    ReturnType<typeof import("@tauri-apps/api/window").getCurrentWindow>
  >;
  let LogicalPosition: typeof import("@tauri-apps/api/dpi").LogicalPosition;
  let LogicalSize: typeof import("@tauri-apps/api/dpi").LogicalSize;
  let getMonitor: typeof import("@tauri-apps/api/window").currentMonitor;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let spriteManager: SpriteManager;
  let stateMachine: StateMachine;
  let movement: MovementEngine;
  let animFrameId: number;
  let unlistenReset: (() => void) | null = null;
  let bubbleTimer: ReturnType<typeof setTimeout>;

  // Reactive UI state (Svelte 5 runes)
  let showBubble = $state(false);
  let bubbleText = $state("");
  let showMenu = $state(false);
  let menuX = $state(0);
  let menuY = $state(0);
  let ready = $state(false);
  let showSettings = $state(false);
  let userScale = $state(CONFIG.sprite.scale);
  let canvasWidth = $state(CONFIG.window.width);
  let canvasHeight = $state(CONFIG.window.height);

  // Sleep/wake indicator state
  let showZzz = $state(false);
  let showExclamation = $state(false);
  let showQuestion = $state(false);
  let prevState: CatState = "idle";

  // Audio
  function playSound(src: string) {
    const audio = new Audio(src);
    audio.play().catch(() => {});
  }

  // Drag detection state
  let mouseDownTime = 0;
  let mouseDownPos = { x: 0, y: 0 };
  let isDragging = false;

  // Manual drag state (replaces startDragging which is unreliable on Wayland/Hyprland)
  let dragWindowStartX = 0;
  let dragWindowStartY = 0;
  let dragMouseStartX = 0;
  let dragMouseStartY = 0;

  // Track last window position to avoid unnecessary IPC calls
  let lastSetPos = { x: -1, y: -1 };

  onMount(async () => {
    // Dynamically import Tauri APIs so they only resolve inside the Tauri webview
    try {
      // Wait for Tauri runtime

      // Wait for Tauri internals to be injected (may take a moment on some platforms)
      const maxWait = 5000;
      const start = Date.now();
      while (!(window as any).__TAURI_INTERNALS__) {
        if (Date.now() - start > maxWait) {
          throw new Error(
            "Tauri runtime not available. Are you running inside 'npx tauri dev'?",
          );
        }
        await new Promise((r) => setTimeout(r, 100));
      }

      const windowModule = await import("@tauri-apps/api/window");
      const dpiModule = await import("@tauri-apps/api/dpi");
      const eventModule = await import("@tauri-apps/api/event");

      appWindow = windowModule.getCurrentWindow();
      LogicalPosition = dpiModule.LogicalPosition;
      LogicalSize = dpiModule.LogicalSize;

      // Store standalone monitor function (it's not a method on Window in Tauri v2)
      getMonitor = windowModule.currentMonitor;

      ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;

      // Load sprites

      // Load sprite sheets (or placeholders)
      spriteManager = new SpriteManager();
      await spriteManager.loadAll();

      // Get usable screen area (excludes taskbar on Windows)
      const invokeModule = await import("@tauri-apps/api/core");
      const [_wx, _wy, workWidth, workHeight] =
        await invokeModule.invoke<[number, number, number, number]>("get_work_area");
      const screenWidth = workWidth;
      const screenHeight = workHeight;

      // Initialize movement engine
      movement = new MovementEngine(
        screenWidth,
        screenHeight,
        CONFIG.window.width,
        CONFIG.window.height,
      );

      // Initialize state machine
      stateMachine = new StateMachine(onStateChange);

      // Set initial window position
      const startPos = movement.position;
      await appWindow.setPosition(
        new LogicalPosition(Math.round(startPos.x), Math.round(startPos.y)),
      );

      // Listen for tray "Reset Position" event
      unlistenReset = await eventModule.listen(
        "tray-reset-position",
        () => {
          movement.resetPosition();
          stateMachine.forceState("idle");
        },
      );

      ready = true;

      // Start the game loop
      let lastTime = performance.now();
      function gameLoop(time: number) {
        const dt = Math.min(time - lastTime, 100); // cap delta to avoid jumps
        lastTime = time;

        // Update game systems
        stateMachine.update(dt);

        if (stateMachine.state === "walking") {
          movement.update(dt);
          spriteManager.setFlipX(movement.direction === -1);
        }

        spriteManager.update(dt);

        // Move window only if position changed and not dragging
        if (stateMachine.state !== "dragged") {
          const pos = movement.position;
          const rx = Math.round(pos.x);
          const ry = Math.round(pos.y);
          if (rx !== lastSetPos.x || ry !== lastSetPos.y) {
            appWindow.setPosition(new LogicalPosition(rx, ry));
            lastSetPos = { x: rx, y: ry };
          }
        }

        // Render the current frame
        render();
        animFrameId = requestAnimationFrame(gameLoop);
      }

      animFrameId = requestAnimationFrame(gameLoop);

      // Start random speech bubbles
      scheduleBubble();
    } catch (err) {
      console.error("Failed to initialize Tauri:", err);
    }
  });

  onDestroy(() => {
    if (animFrameId) cancelAnimationFrame(animFrameId);
    if (unlistenReset) unlistenReset();
    if (bubbleTimer) clearTimeout(bubbleTimer);
    window.removeEventListener("mousemove", handleGlobalDragMove);
    window.removeEventListener("mouseup", handleGlobalDragEnd);
  });

  /** Called when the state machine transitions to a new state. */
  function onStateChange(state: CatState) {
    spriteManager?.setAnimation(state);

    // Sleep indicator
    if (state === "sleeping") {
      showZzz = true;
    } else {
      showZzz = false;
    }

    // Wake-up exclamation (only when leaving sleep, but not when dragged)
    if (prevState === "sleeping" && state !== "sleeping" && state !== "dragged") {
      playSound('/audio/meow_short.wav');
      showExclamation = true;
      setTimeout(() => {
        showExclamation = false;
      }, 1000);
    }

    // Drag question mark
    if (state === "dragged") {
      showQuestion = true;
    } else {
      showQuestion = false;
    }

    prevState = state;

    if (state === "walking") {
      movement?.startWalking();
    } else {
      movement?.stop();
    }
  }

  /** Render the cat sprite on the canvas. */
  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const frame = spriteManager.getCurrentFrame();
    if (!frame) return;

    const scale = userScale;
    const dw = frame.sw * scale;
    const dh = frame.sh * scale;
    const dx = (canvas.width - dw) / 2;
    // Align the cat sprite to the bottom of the canvas so its feet
    // sit flush with the window's bottom edge (= just above the taskbar).
    const dy = canvas.height - dh;

    ctx.save();
    if (frame.flipX) {
      // Flip horizontally for walking left
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(
        frame.image,
        frame.sx,
        frame.sy,
        frame.sw,
        frame.sh,
        0,
        0,
        dw,
        dh,
      );
    } else {
      ctx.drawImage(
        frame.image,
        frame.sx,
        frame.sy,
        frame.sw,
        frame.sh,
        dx,
        dy,
        dw,
        dh,
      );
    }
    ctx.restore();
  }

  /** Schedule a random speech bubble to appear. */
  function scheduleBubble() {
    const delay =
      CONFIG.behavior.bubbleMinInterval + Math.random() * 20000;
    bubbleTimer = setTimeout(() => {
      if (stateMachine && stateMachine.state !== "dragged") {
        const messages = CONFIG.bubbleMessages;
        bubbleText = messages[Math.floor(Math.random() * messages.length)];
        showBubble = true;
        setTimeout(() => {
          showBubble = false;
        }, CONFIG.behavior.bubbleDuration);
      }
      scheduleBubble();
    }, delay);
  }

  // ── Hit testing ──

  /**
   * Check if the mouse event is over an opaque pixel of the cat sprite.
   * Converts the CSS-space mouse coordinates to canvas pixel coordinates,
   * then checks the alpha channel at that point.
   */
  function isClickOnCat(e: MouseEvent): boolean {
    if (!ctx || !canvas) return false;

    // The canvas element is stretched via CSS (width/height: 100%).
    // We need to map CSS coordinates to the canvas's internal pixel grid.
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = Math.floor((e.clientX - rect.left) * scaleX);
    const cy = Math.floor((e.clientY - rect.top) * scaleY);

    // Bounds check
    if (cx < 0 || cy < 0 || cx >= canvas.width || cy >= canvas.height) {
      return false;
    }

    // Read the alpha value of the pixel under the cursor
    const pixel = ctx.getImageData(cx, cy, 1, 1).data;
    return pixel[3] > 0; // alpha > 0 means there's something drawn here
  }

  // ── Mouse interaction handlers ──

  function handleMouseDown(e: MouseEvent) {
    if (!ready || e.button !== 0) return;
    // Only start interaction if clicking on the cat sprite
    if (!isClickOnCat(e)) return;
    mouseDownTime = Date.now();
    mouseDownPos = { x: e.clientX, y: e.clientY };
    isDragging = false;
  }

  async function handleMouseMove(e: MouseEvent) {
    if (!ready) return;
    if (e.buttons !== 1 || mouseDownTime === 0) return;

    if (isDragging) {
      // Already dragging — move the window to follow the mouse.
      // screenX/Y give us the cursor position in screen coordinates.
      const newX = e.screenX - dragMouseStartX + dragWindowStartX;
      const newY = e.screenY - dragMouseStartY + dragWindowStartY;
      const rx = Math.round(newX);
      const ry = Math.round(newY);

      if (rx !== lastSetPos.x || ry !== lastSetPos.y) {
        lastSetPos = { x: rx, y: ry };
        appWindow.setPosition(new LogicalPosition(rx, ry));
      }
      return;
    }

    const dx = e.clientX - mouseDownPos.x;
    const dy = e.clientY - mouseDownPos.y;

    // Start drag if mouse moved more than 5px
    if (Math.sqrt(dx * dx + dy * dy) > 5) {
      isDragging = true;
      playSound('/audio/meow_confused.wav');
      stateMachine.forceState("dragged");

      // Record the starting positions for manual drag
      try {
        const pos = await appWindow.outerPosition();
        const monitor = await getMonitor();
        const scale = monitor?.scaleFactor ?? 1;
        dragWindowStartX = pos.x / scale;
        dragWindowStartY = pos.y / scale;
      } catch {
        dragWindowStartX = lastSetPos.x;
        dragWindowStartY = lastSetPos.y;
      }
      dragMouseStartX = e.screenX;
      dragMouseStartY = e.screenY;

      // Register global listeners so dragging continues even if cursor leaves the window
      window.addEventListener("mousemove", handleGlobalDragMove);
      window.addEventListener("mouseup", handleGlobalDragEnd);
    }
  }

  function handleGlobalDragMove(e: MouseEvent) {
    if (!isDragging) return;
    const newX = e.screenX - dragMouseStartX + dragWindowStartX;
    const newY = e.screenY - dragMouseStartY + dragWindowStartY;
    const rx = Math.round(newX);
    const ry = Math.round(newY);

    if (rx !== lastSetPos.x || ry !== lastSetPos.y) {
      lastSetPos = { x: rx, y: ry };
      appWindow.setPosition(new LogicalPosition(rx, ry));
    }
  }

  function handleGlobalDragEnd(_e: MouseEvent) {
    window.removeEventListener("mousemove", handleGlobalDragMove);
    window.removeEventListener("mouseup", handleGlobalDragEnd);
    finishDrag();
  }

  function finishDrag() {
    if (!isDragging) return;
    syncPositionAfterDrag();
    stateMachine.forceState("idle");
    isDragging = false;
    mouseDownTime = 0;
  }

  function handleMouseUp(e: MouseEvent) {
    if (!ready) return;
    if (e.button === 0 && !isDragging && mouseDownTime > 0) {
      // Quick click = pet the cat
      if (Date.now() - mouseDownTime < 300) {
        petCat();
      }
    }
    if (isDragging) {
      finishDrag();
    }
    mouseDownTime = 0;
  }

  function handleContextMenu(e: MouseEvent) {
    if (!ready) return;
    // Only show context menu when right-clicking on the cat sprite
    if (!isClickOnCat(e)) return;
    e.preventDefault();
    // Clamp menu position to window bounds
    menuX = Math.min(e.clientX, CONFIG.window.width - 150);
    menuY = Math.min(e.clientY, CONFIG.window.height - 160);
    showMenu = true;
  }

  /** Read the actual window position from the OS and sync to movement engine. */
  async function syncPositionAfterDrag() {
    try {
      const pos = await appWindow.outerPosition();
      const monitor = await getMonitor();
      const scale = monitor?.scaleFactor ?? 1;
      movement.setPosition({ x: pos.x / scale, y: pos.y / scale });
      lastSetPos = {
        x: Math.round(pos.x / scale),
        y: Math.round(pos.y / scale),
      };
    } catch {
      /* ignore position sync errors */
    }
  }

  /** Trigger the pet interaction. */
  function petCat() {
    const wasSleeping = stateMachine.state === "sleeping";
    stateMachine.forceState("petted");
    // Don't show speech bubble when waking the cat up
    if (!wasSleeping) {
      const petMessages = ["*purr*", "mlem!", ":3", "nya~", "mrrrp!"];
      bubbleText = petMessages[Math.floor(Math.random() * petMessages.length)];
      showBubble = true;
      setTimeout(() => {
        showBubble = false;
      }, 2000);
    }
  }

  /** Handle context menu actions. */
  function handleMenuAction(action: string) {
    showMenu = false;
    switch (action) {
      case "pet":
        petCat();
        break;
      case "sleep":
        stateMachine.forceState("sleeping");
        break;
      case "wake":
        stateMachine.forceState("idle");
        break;
      case "reset":
        movement.resetPosition();
        stateMachine.forceState("idle");
        break;
      case "quit":
        appWindow.close();
        break;
      case "settings":
        showSettings = true;
        break;
    }
  }

  /** Handle scale change from settings panel. */
  async function handleScaleChange(newScale: number) {
    userScale = newScale;

    // Resize window proportionally based on the default 32px sprite size
    const baseSize = CONFIG.sprite.defaultSize;
    const newWidth = Math.round(baseSize * newScale + 100);
    const newHeight = Math.round(baseSize * newScale + 100);

    // Resize the Tauri window first
    try {
      await appWindow.setSize(new LogicalSize(newWidth, newHeight));
    } catch {
      /* ignore resize errors */
    }

    // Update reactive canvas dimensions
    canvasWidth = newWidth;
    canvasHeight = newHeight;

    // Wait for Svelte to update the DOM, then re-grab context
    await new Promise((r) => requestAnimationFrame(r));
    if (canvas) {
      ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="game-container"
  onmousedown={handleMouseDown}
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  oncontextmenu={handleContextMenu}
>
  {#if showBubble}
    <SpeechBubble text={bubbleText} scale={userScale} canvasHeight={canvasHeight} />
  {/if}

  {#if showZzz}
    <div class="zzz-container" style="bottom: {CONFIG.sprite.defaultSize * userScale + 8}px; right: {canvasWidth / 2 - 20}px;">
      <span class="zzz z1" style="font-size: 8px;">z</span>
      <span class="zzz z2" style="font-size: 11px; bottom: 14px; right: -10px;">z</span>
      <span class="zzz z3" style="font-size: 14px; bottom: 30px; right: -22px;">z</span>
    </div>
  {/if}

  {#if showExclamation}
    <div class="exclamation-container" style="bottom: {CONFIG.sprite.defaultSize * userScale + 24}px;">
      <span class="exclamation">!</span>
    </div>
  {/if}

  {#if showQuestion}
    <div class="question-container" style="bottom: {CONFIG.sprite.defaultSize * userScale + 24}px;">
      <span class="question">?</span>
    </div>
  {/if}

  <canvas
    bind:this={canvas}
    width={canvasWidth}
    height={canvasHeight}
  ></canvas>

  {#if showMenu}
    <ContextMenu
      x={menuX}
      y={menuY}
      onAction={handleMenuAction}
      onClose={() => (showMenu = false)}
    />
  {/if}

  {#if showSettings}
    <SettingsPanel
      currentScale={userScale}
      onScaleChange={handleScaleChange}
      onClose={() => (showSettings = false)}
    />
  {/if}
</div>

<style>
  .game-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  canvas {
    display: block;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }

  /* ── Zzz sleeping indicator ── */
  .zzz-container {
    position: absolute;
    pointer-events: none;
    z-index: 10;
  }

  .zzz {
    position: absolute;
    font-family: 'PressStart2P', monospace;
    color: #fff7e4;
    opacity: 0;
    animation: zzz-float 2.4s ease-in-out infinite;
  }

  .z1 {
    bottom: 0;
    right: 0;
    animation-delay: 0s;
  }

  .z2 {
    animation-delay: 0.6s;
  }

  .z3 {
    animation-delay: 1.2s;
  }

  @keyframes zzz-float {
    0% {
      opacity: 0;
      transform: translate(0, 0) rotate(-15deg);
    }
    15% {
      opacity: 1;
    }
    70% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(8px, -18px) rotate(-25deg);
    }
  }

  /* ── Drag question mark ── */
  .question-container {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
    z-index: 10;
  }

  .question {
    font-family: 'PressStart2P', monospace;
    font-size: 16px;
    color: #f39c12;
    animation: question-bob 1.2s ease-in-out infinite;
  }

  @keyframes question-bob {
    0% {
      opacity: 0;
      transform: scale(0.3) translateY(10px);
    }
    15% {
      opacity: 1;
      transform: scale(1.2) translateY(-2px);
    }
    30% {
      transform: scale(1) translateY(0);
    }
    50% {
      transform: scale(1) translateY(-4px);
    }
    70% {
      transform: scale(1) translateY(0);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(-4px);
    }
  }

  /* ── Wake-up exclamation ── */
  .exclamation-container {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    pointer-events: none;
    z-index: 10;
  }

  .exclamation {
    font-family: 'PressStart2P', monospace;
    font-size: 16px;
    color: #c0392b;
    animation: exclaim-pop 1s ease-out forwards;
  }

  @keyframes exclaim-pop {
    0% {
      opacity: 0;
      transform: scale(0.3) translateY(10px);
    }
    20% {
      opacity: 1;
      transform: scale(1.3) translateY(-4px);
    }
    35% {
      transform: scale(1) translateY(0);
    }
    70% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
    100% {
      opacity: 0;
      transform: scale(0.8) translateY(-12px);
    }
  }

</style>
