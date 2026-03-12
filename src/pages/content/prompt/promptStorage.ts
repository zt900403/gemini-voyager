import type { PromptItem } from '@/core/types/sync';
import { StorageKeys, type StorageKey } from '@/core/types/common';
import { isExtensionContextInvalidatedError } from '@/core/utils/extensionContext';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    const normalized = String(value).trim();
    return normalized || null;
  }
  return null;
}

function normalizeTimestamp(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const tagValue of value) {
    const normalized = normalizeText(tagValue)?.toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    tags.push(normalized);
  }

  return tags;
}

function normalizePromptItem(value: unknown, index: number, now: number): PromptItem | null {
  const record = asRecord(value);
  if (!record) return null;

  const text = normalizeText(record.text);
  if (!text) return null;

  const createdAt = normalizeTimestamp(record.createdAt, now);
  const id = normalizeText(record.id) ?? `prompt-${createdAt}-${index}`;
  const updatedAt =
    record.updatedAt === undefined ? undefined : normalizeTimestamp(record.updatedAt, createdAt);

  return {
    id,
    text,
    tags: normalizeTags(record.tags),
    createdAt,
    ...(updatedAt === undefined ? {} : { updatedAt }),
  };
}

export function sanitizePromptItems(value: unknown, now: number = Date.now()): PromptItem[] {
  if (!Array.isArray(value)) return [];

  const items: PromptItem[] = [];

  value.forEach((item, index) => {
    const normalized = normalizePromptItem(item, index, now);
    if (normalized) {
      items.push(normalized);
    }
  });

  return items;
}

export function normalizePromptStorageValue<T>(key: StorageKey, value: T): T {
  if (key === StorageKeys.PROMPT_ITEMS) {
    return sanitizePromptItems(value) as T;
  }
  return value;
}

export function isPromptStorageContextInvalidated(error: unknown): boolean {
  if (isExtensionContextInvalidatedError(error)) {
    return true;
  }

  const record = asRecord(error);
  if (!record) return false;

  return (
    isExtensionContextInvalidatedError(record.originalError) ||
    isExtensionContextInvalidatedError(record.error)
  );
}

