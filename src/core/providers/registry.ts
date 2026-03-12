import type { ProviderAdapter, ProviderCapabilities, ProviderId } from './types';

const FULL_CAPABILITIES: ProviderCapabilities = {
  promptManager: true,
  export: true,
  titleSync: true,
  chatWidth: true,
  contextSync: true,
  timeline: true,
  folders: true,
  fork: true,
};

const SHARED_MVP_CAPABILITIES: ProviderCapabilities = {
  promptManager: true,
  export: true,
  titleSync: true,
  chatWidth: true,
  contextSync: true,
  timeline: true,
  folders: true,
  fork: false,
};

const CUSTOM_CAPABILITIES: ProviderCapabilities = {
  promptManager: true,
  export: false,
  titleSync: false,
  chatWidth: false,
  contextSync: false,
  timeline: false,
  folders: false,
  fork: false,
};

const GEMINI_USER_SELECTORS = [
  '.user-query-bubble-with-background',
  '.user-query-bubble-container',
  '.user-query-container',
  'user-query-content .user-query-bubble-with-background',
  'user-query-content',
  'user-query',
  'div[aria-label="User message"]',
  'article[data-author="user"]',
  'article[data-turn="user"]',
  '[data-message-author-role="user"]',
  'div[role="listitem"][data-user="true"]',
];

const GEMINI_ASSISTANT_SELECTORS = [
  '[aria-label="Gemini response"]',
  '[data-message-author-role="assistant"]',
  '[data-message-author-role="model"]',
  'article[data-author="assistant"]',
  'article[data-turn="assistant"]',
  'article[data-turn="model"]',
  'model-response',
  '.model-response',
  'response-container',
  '.response-container',
  '.presented-response-container',
  'div[role="listitem"]:not([data-user="true"])',
];

const CHATGPT_USER_SELECTORS = [
  '[data-message-author-role="user"]',
  'article[data-message-author-role="user"]',
  '[data-testid="conversation-turn-user"]',
  '[data-testid="user-message"]',
];

const CHATGPT_ASSISTANT_SELECTORS = [
  '[data-message-author-role="assistant"]',
  'article[data-message-author-role="assistant"]',
  '[data-testid="conversation-turn-assistant"]',
  '[data-testid="assistant-message"]',
];

