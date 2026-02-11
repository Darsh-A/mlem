<script lang="ts">
  let {
    currentScale,
    onScaleChange,
    onClose,
  }: {
    currentScale: number;
    onScaleChange: (scale: number) => void;
    onClose: () => void;
  } = $props();

  let scaleValue = $derived(currentScale);

  function handleScaleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    scaleValue = parseFloat(target.value);
    onScaleChange(scaleValue);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="settings-backdrop" onclick={onClose} role="presentation"></div>

<div class="settings-panel">
  <div class="settings-title">Settings</div>

  <div class="setting-row">
    <label class="setting-label" for="scale-slider">Scale</label>
    <input
      id="scale-slider"
      class="pixel-range"
      type="range"
      min="2"
      max="6"
      step="0.5"
      value={scaleValue}
      oninput={handleScaleInput}
    />
    <span class="setting-value">{scaleValue}x</span>
  </div>

  <button class="close-btn" onclick={onClose}>OK</button>
</div>

<style>
  .settings-backdrop {
    position: fixed;
    inset: 0;
    z-index: 199;
  }

  .settings-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: transparent;
    border: none;
    border-image-source: url('/sprites/container.png');
    border-image-slice: 8 fill;
    border-image-width: 14px;
    border-image-repeat: round;
    border-style: solid;
    border-width: 14px;
    image-rendering: pixelated;
    padding: 6px 10px;
    min-width: 140px;
    z-index: 200;
    animation: settings-in 0.15s ease-out;
  }

  .settings-title {
    font-family: 'PressStart2P', monospace;
    font-size: 10px;
    color: #3b2a1a;
    text-align: center;
    margin-bottom: 8px;
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .setting-label {
    font-family: 'PressStart2P', monospace;
    font-size: 7px;
    color: #3b2a1a;
    min-width: 36px;
  }

  .setting-value {
    font-family: 'PressStart2P', monospace;
    font-size: 7px;
    color: #3b2a1a;
    min-width: 24px;
    text-align: right;
  }

  .pixel-range {
    -webkit-appearance: none;
    appearance: none;
    width: 70px;
    height: 6px;
    background: #3b2a1a;
    outline: none;
    border: none;
    image-rendering: pixelated;
  }

  .pixel-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 14px;
    background: #3b2a1a;
    cursor: pointer;
    border: 2px solid #d4b896;
    image-rendering: pixelated;
  }

  .pixel-range::-moz-range-thumb {
    width: 10px;
    height: 14px;
    background: #3b2a1a;
    cursor: pointer;
    border: 2px solid #d4b896;
    border-radius: 0;
  }

  .close-btn {
    display: block;
    width: 100%;
    padding: 4px 8px;
    border: 2px solid #3b2a1a;
    background: rgba(59, 42, 26, 0.1);
    color: #3b2a1a;
    font-size: 8px;
    font-family: 'PressStart2P', monospace;
    cursor: pointer;
    text-align: center;
    margin-top: 4px;
  }

  .close-btn:hover {
    background: rgba(59, 42, 26, 0.2);
  }

  @keyframes settings-in {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.9);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }
</style>
