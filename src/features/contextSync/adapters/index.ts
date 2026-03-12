import { AdapterConfig } from '../types';

export const ADAPTERS: Record<string, AdapterConfig> = {
  // gemini
  'gemini.google.com': {
    user_selector: ['div.user-query-container'],
    ai_selector: ['.response-content'],
  },
  'chatgpt.com': {
    user_selector: [
      '[data-message-author-role="user"]',
      'article[data-message-author-role="user"]',
      '[data-testid="conversation-turn-user"]',
    ],
    ai_selector: [
      '[data-message-author-role="assistant"]',
      'article[data-message-author-role="assistant"]',
      '[data-testid="conversation-turn-assistant"]',
    ],
  },
  // default
  default: {
    selectors: ['div', 'p'],
    aiMarkers: ['ai', 'assistant'],
    userMarkers: ['user', 'human'],
  },
};

export function getMatchedAdapter(host: string): AdapterConfig {
  for (const key of Object.keys(ADAPTERS)) {
    if (host.includes(key)) {
      return ADAPTERS[key];
    }
  }
  return ADAPTERS.default;
}
