import { describe, expect, it } from 'vitest';

import { ErrorCode, StorageError } from '@/core/errors/AppError';
import { StorageKeys } from '@/core/types/common';

import {
  isPromptStorageContextInvalidated,
  normalizePromptStorageValue,
  sanitizePromptItems,
} from '../promptStorage';

describe('promptStorage helpers', () => {
  it('sanitizes prompt items into plain storage-safe records', () => {
    const now = 1700000000000;
    const input = [
      {
        id: 123,
        text: '  Hello Gemini  ',
        tags: [' Work ', 'work', 99, '', null],
        createdAt: '42',
        updatedAt: '100',
        extra: { nested: true },
      },
      {
        text: '   ',
        createdAt: 77,
      },
      'invalid',
    ];

    expect(sanitizePromptItems(input, now)).toEqual([
      {
        id: '123',
        text: 'Hello Gemini',
        tags: ['work', '99'],
        createdAt: 42,
        updatedAt: 100,
      },
    ]);
  });

  it('creates fallback ids and timestamps for legacy prompt items', () => {
    const now = 1700000000000;
    const input = [{ text: 'Legacy prompt', tags: ['Tag'] }];

    expect(sanitizePromptItems(input, now)).toEqual([
      {
        id: 'prompt-1700000000000-0',
        text: 'Legacy prompt',
        tags: ['tag'],
        createdAt: now,
      },
    ]);
  });

  it('normalizes gvPromptItems writes only', () => {
    const promptValue = normalizePromptStorageValue(StorageKeys.PROMPT_ITEMS, [
      { text: '  Prompt  ', tags: ['Tag'] },
    ]);
    const otherValue = normalizePromptStorageValue(StorageKeys.CHAT_WIDTH, {
      maxWidth: '800px',
    });

    expect(promptValue).toEqual([
      {
        id: expect.stringMatching(/^prompt-/),
        text: 'Prompt',
        tags: ['tag'],
        createdAt: expect.any(Number),
      },
    ]);
    expect(otherValue).toEqual({ maxWidth: '800px' });
  });

  it('detects nested context-invalidated storage errors', () => {
    const error = new StorageError(
      ErrorCode.STORAGE_WRITE_FAILED,
      'Failed to write key: gvPromptItems',
      { key: StorageKeys.PROMPT_ITEMS },
      new Error('Extension context invalidated.'),
    );

    expect(isPromptStorageContextInvalidated(error)).toBe(true);
    expect(isPromptStorageContextInvalidated(new Error('Network timeout'))).toBe(false);
  });
});

