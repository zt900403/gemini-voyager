import { beforeEach, describe, expect, it, vi } from 'vitest';

function mockRect(top: number): DOMRect {
  return {
    x: 0,
    y: top,
    width: 200,
    height: 40,
    top,
    right: 200,
    bottom: top + 40,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('TimelineManager ChatGPT positioning', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    localStorage.clear();

    Object.defineProperty(window, 'location', {
      value: {
        hostname: 'chatgpt.com',
        pathname: '/c/chat-123',
        search: '',
        hash: '',
        href: 'https://chatgpt.com/c/chat-123',
        origin: 'https://chatgpt.com',
      },
      writable: true,
      configurable: true,
    });
  });

  it('normalizes markers using scroll-container-relative positions instead of raw offsetTop', async () => {
    const { TimelineManager } = await import('../manager');

    const scrollContainer = document.createElement('div');
    const main = document.createElement('main');
    const first = document.createElement('article');
    const second = document.createElement('article');
    first.setAttribute('data-message-author-role', 'user');
    second.setAttribute('data-message-author-role', 'user');
    first.textContent = 'first prompt';
    second.textContent = 'second prompt';
    main.append(first, second);
    scrollContainer.appendChild(main);
    document.body.appendChild(scrollContainer);

    Object.defineProperty(scrollContainer, 'scrollTop', { value: 0, writable: true });
    Object.defineProperty(scrollContainer, 'clientHeight', { value: 800, configurable: true });
    Object.defineProperty(scrollContainer, 'getBoundingClientRect', {
      value: () => mockRect(0),
      configurable: true,
    });

    Object.defineProperty(first, 'offsetTop', { value: 0, configurable: true });
    Object.defineProperty(second, 'offsetTop', { value: 0, configurable: true });
    Object.defineProperty(first, 'getBoundingClientRect', {
      value: () => mockRect(100),
      configurable: true,
    });
    Object.defineProperty(second, 'getBoundingClientRect', {
      value: () => mockRect(500),
      configurable: true,
    });

    const timelineBar = document.createElement('div');
    const track = document.createElement('div');
    const trackContent = document.createElement('div');
    track.appendChild(trackContent);
    timelineBar.appendChild(track);
    document.body.appendChild(timelineBar);

    Object.defineProperty(timelineBar, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(track, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(track, 'scrollTop', { value: 0, writable: true, configurable: true });

    const manager = new TimelineManager() as unknown as {
      conversationContainer: HTMLElement;
      scrollContainer: HTMLElement;
      userTurnSelector: string;
      ui: {
        timelineBar: HTMLElement;
        tooltip: HTMLElement | null;
        track: HTMLElement;
        trackContent: HTMLElement;
      };
      recalculateAndRenderMarkers: () => void;
      firstUserTurnOffset: number;
      contentSpanPx: number;
      markers: Array<{ n: number }>;
    };

    manager.conversationContainer = main;
    manager.scrollContainer = scrollContainer;
    manager.userTurnSelector = '[data-message-author-role="user"]';
    manager.ui = {
      timelineBar,
      tooltip: null,
      track,
      trackContent,
    };

    manager.recalculateAndRenderMarkers();

    expect(manager.firstUserTurnOffset).toBe(100);
    expect(manager.contentSpanPx).toBe(400);
    expect(manager.markers).toHaveLength(2);
    expect(manager.markers[0].n).toBe(0);
    expect(manager.markers[1].n).toBe(1);
  });

  it('silently skips reapplyPosition when extension context is invalidated', async () => {
    const { TimelineManager } = await import('../manager');
    const manager = new TimelineManager() as unknown as {
      ui: { timelineBar: HTMLElement };
      reapplyPosition: () => Promise<void>;
    };

    manager.ui = {
      timelineBar: document.createElement('div'),
    };

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const chromeRuntime = chrome.runtime as typeof chrome.runtime & { lastError: typeof chrome.runtime.lastError };
    const chromeStorageSync = chrome.storage.sync as typeof chrome.storage.sync & {
      get: (defaults: Record<string, unknown>, callback: (items: Record<string, unknown>) => void) => void;
    };
    const originalLastError = chromeRuntime.lastError;
    const originalGet = chromeStorageSync.get;

    chromeStorageSync.get = vi.fn(
      (defaults: Record<string, unknown>, callback: (items: Record<string, unknown>) => void) => {
        void defaults;
        chromeRuntime.lastError = {
          message: 'Extension context invalidated.',
        } as typeof chrome.runtime.lastError;
        callback({});
        chromeRuntime.lastError = originalLastError;
      },
    ) as unknown as typeof chromeStorageSync.get;

    await manager.reapplyPosition();

    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('[Timeline] reapplyPosition storage access failed:'),
      expect.anything(),
    );

    chromeStorageSync.get = originalGet;
    chromeRuntime.lastError = originalLastError;
    consoleErrorSpy.mockRestore();
  });
});
