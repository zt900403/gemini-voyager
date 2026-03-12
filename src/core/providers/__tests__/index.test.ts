import { describe, expect, it } from 'vitest';

import { detectProviderId, getProviderById } from '..';

describe('provider registry', () => {
  it('detects first-class providers by hostname', () => {
    expect(detectProviderId('gemini.google.com')).toBe('gemini');
    expect(detectProviderId('aistudio.google.com')).toBe('aistudio');
    expect(detectProviderId('chatgpt.com')).toBe('chatgpt');
    expect(detectProviderId('example.com')).toBeNull();
  });

  it('exposes ChatGPT capabilities and selectors', () => {
    const provider = getProviderById('chatgpt');
    expect(provider.capabilities.timeline).toBe(true);
    expect(provider.capabilities.folders).toBe(true);
    expect(provider.sidebar.link).toContain('a[href^="/c/"]');
    expect(provider.turns.user).toContain('[data-message-author-role="user"]');
  });
});
