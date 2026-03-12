import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { applyPromptManagerTheme, getPromptManagerTheme } from '../theme';

describe('prompt manager theme helpers', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.body.className = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-color-scheme');
    document.body.removeAttribute('data-theme');
    document.body.removeAttribute('data-color-scheme');
    document.body.innerHTML = '';
  });

  it('prefers Gemini theme host classes over generic page classes', () => {
    document.documentElement.classList.add('dark');
    const themeHost = document.createElement('div');
    themeHost.className = 'theme-host light-theme';
    document.body.appendChild(themeHost);

    expect(getPromptManagerTheme(document)).toBe('light');
  });

  it('detects ChatGPT theme attributes from the root element', () => {
    document.documentElement.setAttribute('data-theme', 'dark');

    expect(getPromptManagerTheme(document)).toBe('dark');
  });

  it('applies mutually exclusive panel theme classes', () => {
    const panel = document.createElement('div');

    document.documentElement.setAttribute('data-color-scheme', 'light');
    expect(applyPromptManagerTheme(panel, document)).toBe('light');
    expect(panel.classList.contains('gv-pm-theme-light')).toBe(true);
    expect(panel.classList.contains('gv-pm-theme-dark')).toBe(false);

    document.documentElement.setAttribute('data-color-scheme', 'dark');
    expect(applyPromptManagerTheme(panel, document)).toBe('dark');
    expect(panel.classList.contains('gv-pm-theme-light')).toBe(false);
    expect(panel.classList.contains('gv-pm-theme-dark')).toBe(true);
  });
});

describe('prompt manager theme css', () => {
  it('includes panel-scoped light and dark overrides for prompt controls', () => {
    const css = readFileSync(resolve(process.cwd(), 'public/contentStyle.css'), 'utf8');

    expect(css).toContain('.gv-pm-panel.gv-pm-theme-light {');
    expect(css).toContain('.gv-pm-panel.gv-pm-theme-dark {');
    expect(css).toContain(".gv-pm-search input[type='search'], .gv-pm-input-text, .gv-pm-input-tags");
    expect(css).toContain('.gv-pm-panel.gv-pm-theme-light .gv-md-collapsed::after');
    expect(css).toContain('.gv-pm-panel.gv-pm-theme-dark .gv-pm-gh-icon');
  });
});
