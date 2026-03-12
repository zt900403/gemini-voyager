/**
 * KaTeX Configuration Override
 * Suppresses KaTeX strict mode warnings for Unicode text in math mode
 * This allows formulas to contain CJK characters without console warnings
 */
import browser from 'webextension-polyfill';

import { logger } from '@/core';

const katexLogger = logger.createChild('KaTeXConfig');

export function shouldInjectKaTeXConfig(hostname = window.location.hostname): boolean {
  const normalizedHostname = hostname.toLowerCase();
  return (
    normalizedHostname === 'gemini.google.com' ||
    normalizedHostname === 'business.gemini.google' ||
    normalizedHostname === 'aistudio.google.com' ||
    normalizedHostname === 'aistudio.google.cn'
  );
}

/**
 * Override KaTeX strict mode to suppress Unicode warnings
 * Must be called early in page load, before KaTeX renders formulas
 */
export function configureKaTeX(hostname = window.location.hostname): void {
  if (!shouldInjectKaTeXConfig(hostname)) {
    katexLogger.debug('Skipping KaTeX configuration for unsupported hostname', { hostname });
    return;
  }

  try {
    // Load external script to avoid CSP issues with inline scripts
    const script = document.createElement('script');
    script.src = browser.runtime.getURL('katex-config.js');
    script.type = 'text/javascript';

    // Inject into page context (not content script context)
    (document.head || document.documentElement).appendChild(script);

    katexLogger.info('KaTeX configuration script injected successfully');
  } catch (error) {
    katexLogger.error('Failed to configure KaTeX', { error });
  }
}

/**
 * Initialize KaTeX configuration override
 */
export function initKaTeXConfig(hostname = window.location.hostname): void {
  configureKaTeX(hostname);
}
