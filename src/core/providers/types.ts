export type ProviderId = 'gemini' | 'aistudio' | 'chatgpt' | 'custom';

export interface ProviderCapabilities {
  promptManager: boolean;
  export: boolean;
  titleSync: boolean;
  chatWidth: boolean;
  contextSync: boolean;
  timeline: boolean;
  folders: boolean;
  fork: boolean;
}

export interface ProviderTurnSelectors {
  user: string[];
  assistant: string[];
}

export interface ProviderSidebarSelectors {
  container: string[];
  list: string[];
  conversation: string[];
  title: string[];
  link: string[];
}

export interface ProviderTitleConfig {
  selectors: string[];
  defaultTitle: string;
}

export interface ProviderAdapter {
  id: ProviderId;
  hostnames: string[];
  capabilities: ProviderCapabilities;
  turns: ProviderTurnSelectors;
  sidebar: ProviderSidebarSelectors;
  title: ProviderTitleConfig;
  conversationRootCandidates: string[];
  isConversationRoute(pathname?: string): boolean;
  extractConversationIdFromUrl(url: string): string | null;
  buildConversationUrl(conversationId: string, origin?: string): string;
}
