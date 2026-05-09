(() => {
  const processedAttr = 'data-yt-history-x-injected';
  // Short delay lets YouTube update its own UI state before we remove the item locally.
  const removeDelayMs = 300;
  // Delay to allow YouTube's popup menu to finish rendering before we query its items.
  const menuOpenDelayMs = 150;
  const observerConfig = { childList: true, subtree: true };

  const isHistoryPage = () => location.pathname.startsWith('/feed/history');

  const getUnprocessedVideoItems = () =>
    [
      ...document.querySelectorAll(
        'ytd-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer'
      ),
    ].filter((el) => !el.hasAttribute(processedAttr));

  // Opens the action menu for a video item and clicks "Remove from Watch History".
  const clickRemoveFromHistory = async (item) => {
    // Some UI variants expose a direct remove button without needing the menu.
    const directRemove = item.querySelector(
      'button[aria-label*="Remove from Watch History"], button[aria-label*="Remove from history"]'
    );
    if (directRemove) {
      directRemove.click();
      return;
    }

    // Open the 3-dot action menu.
    const menuButton = item.querySelector('#menu button, ytd-menu-renderer button');
    if (!menuButton) {
      return;
    }

    menuButton.click();

    // Wait for the popup to render before searching for the menu item.
    await new Promise((resolve) => setTimeout(resolve, menuOpenDelayMs));

    // Look inside the open popup first, then fall back to a global search.
    const candidates = [
      ...document.querySelectorAll(
        'ytd-menu-popup-renderer ytd-menu-service-item-renderer, ' +
        'ytd-menu-popup-renderer tp-yt-paper-item, ' +
        'tp-yt-paper-listbox ytd-menu-service-item-renderer, ' +
        'tp-yt-paper-listbox tp-yt-paper-item'
      ),
    ];

    for (const candidate of candidates) {
      const text = candidate.textContent.trim().toLowerCase();
      if (text.includes('remove') && text.includes('history')) {
        candidate.click();
        return;
      }
    }
  };

  const scheduleItemRemoval = (item) => {
    setTimeout(() => {
      if (item.isConnected) {
        item.remove();
      }
    }, removeDelayMs);
  };

  const addRemoveButton = (item) => {
    item.setAttribute(processedAttr, 'true');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'yt-history-remove-button';
    button.title = 'Remove from Watch History';
    button.setAttribute('aria-label', 'Remove from Watch History');
    button.textContent = '✕';

    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        await clickRemoveFromHistory(item);
      } catch (err) {
        console.error('[yt-history] Failed to remove item from Watch History:', err);
      }
      scheduleItemRemoval(item);
    });

    // Overlay the button on the video thumbnail.
    const thumbnail = item.querySelector(
      'ytd-thumbnail, a#thumbnail, a.ytd-thumbnail, #thumbnail'
    );
    if (thumbnail) {
      thumbnail.style.position = 'relative';
      thumbnail.appendChild(button);
    } else {
      item.appendChild(button);
    }
  };

  const apply = () => {
    if (!isHistoryPage()) {
      return;
    }
    getUnprocessedVideoItems().forEach(addRemoveButton);
  };

  let applyQueued = false;
  let observer = null;

  const scheduleApply = () => {
    if (applyQueued) {
      return;
    }
    applyQueued = true;
    requestAnimationFrame(() => {
      applyQueued = false;
      apply();
    });
  };

  // Re-run when YouTube performs a SPA navigation (e.g. user navigates to /feed/history).
  document.addEventListener('yt-navigate-finish', scheduleApply);

  observer = new MutationObserver(scheduleApply);
  observer.observe(document.body, observerConfig);

  apply();
})();
