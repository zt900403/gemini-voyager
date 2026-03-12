/**
 * DOM selector utilities
 * Centralized selectors (was duplicated in multiple files)
 */
import { getCurrentProvider } from '@/core/providers';

/**
 * Get selectors for user query elements
 */
export function getUserTurnSelectors(): string[] {
  return getCurrentProvider().turns.user;
}

/**
 * Get selectors for assistant/model response elements
 */
export function getAssistantTurnSelectors(): string[] {
  return getCurrentProvider().turns.assistant;
}

/**
 * Get conversation selectors
 */
export function getConversationSelectors(): string[] {
  return ['[data-test-id="conversation"]', '[data-test-id^="history-item"]', '.conversation-card'];
}

/**
 * Get conversation link selectors
 */
export function getConversationLinkSelectors(): string[] {
  return getCurrentProvider().sidebar.link;
}

/**
 * Build combined selector string
 */
export function combineSelectors(selectors: string[]): string {
  return selectors.join(', ');
}
