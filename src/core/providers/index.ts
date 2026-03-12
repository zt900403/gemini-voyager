import { PROVIDER_REGISTRY } from './registry';
import type { ProviderAdapter, ProviderId } from './types';

export type { ProviderAdapter, ProviderCapabilities, ProviderId } from './types';

export function getProviderById(providerId: ProviderId): ProviderAdapter {
  return PROVIDER_REGISTRY[providerId];
}

export function detectProviderId(hostname = window.location.hostname): ProviderId | null {
  const normalizedHost = hostname.toLowerCase();

  if (PROVIDER_REGISTRY.chatgpt.hostnames.includes(normalizedHost)) return 'chatgpt';
  if (PROVIDER_REGISTRY.aistudio.hostnames.includes(normalizedHost)) return 'aistudio';
  if (PROVIDER_REGISTRY.gemini.hostnames.includes(normalizedHost)) return 'gemini';

  return null;
}

export function getProviderForHostname(hostname = window.location.hostname): ProviderAdapter | null {
  const providerId = detectProviderId(hostname);
  return providerId ? getProviderById(providerId) : null;
}

export function getCurrentProvider(): ProviderAdapter {
  return getProviderForHostname() ?? getProviderById('custom');
}

export function isCustomWebsiteHost(
  hostname: string,
  customWebsites: string[],
): boolean {
  const currentHost = hostname.toLowerCase().replace(/^www\./, '');
  return customWebsites.some((website) => {
    const normalizedWebsite = website.toLowerCase().replace(/^www\./, '');
    return currentHost === normalizedWebsite || currentHost.endsWith(`.${normalizedWebsite}`);
  });
}
