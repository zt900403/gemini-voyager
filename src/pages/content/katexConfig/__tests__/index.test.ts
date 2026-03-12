import { describe, expect, it } from 'vitest';

import { shouldInjectKaTeXConfig } from '../index';

describe('shouldInjectKaTeXConfig', () => {
  it('allows Gemini and AI Studio hostnames', () => {
    expect(shouldInjectKaTeXConfig('gemini.google.com')).toBe(true);
    expect(shouldInjectKaTeXConfig('business.gemini.google')).toBe(true);
    expect(shouldInjectKaTeXConfig('aistudio.google.com')).toBe(true);
    expect(shouldInjectKaTeXConfig('aistudio.google.cn')).toBe(true);
  });

  it('skips ChatGPT and unrelated hostnames', () => {
    expect(shouldInjectKaTeXConfig('chatgpt.com')).toBe(false);
    expect(shouldInjectKaTeXConfig('example.com')).toBe(false);
  });
});
