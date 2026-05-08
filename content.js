(() => {
  const rowSelectors = [
    'ytd-searchbox-spt ytd-item-section-renderer ytd-searchbox-spt-item-renderer',
    'ytd-searchbox ytd-item-section-renderer ytd-searchbox-spt-item-renderer',
    '[role="listbox"] [role="option"]',
    'ul[role="listbox"] li'
  ];

  const removeControlSelectors = [
    'button[aria-label*="Remove"]',
    'tp-yt-paper-icon-button[aria-label*="Remove"]',
    '[title*="Remove"]',
    '[aria-label*="Delete"]'
  ];

  const processedAttr = 'data-yt-history-x-injected';
  const searchControlsAttr = 'data-yt-history-search-controls';
  // Short delay lets YouTube update its own UI state before we remove the row locally.
  const removeDelayMs = 250;
  const observerConfig = { childList: true, subtree: true };

  const queryText = (element) => (element?.textContent || '').replace(/\s+/g, ' ').trim();
  const normalizeQuery = (text) => text.replace(/\s+/g, ' ').trim().toLowerCase();
  const rowSearchText = (row) => normalizeQuery(
    queryText(row.querySelector('span, yt-formatted-string') || row)
      .replace(/[✕x]\s*$/i, '')
  );

  const getSuggestionRows = () => {
    const rows = new Set();
    rowSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (queryText(element)) {
          rows.add(element);
        }
      });
    });
    return [...rows];
  };

  const triggerBuiltInRemove = (row) => {
    for (const selector of removeControlSelectors) {
      const control = row.querySelector(selector);
      if (control) {
        control.click();
        return true;
      }
    }

    const focusTarget = row.querySelector('button, a, [role="option"], [tabindex]') || row;
    focusTarget.focus?.();
    // Fallback: simulate Shift+Delete, which YouTube may handle to remove a suggestion/history item.
    focusTarget.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Delete',
      code: 'Delete',
      shiftKey: true,
      bubbles: true,
      cancelable: true
    }));

    return false;
  };

  const scheduleRowRemoval = (row) => {
    setTimeout(() => {
      if (row.isConnected) {
        row.remove();
      }
    }, removeDelayMs);
  };

  const addInlineRemoveButton = (row) => {
    if (row.getAttribute(processedAttr) === 'true') {
      return;
    }

    row.setAttribute(processedAttr, 'true');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'yt-history-remove-button';
    button.title = 'Remove this search from history';
    button.setAttribute('aria-label', 'Remove this search from history');
    button.textContent = '✕';

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      triggerBuiltInRemove(row);
      scheduleRowRemoval(row);
    });

    row.appendChild(button);
  };

  const submitCurrentSearch = (input) => {
    const value = input.value.trim();
    if (!value) {
      return;
    }

    const form = input.closest('form');
    if (!form) {
      return;
    }

    const searchButton = form.querySelector('#search-icon-legacy button, button#search-icon-legacy, button[aria-label*="Search"]');
    if (searchButton) {
      searchButton.click();
      return;
    }

    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
      return;
    }

    form.submit();
  };

  const removeCurrentSearch = (input) => {
    const target = normalizeQuery(input.value);
    if (!target) {
      return;
    }

    const rows = getSuggestionRows().filter((row) => rowSearchText(row) === target);
    rows.forEach((row) => {
      triggerBuiltInRemove(row);
      scheduleRowRemoval(row);
    });
  };

  const injectSearchControls = () => {
    const input = document.querySelector('input#search');
    if (!input) {
      return;
    }

    const container = input.closest('#container.ytd-searchbox') || input.closest('form') || input.parentElement;
    if (!container || container.querySelector(`[${searchControlsAttr}="true"]`)) {
      return;
    }

    const controls = document.createElement('div');
    controls.className = 'yt-history-search-controls';
    controls.setAttribute(searchControlsAttr, 'true');

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'yt-history-action-button';
    addButton.textContent = '+';
    addButton.title = 'Add current query to history by running the search';
    addButton.setAttribute('aria-label', 'Add current query to history');
    addButton.addEventListener('click', () => submitCurrentSearch(input));

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'yt-history-action-button';
    removeButton.textContent = '✕';
    removeButton.title = 'Remove matching query from visible search history suggestions';
    removeButton.setAttribute('aria-label', 'Remove current query from search history suggestions');
    removeButton.addEventListener('click', () => removeCurrentSearch(input));

    controls.appendChild(addButton);
    controls.appendChild(removeButton);
    container.appendChild(controls);
  };

  const apply = () => {
    injectSearchControls();
    getSuggestionRows().forEach(addInlineRemoveButton);
  };

  let applyQueued = false;
  let observerTarget = null;
  let observer = null;

  const findObserverTarget = () => (
    document.querySelector('ytd-searchbox')
    || document.querySelector('#searchform')
    || document.querySelector('form[role="search"]')
    || document.querySelector('ytd-masthead')
    || document.querySelector('[role="listbox"]')
    || document.body
  );

  const updateObserverTarget = () => {
    const nextTarget = findObserverTarget();
    if (!observer || !nextTarget || nextTarget === observerTarget) {
      return;
    }
    observer.disconnect();
    observer.observe(nextTarget, observerConfig);
    observerTarget = nextTarget;
  };

  const scheduleApply = () => {
    if (applyQueued) {
      return;
    }
    applyQueued = true;
    requestAnimationFrame(() => {
      applyQueued = false;
      updateObserverTarget();
      apply();
    });
  };

  observer = new MutationObserver(scheduleApply);
  updateObserverTarget();

  apply();
})();
