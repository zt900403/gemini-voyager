/**
 * Feature: Auto Update Tab Title
 * Description: Automatically updates the browser tab title to match the current Gemini chat title.
 * Performance: Targeted observer on top-bar-actions + History API interception.
 */
import { getCurrentProvider } from '@/core/providers';

let lastTitle = '';
let lastUrl = '';
let observer: MutationObserver | null = null;

/**
 * Starts the title updater service.
 * Uses targeted MutationObserver + History API interception for best performance.
 */
export async function startTitleUpdater() {
  const provider = getCurrentProvider();
  const enabledKey =
    provider.id === 'chatgpt' ? 'gvChatGPTTabTitleUpdateEnabled' : 'gvTabTitleUpdateEnabled';
  const result = await chrome.storage.sync.get({
    gvTabTitleUpdateEnabled: true,
    [enabledKey]: true,
  });

  const isEnabled =
    typeof result[enabledKey] === 'boolean'
      ? result[enabledKey] !== false
      : result.gvTabTitleUpdateEnabled !== false;
  if (!isEnabled) return;

  lastUrl = location.href;

  // Throttled update function (500ms)
  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  const throttledUpdate = () => {
    if (throttleTimer) return;
    throttleTimer = setTimeout(() => {
      throttleTimer = null;
      tryUpdateTitle();
    }, 500);
  };

  // Handle URL changes - reset title cache and re-attach observer
  const handleUrlChange = () => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastTitle = '';
      attachObserver();
      tryUpdateTitle();
    }
  };

  // Smart observer attachment - targets top-bar-actions for minimal scope
  const attachObserver = () => {
    if (observer) observer.disconnect();

    const targetSelectors = [
      ...provider.title.selectors,
      'top-bar-actions',
      '.conversation-title-container',
      '.center-section',
      'header',
      'main',
    ];
    const target = targetSelectors
      .map((selector) => document.querySelector(selector))
      .find((element) => !!element);

    if (!target) {
      // Container not ready yet, watch for it
      observer = new MutationObserver(() => {
        if (targetSelectors.some((selector) => !!document.querySelector(selector))) {
          attachObserver();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return;
    }

    observer = new MutationObserver(throttledUpdate);
    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  };

  // Intercept History API for SPA navigation detection
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = (...args) => {
    originalPushState(...args);
    handleUrlChange();
  };

  history.replaceState = (...args) => {
    originalReplaceState(...args);
    handleUrlChange();
  };

  // Also listen for browser back/forward
  window.addEventListener('popstate', handleUrlChange);

  // Initialize
  attachObserver();
  tryUpdateTitle();
}

/**
 * Updates document title based on current chat.
 * Restores default title when not on a conversation page.
 */
function tryUpdateTitle() {
  const provider = getCurrentProvider();
  const currentTitle = findChatTitle();

  // Restore default title if not on conversation page
  if (!currentTitle) {
    if (document.title !== provider.title.defaultTitle) {
      document.title = provider.title.defaultTitle;
      lastTitle = '';
    }
    return;
  }

  // Update only if title actually changed
  if (currentTitle !== lastTitle) {
    document.title = provider.id === 'chatgpt' ? currentTitle : `${currentTitle} - Gemini`;
    lastTitle = currentTitle;
  }
}

/**
 * Extracts chat title from top bar area only.
 * Returns null if not on a conversation page or title not found.
 */
function findChatTitle(): string | null {
  const provider = getCurrentProvider();
  if (!provider.isConversationRoute(location.pathname)) {
    return null;
  }

  const titleEl = provider.title.selectors
    .map((selector) => document.querySelector(selector))
    .find((element) => !!element);

  if (titleEl) {
    const text = titleEl.textContent?.trim();
    if (
      text &&
      text !== 'New chat' &&
      text !== 'Gemini' &&
      text !== 'Google Gemini' &&
      text !== 'ChatGPT'
    ) {
      return text;
    }
  }

  return null;
}
