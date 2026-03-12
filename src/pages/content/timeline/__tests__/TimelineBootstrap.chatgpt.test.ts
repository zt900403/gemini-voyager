import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const timelineManagerSpies = {
  constructed: vi.fn(),
  init: vi.fn().mockResolvedValue(undefined),
  destroy: vi.fn(),
};

vi.mock('../manager', () => {
  class TimelineManager {
    init = timelineManagerSpies.init;
    destroy = timelineManagerSpies.destroy;
    constructor() {
      timelineManagerSpies.constructed();
    }
  }

  return { TimelineManager };
});

describe('Timeline bootstrap on ChatGPT', () => {
  beforeEach(async () => {
    vi.resetModules();
    timelineManagerSpies.constructed.mockClear();
    timelineManagerSpies.init.mockClear();
    timelineManagerSpies.destroy.mockClear();

    document.body.innerHTML = '<main></main>';

    Object.defineProperty(window, 'location', {
      value: {
        hostname: 'chatgpt.com',
        pathname: '/c/chat-123',
        search: '',
        hash: '',
        href: 'https://chatgpt.com/c/chat-123',
        origin: 'https://chatgpt.com',
        assign: vi.fn(),
        replace: vi.fn(),
        reload: vi.fn(),
        toString: () => 'https://chatgpt.com/c/chat-123',
      },
      writable: true,
    });

    history.replaceState({}, '', '/c/chat-123');
  });

  afterEach(() => {
    window.dispatchEvent(new Event('beforeunload'));
  });

  it('initializes timeline on ChatGPT conversation routes', async () => {
    const { startTimeline } = await import('../index');

    startTimeline();

    expect(timelineManagerSpies.constructed).toHaveBeenCalledTimes(1);
    expect(timelineManagerSpies.init).toHaveBeenCalledTimes(1);
  });
});