export const PROVIDER_REGISTRY: Record<ProviderId, ProviderAdapter> = {
  gemini: {
    id: 'gemini',
    hostnames: ['gemini.google.com', 'business.gemini.google'],
    capabilities: FULL_CAPABILITIES,
    turns: {
      user: GEMINI_USER_SELECTORS,
      assistant: GEMINI_ASSISTANT_SELECTORS,
    },
    sidebar: {
      container: ['[data-test-id="overflow-container"]'],
      list: ['[data-test-id="all-conversations"]', '.chat-history'],
      conversation: ['[data-test-id="conversation"]'],
      title: ['.gds-label-l', '.conversation-title-text', '[data-test-id="conversation-title"]', 'h3'],
      link: ['a[href*="/app/"]', 'a[href*="/gem/"]'],
    },
    title: {
      selectors: [
        '.conversation-title-container [data-test-id="conversation-title"]',
        'top-bar-actions [data-test-id="conversation-title"]',
        '.top-bar-actions [data-test-id="conversation-title"]',
        '.conversation-title-container .conversation-title.gds-title-m',
        'top-bar-actions .conversation-title.gds-title-m',
      ],
      defaultTitle: 'Google Gemini',
    },
    conversationRootCandidates: ['#chat-history', 'infinite-scroller.chat-history', 'chat-window-content', 'main'],
    isConversationRoute(pathname = ''): boolean {
      return /^\/(?:u\/\d+\/)?(app|gem)(\/|$)/.test(pathname);
    },
    extractConversationIdFromUrl(url: string): string | null {
      try {
        const pathname = new URL(url, window.location.origin).pathname;
        const appMatch = pathname.match(/\/app\/([^/?#]+)/);
        if (appMatch?.[1]) return appMatch[1];
        const gemMatch = pathname.match(/\/gem\/[^/]+\/([^/?#]+)/);
        return gemMatch?.[1] ?? null;
      } catch {
        return null;
      }
    },
    buildConversationUrl(conversationId: string, origin = window.location.origin): string {
      return `${origin}/app/${encodeURIComponent(conversationId)}`;
    },
  },
  aistudio: {
    id: 'aistudio',
    hostnames: ['aistudio.google.com', 'aistudio.google.cn'],
    capabilities: {
      ...FULL_CAPABILITIES,
      titleSync: false,
      timeline: false,
      fork: false,
    },
    turns: {
      user: GEMINI_USER_SELECTORS,
      assistant: GEMINI_ASSISTANT_SELECTORS,
    },
    sidebar: {
      container: ['.prompt-history-container', 'nav', 'aside'],
      list: ['.chat-history', '.conversation-list', 'nav'],
      conversation: ['a[href*="/prompts/"]', '[data-testid="history-item"]'],
      title: ['.conversation-title', '.title', 'h3'],
      link: ['a[href*="/prompts/"]'],
    },
    title: {
      selectors: [],
      defaultTitle: 'Google AI Studio',
    },
    conversationRootCandidates: ['main', '[role="main"]'],
    isConversationRoute(pathname = ''): boolean {
      return /^\/(?:prompts|chat|app)(\/|$)/.test(pathname);
    },
    extractConversationIdFromUrl(url: string): string | null {
      try {
        const pathname = new URL(url, window.location.origin).pathname;
        const match = pathname.match(/\/prompts\/([^/?#]+)/);
        return match?.[1] ?? null;
      } catch {
        return null;
      }
    },
    buildConversationUrl(conversationId: string, origin = window.location.origin): string {
      return `${origin}/prompts/${encodeURIComponent(conversationId)}`;
    },
  },
  chatgpt: {
    id: 'chatgpt',
    hostnames: ['chatgpt.com'],
    capabilities: SHARED_MVP_CAPABILITIES,
    turns: {
      user: CHATGPT_USER_SELECTORS,
      assistant: CHATGPT_ASSISTANT_SELECTORS,
    },
    sidebar: {
      container: ['nav[aria-label*="Chat"]', 'aside nav', 'aside', 'nav'],
      list: ['nav[aria-label*="Chat"]', '[data-testid="history"]', 'aside nav', 'nav'],
      conversation: ['a[href^="/c/"]', 'a[href*="/c/"]', '[data-testid^="history-item"]'],
      title: ['[data-testid="conversation-title"]', 'h1', 'h2', '[data-testid^="history-item"] span'],
      link: ['a[href^="/c/"]', 'a[href*="/c/"]'],
    },
    title: {
      selectors: [
        '[data-testid="conversation-title"]',
        'main h1',
        'header h1',
        'h1',
      ],
      defaultTitle: 'ChatGPT',
    },
    conversationRootCandidates: [
      '[data-testid="conversation-view"]',
      '[data-testid="thread"]',
      'main',
      '[role="main"]',
    ],
    isConversationRoute(pathname = ''): boolean {
      return /^\/c\/[^/?#]+/.test(pathname);
    },
    extractConversationIdFromUrl(url: string): string | null {
      try {
        const pathname = new URL(url, window.location.origin).pathname;
        const match = pathname.match(/\/c\/([^/?#]+)/);
        return match?.[1] ?? null;
      } catch {
        return null;
      }
    },
    buildConversationUrl(conversationId: string, origin = window.location.origin): string {
      return `${origin}/c/${encodeURIComponent(conversationId)}`;
    },
  },
  custom: {
    id: 'custom',
    hostnames: [],
    capabilities: CUSTOM_CAPABILITIES,
    turns: {
      user: [...GEMINI_USER_SELECTORS, ...CHATGPT_USER_SELECTORS],
      assistant: [...GEMINI_ASSISTANT_SELECTORS, ...CHATGPT_ASSISTANT_SELECTORS],
    },
    sidebar: {
      container: [],
      list: [],
      conversation: [],
      title: ['h1', 'title'],
      link: [],
    },
    title: {
      selectors: ['h1'],
      defaultTitle: document.title || 'Conversation',
    },
    conversationRootCandidates: [
      '#chat-history',
      'infinite-scroller.chat-history',
      'chat-window-content',
      'main',
      '[role="main"]',
      'body',
    ],
    isConversationRoute(): boolean {
      return false;
    },
    extractConversationIdFromUrl(): string | null {
      return null;
    },
    buildConversationUrl(conversationId: string, origin = window.location.origin): string {
      return `${origin}/${encodeURIComponent(conversationId)}`;
    },
  },
};
