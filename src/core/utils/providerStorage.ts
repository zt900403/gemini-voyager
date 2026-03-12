import { type StorageKey, StorageKeys } from '@/core/types/common';
import type { ProviderId } from '@/core/providers';

const PROVIDER_STORAGE_KEYS: Partial<Record<StorageKey, Partial<Record<ProviderId, string>>>> = {
  [StorageKeys.FOLDER_DATA]: {
    chatgpt: StorageKeys.FOLDER_DATA_CHATGPT,
  },
  [StorageKeys.TIMELINE_SCROLL_MODE]: {
    chatgpt: StorageKeys.TIMELINE_SCROLL_MODE_CHATGPT,
  },
  [StorageKeys.TIMELINE_HIDE_CONTAINER]: {
    chatgpt: StorageKeys.TIMELINE_HIDE_CONTAINER_CHATGPT,
  },
  [StorageKeys.TIMELINE_DRAGGABLE]: {
    chatgpt: StorageKeys.TIMELINE_DRAGGABLE_CHATGPT,
  },
  [StorageKeys.TIMELINE_POSITION]: {
    chatgpt: StorageKeys.TIMELINE_POSITION_CHATGPT,
  },
  [StorageKeys.TIMELINE_STARRED_MESSAGES]: {
    chatgpt: StorageKeys.TIMELINE_STARRED_MESSAGES_CHATGPT,
  },
  [StorageKeys.CHAT_WIDTH]: {
    chatgpt: StorageKeys.CHAT_WIDTH_CHATGPT,
  },
} as const;

export function getProviderStorageKey(
  providerId: ProviderId,
  storageKey: StorageKey,
): string {
  return PROVIDER_STORAGE_KEYS[storageKey]?.[providerId] ?? storageKey;
}

export function getProviderLocalStorageKey(providerId: ProviderId, key: string): string {
  return providerId === 'chatgpt' ? `${key}:chatgpt` : key;
}
