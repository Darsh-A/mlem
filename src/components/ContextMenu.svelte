<script lang="ts">
  let {
    x,
    y,
    onAction,
    onClose,
  }: {
    x: number;
    y: number;
    onAction: (action: string) => void;
    onClose: () => void;
  } = $props();

  const menuItems = [
    { id: "pet", label: "Pet" },
    { id: "sleep", label: "Sleep" },
    { id: "wake", label: "Wake Up" },
    { id: "reset", label: "Reset Position" },
    { id: "settings", label: "Settings" },
    { id: "quit", label: "Quit" },
  ];

  function handleItemClick(e: MouseEvent, action: string) {
    e.stopPropagation();
    onAction(action);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- Invisible backdrop to catch clicks outside the menu -->
<div class="menu-backdrop" onclick={onClose} role="presentation"></div>

<div class="context-menu" style="left: {x}px; top: {y}px;">
  {#each menuItems as item}
    <button
      class="menu-item"
      class:danger={item.id === "quit"}
      onclick={(e) => handleItemClick(e, item.id)}
    >
      {item.label}
    </button>
  {/each}
</div>

<style>
  .menu-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .context-menu {
    position: fixed;
    background: transparent;
    border: none;
    border-image-source: url('/sprites/container.png');
    border-image-slice: 8 fill;
    border-image-width: 12px;
    border-image-repeat: round;
    border-style: solid;
    border-width: 12px;
    padding: 2px 0;
    min-width: 110px;
    z-index: 100;
    image-rendering: pixelated;
    animation: menu-in 0.1s ease-out;
  }

  .menu-item {
    display: block;
    width: 100%;
    padding: 4px 8px;
    border: none;
    background: none;
    color: #3b2a1a;
    font-size: 9px;
    text-align: left;
    cursor: pointer;
    font-family: 'PressStart2P', monospace;
    line-height: 1.6;
    letter-spacing: -0.5px;
  }

  .menu-item:hover {
    background: rgba(0, 0, 0, 0.1);
  }

  .menu-item.danger {
    color: #c0392b;
  }

  .menu-item.danger:hover {
    background: rgba(192, 57, 43, 0.12);
  }

  @keyframes menu-in {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
