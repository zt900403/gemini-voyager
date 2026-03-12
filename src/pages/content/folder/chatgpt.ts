import { getCurrentProvider } from '@/core/providers';
import { DataBackupService } from '@/core/services/DataBackupService';
import { StorageKeys } from '@/core/types/common';
import { getProviderStorageKey } from '@/core/utils/providerStorage';

import { FOLDER_COLORS, getFolderColor, isDarkMode } from './folderColors';
import {
  type IFolderStorageAdapter,
  createFolderStorageAdapter,
} from './storage/FolderStorageAdapter';
import type { ConversationReference, Folder, FolderData } from './types';

const ROOT_CONVERSATIONS_ID = '__root_conversations__';
const STYLE_ID = 'gv-chatgpt-folder-style';
const FOLDER_ICON_MASK = createSvgMaskUrl(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="black" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.75 6.25A2.25 2.25 0 0 1 5 4h2.514a2.25 2.25 0 0 1 1.591.659l1.236 1.237a2.25 2.25 0 0 0 1.59.659H15A2.25 2.25 0 0 1 17.25 8.75v5A2.25 2.25 0 0 1 15 16H5A2.25 2.25 0 0 1 2.75 13.75z"/></svg>',
);
const CHAT_ICON_MASK = createSvgMaskUrl(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="black" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.75 5.25h10.5A1.75 1.75 0 0 1 17 7v5.25A1.75 1.75 0 0 1 15.25 14H9l-3.25 2V14h-1A1.75 1.75 0 0 1 3 12.25V7a1.75 1.75 0 0 1 1.75-1.75Z"/></svg>',
);
const DELETE_ICON_MASK = createSvgMaskUrl(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="black" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6.25 6.25h7.5l-.6 8.1a1.5 1.5 0 0 1-1.49 1.4H8.34a1.5 1.5 0 0 1-1.49-1.4z"/><path d="M5 6.25h10"/><path d="M8 6.25V4.9a.9.9 0 0 1 .9-.9h2.2a.9.9 0 0 1 .9.9v1.35"/><path d="M8.75 8.75v4.25"/><path d="M11.25 8.75v4.25"/></svg>',
);

type DragConversationPayload = ConversationReference & {
  sourceFolderId?: string;
};

function createSvgMaskUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function createEmptyFolderData(): FolderData {
  return { folders: [], folderContents: { [ROOT_CONVERSATIONS_ID]: [] } };
}

function isFolderData(value: unknown): value is FolderData {
  if (typeof value !== 'object' || value === null) return false;
  const data = value as Record<string, unknown>;
  return Array.isArray(data.folders) && typeof data.folderContents === 'object';
}

function normalizeTitle(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned || 'Untitled conversation';
}

function uid(): string {
  return `chatgpt-folder-${Math.random().toString(36).slice(2, 10)}`;
}

function byPinnedAndName(a: Folder, b: Folder): number {
  const pinDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
  if (pinDiff !== 0) return pinDiff;

  const aIdx = a.sortIndex ?? Number.MAX_SAFE_INTEGER;
  const bIdx = b.sortIndex ?? Number.MAX_SAFE_INTEGER;
  if (aIdx !== bIdx) return aIdx - bIdx;

  return a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

export class ChatGPTFolderManager {
  private readonly provider = getCurrentProvider();
  private readonly storageKey = getProviderStorageKey('chatgpt', StorageKeys.FOLDER_DATA);
  private readonly storage: IFolderStorageAdapter;
  private readonly backupService: DataBackupService<FolderData>;

  private data: FolderData = createEmptyFolderData();
  private sidebarContainer: HTMLElement | null = null;
  private folderRoot: HTMLElement | null = null;
  private sidebarObserver: MutationObserver | null = null;
  private mountRetryTimer: number | null = null;
  private menuElement: HTMLElement | null = null;
  private colorPickerElement: HTMLElement | null = null;
  private outsideClickHandler: ((event: MouseEvent) => void) | null = null;
  private inlineEditorCleanup: (() => void) | null = null;
  private confirmDialogCleanup: (() => void) | null = null;

  constructor() {
    this.storage = createFolderStorageAdapter();
    this.backupService = new DataBackupService<FolderData>('chatgpt-folders', isFolderData);
  }

  async init(): Promise<void> {
    if (this.provider.id !== 'chatgpt') return;

    await this.storage.init(this.storageKey);
    this.backupService.setupBeforeUnloadBackup(() => this.data);
    const loaded = await this.storage.loadData(this.storageKey);
    this.data = loaded && isFolderData(loaded) ? loaded : createEmptyFolderData();

    await this.waitForSidebar();
    if (!this.sidebarContainer) return;

    this.injectStyles();
    this.render();
    this.observeSidebar();
  }

  destroy(): void {
    this.sidebarObserver?.disconnect();
    this.sidebarObserver = null;

    if (this.mountRetryTimer) {
      window.clearTimeout(this.mountRetryTimer);
      this.mountRetryTimer = null;
    }

    this.detachFloatingUI();
    this.clearTransientInlineUi();
    this.folderRoot?.remove();
    this.folderRoot = null;
  }

  private findSidebarContainer(): HTMLElement | null {
    return (
      this.provider.sidebar.list
        .map((selector) => document.querySelector(selector))
        .find((element): element is HTMLElement => element instanceof HTMLElement) ?? null
    );
  }

  private async waitForSidebar(): Promise<void> {
    if (this.sidebarContainer?.isConnected) return;

    await new Promise<void>((resolve) => {
      const tryResolve = () => {
        const container = this.findSidebarContainer();
        if (container) {
          this.sidebarContainer = container;
          resolve();
          return;
        }
        this.mountRetryTimer = window.setTimeout(tryResolve, 300);
      };

      tryResolve();
    });
  }

  private injectStyles(): void {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .gv-chatgpt-folders,
      .gv-chatgpt-folder-menu,
      .gv-chatgpt-color-picker,
      .gv-chatgpt-folder-confirm-dialog {
        --gv-folder-bg: rgba(255, 255, 255, 0.7);
        --gv-folder-border: rgba(15, 23, 42, 0.08);
        --gv-folder-text: #111827;
        --gv-folder-muted: #6b7280;
        --gv-folder-hover: rgba(16, 163, 127, 0.08);
        --gv-folder-active: rgba(16, 163, 127, 0.12);
        --gv-folder-danger: #ef4444;
        --gv-folder-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
        color: var(--gv-folder-text);
      }

      .gv-chatgpt-folders {
        margin: 6px 8px 10px;
        padding: 0;
        font-size: 13px;
      }

      .gv-chatgpt-folder-menu,
      .gv-chatgpt-color-picker,
      .gv-chatgpt-folder-confirm-dialog {
        font-size: 13px;
      }

      html.dark .gv-chatgpt-folders,
      html.dark .gv-chatgpt-folder-menu,
      html.dark .gv-chatgpt-color-picker,
      html.dark .gv-chatgpt-folder-confirm-dialog,
      [data-theme='dark'] .gv-chatgpt-folders,
      [data-theme='dark'] .gv-chatgpt-folder-menu,
      [data-theme='dark'] .gv-chatgpt-color-picker,
      [data-theme='dark'] .gv-chatgpt-folder-confirm-dialog,
      [data-color-scheme='dark'] .gv-chatgpt-folders,
      [data-color-scheme='dark'] .gv-chatgpt-folder-menu,
      [data-color-scheme='dark'] .gv-chatgpt-color-picker,
      [data-color-scheme='dark'] .gv-chatgpt-folder-confirm-dialog,
      body.dark .gv-chatgpt-folders,
      body.dark .gv-chatgpt-folder-menu,
      body.dark .gv-chatgpt-color-picker,
      body.dark .gv-chatgpt-folder-confirm-dialog {
        --gv-folder-bg: rgba(255, 255, 255, 0.04);
        --gv-folder-border: rgba(255, 255, 255, 0.08);
        --gv-folder-text: #ececec;
        --gv-folder-muted: #a1a1aa;
        --gv-folder-hover: rgba(255, 255, 255, 0.07);
        --gv-folder-active: rgba(16, 163, 127, 0.18);
        --gv-folder-danger: #f87171;
        --gv-folder-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
      }

      .gv-chatgpt-folder-panel {
        border: 1px solid var(--gv-folder-border);
        border-radius: 14px;
        background: var(--gv-folder-bg);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        overflow: hidden;
      }

      .gv-chatgpt-folder-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px;
        border-bottom: 1px solid var(--gv-folder-border);
      }

      .gv-chatgpt-folder-title {
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--gv-folder-muted);
        font-weight: 700;
      }

      .gv-chatgpt-folder-toolbar {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .gv-chatgpt-folder-btn {
        border: 0;
        background: transparent;
        color: var(--gv-folder-muted);
        width: 28px;
        height: 28px;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }

      .gv-chatgpt-folder-btn:hover,
      .gv-chatgpt-folder-menu-item:hover,
      .gv-chatgpt-folder-row:hover,
      .gv-chatgpt-folder-conversation:hover,
      .gv-chatgpt-folder-row.gv-drag-over {
        background: var(--gv-folder-hover);
        color: var(--gv-folder-text);
      }

      .gv-chatgpt-folder-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px;
      }

      .gv-chatgpt-folder-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .gv-chatgpt-folder-row {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 34px;
        border-radius: 10px;
        padding: 0 8px;
        position: relative;
      }

      .gv-chatgpt-folder-row-main {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1;
      }

      .gv-chatgpt-folders .google-symbols,
      .gv-chatgpt-folder-menu .google-symbols,
      .gv-chatgpt-color-picker .google-symbols {
        font-family: inherit !important;
        font-weight: 400;
        font-size: 0;
        line-height: 18px;
        display: inline-flex;
        width: 18px;
        height: 18px;
        overflow: hidden;
        align-items: center;
        justify-content: center;
        vertical-align: middle;
      }

      .gv-chatgpt-folders .google-symbols::before,
      .gv-chatgpt-folder-menu .google-symbols::before,
      .gv-chatgpt-color-picker .google-symbols::before {
        display: block;
        width: 18px;
        height: 18px;
        line-height: 18px;
        text-align: center;
        font-size: 14px;
      }

      .gv-chatgpt-folders .google-symbols[data-icon='expand_more']::before,
      .gv-chatgpt-folder-menu .google-symbols[data-icon='expand_more']::before,
      .gv-chatgpt-color-picker .google-symbols[data-icon='expand_more']::before {
        content: '▾';
      }

      .gv-chatgpt-folders .google-symbols[data-icon='chevron_right']::before,
      .gv-chatgpt-folder-menu .google-symbols[data-icon='chevron_right']::before,
      .gv-chatgpt-color-picker .google-symbols[data-icon='chevron_right']::before {
        content: '▸';
      }

      .gv-chatgpt-folders .google-symbols[data-icon='folder']::before,
      .gv-chatgpt-folder-menu .google-symbols[data-icon='folder']::before,
      .gv-chatgpt-color-picker .google-symbols[data-icon='folder']::before {
        content: '';
        width: 16px;
        height: 16px;
        margin: 1px auto 0;
        background-color: currentColor;
        -webkit-mask-image: ${FOLDER_ICON_MASK};
        mask-image: ${FOLDER_ICON_MASK};
        -webkit-mask-position: center;
        mask-position: center;
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-size: contain;
        mask-size: contain;
      }

      .gv-chatgpt-folders .google-symbols[data-icon='chat']::before,
      .gv-chatgpt-folder-menu .google-symbols[data-icon='chat']::before,
      .gv-chatgpt-color-picker .google-symbols[data-icon='chat']::before {
        content: '';
        width: 16px;
        height: 16px;
        margin: 1px auto 0;
        background-color: currentColor;
        -webkit-mask-image: ${CHAT_ICON_MASK};
        mask-image: ${CHAT_ICON_MASK};
        -webkit-mask-position: center;
        mask-position: center;
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-size: contain;
        mask-size: contain;
      }

      .gv-chatgpt-folders .google-symbols[data-icon='push_pin']::before,
      .gv-chatgpt-folder-menu .google-symbols[data-icon='push_pin']::before,
      .gv-chatgpt-color-picker .google-symbols[data-icon='push_pin']::before {
        content: '⌖';
        font-size: 13px;
      }

      .gv-chatgpt-folders .google-symbols[data-icon='more_vert']::before,
      .gv-chatgpt-folder-menu .google-symbols[data-icon='more_vert']::before,
      .gv-chatgpt-color-picker .google-symbols[data-icon='more_vert']::before {
        content: '⋮';
        font-size: 16px;
      }

      .gv-chatgpt-folders .google-symbols[data-icon='add']::before,
      .gv-chatgpt-folder-menu .google-symbols[data-icon='add']::before,
      .gv-chatgpt-color-picker .google-symbols[data-icon='add']::before {
        content: '+';
        font-size: 16px;
      }

      .gv-chatgpt-folders .google-symbols[data-icon='subdirectory_arrow_right']::before,
      .gv-chatgpt-folder-menu .google-symbols[data-icon='subdirectory_arrow_right']::before,
      .gv-chatgpt-color-picker .google-symbols[data-icon='subdirectory_arrow_right']::before {
        content: '↳';
        font-size: 14px;
      }

      .gv-chatgpt-folders .google-symbols[data-icon='edit']::before,
      .gv-chatgpt-folder-menu .google-symbols[data-icon='edit']::before,
      .gv-chatgpt-color-picker .google-symbols[data-icon='edit']::before {
        content: '✎';
        font-size: 14px;
      }

      .gv-chatgpt-folders .google-symbols[data-icon='palette']::before,
      .gv-chatgpt-folder-menu .google-symbols[data-icon='palette']::before,
      .gv-chatgpt-color-picker .google-symbols[data-icon='palette']::before {
        content: '◌';
        font-size: 14px;
      }

      .gv-chatgpt-folders .google-symbols[data-icon='delete']::before,
      .gv-chatgpt-folder-menu .google-symbols[data-icon='delete']::before,
      .gv-chatgpt-color-picker .google-symbols[data-icon='delete']::before {
        content: '';
        width: 16px;
        height: 16px;
        margin: 1px auto 0;
        background-color: currentColor;
        -webkit-mask-image: ${DELETE_ICON_MASK};
        mask-image: ${DELETE_ICON_MASK};
        -webkit-mask-position: center;
        mask-position: center;
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-size: contain;
        mask-size: contain;
      }

      .gv-chatgpt-folders .google-symbols[data-icon='close']::before,
      .gv-chatgpt-folder-menu .google-symbols[data-icon='close']::before,
      .gv-chatgpt-color-picker .google-symbols[data-icon='close']::before {
        content: '×';
        font-size: 14px;
      }

      .gv-chatgpt-folders .google-symbols[data-icon='check']::before,
      .gv-chatgpt-folder-menu .google-symbols[data-icon='check']::before,
      .gv-chatgpt-color-picker .google-symbols[data-icon='check']::before {
        content: '✓';
        font-size: 14px;
      }

      .gv-chatgpt-folder-chevron,
      .gv-chatgpt-folder-icon,
      .gv-chatgpt-conversation-icon,
      .gv-chatgpt-folder-menu-icon,
      .gv-chatgpt-folder-pin {
        color: var(--gv-folder-muted);
        flex: 0 0 18px;
      }

      .gv-chatgpt-folder-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 13px;
        font-weight: 500;
      }

      .gv-chatgpt-folder-meta {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--gv-folder-muted);
        flex: 0 0 auto;
      }

      .gv-chatgpt-folder-count {
        font-size: 11px;
      }

      .gv-chatgpt-folder-pin {
        flex-basis: 14px;
        width: 14px;
        height: 14px;
      }

      .gv-chatgpt-folder-body {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .gv-chatgpt-folder-children {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .gv-chatgpt-folder-conversation {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 32px;
        border-radius: 10px;
        padding: 0 8px;
        cursor: pointer;
        color: inherit;
      }

      .gv-chatgpt-folder-conversation-title {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
      }

      .gv-chatgpt-folder-inline-input,
      .gv-chatgpt-folder-rename-inline {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 34px;
        margin: 2px 0;
        padding: 4px 6px;
        border: 1px solid var(--gv-folder-border);
        border-radius: 10px;
        background: var(--gv-folder-bg);
      }

      .gv-chatgpt-folder-rename-inline {
        flex: 1;
        min-width: 0;
        margin: 0;
        padding: 2px 4px;
      }

      .gv-chatgpt-folder-name-input {
        flex: 1;
        min-width: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--gv-folder-text);
        font-size: 12px;
        line-height: 1.4;
      }

      .gv-chatgpt-folder-name-input::placeholder {
        color: var(--gv-folder-muted);
      }

      .gv-chatgpt-folder-inline-btn {
        width: 24px;
        height: 24px;
        border-radius: 7px;
      }

      .gv-chatgpt-folder-hidden {
        display: none !important;
      }

      .gv-chatgpt-folder-confirm-dialog {
        position: fixed;
        min-width: 220px;
        max-width: min(280px, calc(100vw - 16px));
        padding: 12px;
        border-radius: 12px;
        border: 1px solid var(--gv-folder-border);
        background: var(--gv-folder-bg);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        box-shadow: var(--gv-folder-shadow);
        z-index: 2147483647;
      }

      .gv-chatgpt-folder-confirm-header {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .gv-chatgpt-folder-confirm-icon {
        color: var(--gv-folder-danger);
      }

      .gv-chatgpt-folder-confirm-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--gv-folder-text);
      }

      .gv-chatgpt-folder-confirm-message {
        font-size: 12px;
        line-height: 1.45;
        color: var(--gv-folder-muted);
        margin-top: 8px;
      }

      .gv-chatgpt-folder-confirm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 12px;
      }

      .gv-chatgpt-folder-confirm-btn {
        appearance: none;
        -webkit-appearance: none;
        border: 1px solid var(--gv-folder-border);
        background-color: transparent;
        color: var(--gv-folder-text);
        min-height: 30px;
        padding: 0 12px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 500;
      }

      .gv-chatgpt-folder-confirm-btn:hover {
        background-color: var(--gv-folder-hover);
      }

      .gv-chatgpt-folder-confirm-yes {
        border-color: transparent !important;
        background-color: var(--gv-folder-danger) !important;
        color: #fff !important;
        box-shadow: 0 6px 18px rgba(239, 68, 68, 0.25);
      }

      .gv-chatgpt-folder-confirm-yes:hover {
        opacity: 0.92;
        background-color: var(--gv-folder-danger);
      }

      .gv-chatgpt-folder-confirm-no {
        background-color: transparent;
      }

      .gv-chatgpt-folder-menu,
      .gv-chatgpt-color-picker {
        position: fixed;
        min-width: 180px;
        padding: 6px;
        border-radius: 12px;
        border: 1px solid var(--gv-folder-border);
        background: var(--gv-folder-bg);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        box-shadow: var(--gv-folder-shadow);
        z-index: 2147483647;
      }

      .gv-chatgpt-folder-menu-item {
        width: 100%;
        border: 0;
        background: transparent;
        color: var(--gv-folder-text);
        min-height: 34px;
        border-radius: 8px;
        padding: 0 10px;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        text-align: left;
      }

      .gv-chatgpt-folder-menu-item-danger {
        color: var(--gv-folder-danger);
      }

      .gv-chatgpt-color-picker-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }

      .gv-chatgpt-color-picker-item {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border: 2px solid transparent;
        cursor: pointer;
      }

      .gv-chatgpt-color-picker-item[data-selected='true'] {
        border-color: var(--gv-folder-text);
      }

      .gv-chatgpt-native-hidden {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  private observeSidebar(): void {
    if (!this.sidebarContainer) return;

    this.sidebarObserver?.disconnect();
    this.sidebarObserver = new MutationObserver(() => {
      const nextSidebar = this.findSidebarContainer();
      if (nextSidebar && nextSidebar !== this.sidebarContainer) {
        this.sidebarContainer = nextSidebar;
        this.observeSidebar();
        this.render();
        return;
      }

      if (this.folderRoot && !this.folderRoot.isConnected) {
        this.render();
        return;
      }

      this.decorateNativeConversationLinks();
      this.updateNativeConversationVisibility();
    });

    this.sidebarObserver.observe(this.sidebarContainer, {
      childList: true,
      subtree: true,
    });

    this.decorateNativeConversationLinks();
    this.updateNativeConversationVisibility();
  }

  private render(): void {
    if (!this.sidebarContainer) return;

    this.detachFloatingUI();
    this.clearTransientInlineUi();
    this.folderRoot?.remove();
    this.folderRoot = document.createElement('section');
    this.folderRoot.className = 'gv-chatgpt-folders';

    const panel = document.createElement('div');
    panel.className = 'gv-chatgpt-folder-panel';
    this.folderRoot.appendChild(panel);

    const header = document.createElement('div');
    header.className = 'gv-chatgpt-folder-header';
    panel.appendChild(header);

    const title = document.createElement('div');
    title.className = 'gv-chatgpt-folder-title';
    title.textContent = 'Voyager folders';
    header.appendChild(title);

    const toolbar = document.createElement('div');
    toolbar.className = 'gv-chatgpt-folder-toolbar';
    header.appendChild(toolbar);

    const addButton = this.createButton(this.createIconSpan('add'), 'Create folder');
    addButton.addEventListener('click', () => this.promptCreateFolder(null));
    toolbar.appendChild(addButton);

    const list = document.createElement('div');
    list.className = 'gv-chatgpt-folder-list';
    panel.appendChild(list);

    for (const folder of this.getRootFolders()) {
      list.appendChild(this.renderFolder(folder, 0));
    }

    const host = this.sidebarContainer;
    host.insertBefore(this.folderRoot, host.firstElementChild);
    this.decorateNativeConversationLinks();
    this.updateNativeConversationVisibility();
  }

  private renderFolder(folder: Folder, level: number): HTMLElement {
    const item = document.createElement('div');
    item.className = 'gv-chatgpt-folder-item';
    item.dataset.folderId = folder.id;
    item.dataset.expanded = folder.isExpanded === false ? 'false' : 'true';

    const row = document.createElement('div');
    row.className = 'gv-chatgpt-folder-row';
    row.style.paddingLeft = `${8 + level * 18}px`;
    item.appendChild(row);
    this.attachDropTarget(row, (conversation) => {
      this.moveConversationToFolder(folder.id, conversation);
    });

    const main = document.createElement('div');
    main.className = 'gv-chatgpt-folder-row-main';
    row.appendChild(main);

    const toggleButton = this.createButton(
      this.createIconSpan(folder.isExpanded !== false ? 'expand_more' : 'chevron_right'),
      folder.isExpanded === false ? 'Expand folder' : 'Collapse folder',
    );
    toggleButton.classList.add('gv-chatgpt-folder-btn-toggle');
    toggleButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.toggleFolderExpanded(folder.id);
    });
    main.appendChild(toggleButton);

    const folderIcon = this.createIconSpan('folder');
    if (folder.color && folder.color !== 'default') {
      folderIcon.style.color = getFolderColor(folder.color, isDarkMode());
    }
    folderIcon.classList.add('gv-chatgpt-folder-icon');
    main.appendChild(folderIcon);

    const name = document.createElement('div');
    name.className = 'gv-chatgpt-folder-name';
    name.textContent = folder.name;
    name.addEventListener('dblclick', (event) => {
      event.stopPropagation();
      this.renameFolder(folder.id);
    });
    main.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'gv-chatgpt-folder-meta';
    row.appendChild(meta);

    if (folder.pinned) {
      const pin = this.createIconSpan('push_pin');
      pin.classList.add('gv-chatgpt-folder-pin');
      meta.appendChild(pin);
    }

    const count = document.createElement('span');
    count.className = 'gv-chatgpt-folder-count';
    count.textContent = String((this.data.folderContents[folder.id] || []).length);
    meta.appendChild(count);

    const moreButton = this.createButton(this.createIconSpan('more_vert'), 'Folder actions');
    moreButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.openFolderMenu(event, folder.id);
    });
    meta.appendChild(moreButton);

    const body = document.createElement('div');
    body.className = 'gv-chatgpt-folder-body';
    body.hidden = folder.isExpanded === false;
    item.appendChild(body);

    const conversations = this.getFolderConversations(folder.id);
    for (const conversation of conversations) {
      body.appendChild(this.renderConversation(folder, conversation, level));
    }

    if (level === 0) {
      const subfolders = this.getChildFolders(folder.id);
      if (subfolders.length > 0) {
        const children = document.createElement('div');
        children.className = 'gv-chatgpt-folder-children';
        for (const child of subfolders) {
          children.appendChild(this.renderFolder(child, level + 1));
        }
        body.appendChild(children);
      }
    }

    return item;
  }

  private renderConversation(
    folder: Folder,
    conversation: ConversationReference,
    level: number,
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = 'gv-chatgpt-folder-conversation';
    row.draggable = true;
    row.style.paddingLeft = `${34 + level * 18}px`;
    row.addEventListener('click', () => this.navigateToConversation(conversation));
    row.addEventListener('dragstart', (event) => {
      this.setConversationDragPayload(event, {
        ...conversation,
        sourceFolderId: folder.id,
      });
    });

    const icon = this.createIconSpan('chat');
    icon.classList.add('gv-chatgpt-conversation-icon');
    row.appendChild(icon);

    const title = document.createElement('div');
    title.className = 'gv-chatgpt-folder-conversation-title';
    title.textContent = conversation.title;
    row.appendChild(title);

    const removeButton = this.createButton(this.createIconSpan('close'), 'Remove from folder');
    removeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.removeConversationFromFolder(folder.id, conversation.conversationId);
    });
    row.appendChild(removeButton);

    return row;
  }

  private openFolderMenu(event: MouseEvent, folderId: string): void {
    this.clearTransientInlineUi();
    this.detachFloatingUI();

    const folder = this.data.folders.find((item) => item.id === folderId);
    if (!folder) return;

    const menu = document.createElement('div');
    menu.className = 'gv-chatgpt-folder-menu';

    const addItem = (
      label: string,
      icon: HTMLElement,
      action: () => void,
      danger = false,
    ): void => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `gv-chatgpt-folder-menu-item${danger ? ' gv-chatgpt-folder-menu-item-danger' : ''}`;
      icon.classList.add('gv-chatgpt-folder-menu-icon');
      button.appendChild(icon);
      const text = document.createElement('span');
      text.textContent = label;
      button.appendChild(text);
      button.addEventListener('click', () => {
        this.detachFloatingUI();
        action();
      });
      menu.appendChild(button);
    };

    addItem(folder.pinned ? 'Unpin folder' : 'Pin folder', this.createIconSpan('push_pin'), () => {
      this.togglePinFolder(folderId);
    });

    if (!folder.parentId) {
      addItem('Create subfolder', this.createIconSpan('subdirectory_arrow_right'), () => {
        this.promptCreateFolder(folderId);
      });
    }

    addItem('Rename', this.createIconSpan('edit'), () => this.renameFolder(folderId));
    addItem('Color', this.createIconSpan('palette'), () => this.openColorPicker(folderId, event));
    addItem('Delete', this.createIconSpan('delete'), () => this.deleteFolder(folderId), true);

    document.body.appendChild(menu);
    this.positionFloatingElement(menu, event.clientX, event.clientY);
    this.menuElement = menu;
    this.bindOutsideClickHandler(menu);
  }

  private openColorPicker(folderId: string, event: MouseEvent): void {
    this.clearTransientInlineUi();
    this.detachFloatingUI();

    const folder = this.data.folders.find((item) => item.id === folderId);
    if (!folder) return;

    const picker = document.createElement('div');
    picker.className = 'gv-chatgpt-color-picker';

    const grid = document.createElement('div');
    grid.className = 'gv-chatgpt-color-picker-grid';
    picker.appendChild(grid);

    for (const colorConfig of FOLDER_COLORS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gv-chatgpt-color-picker-item';
      button.style.backgroundColor = getFolderColor(colorConfig.id, isDarkMode());
      button.dataset.selected =
        String(folder.color === colorConfig.id || (!folder.color && colorConfig.id === 'default'));
      button.title = colorConfig.id;
      button.addEventListener('click', () => {
        this.changeFolderColor(folderId, colorConfig.id);
        this.detachFloatingUI();
      });
      grid.appendChild(button);
    }

    document.body.appendChild(picker);
    this.positionFloatingElement(picker, event.clientX + 8, event.clientY + 8);
    this.colorPickerElement = picker;
    this.bindOutsideClickHandler(picker);
  }

  private positionFloatingElement(element: HTMLElement, clientX: number, clientY: number): void {
    const viewportPadding = 8;
    const rect = element.getBoundingClientRect();
    const left = Math.min(clientX, window.innerWidth - rect.width - viewportPadding);
    const top = Math.min(clientY, window.innerHeight - rect.height - viewportPadding);
    element.style.left = `${Math.max(viewportPadding, left)}px`;
    element.style.top = `${Math.max(viewportPadding, top)}px`;
  }

  private bindOutsideClickHandler(element: HTMLElement): void {
    this.outsideClickHandler = (event: MouseEvent) => {
      if (event.target instanceof Node && !element.contains(event.target)) {
        this.detachFloatingUI();
      }
    };
    window.addEventListener('click', this.outsideClickHandler, true);
  }

  private detachFloatingUI(): void {
    this.menuElement?.remove();
    this.menuElement = null;
    this.colorPickerElement?.remove();
    this.colorPickerElement = null;
    if (this.outsideClickHandler) {
      window.removeEventListener('click', this.outsideClickHandler, true);
      this.outsideClickHandler = null;
    }
  }

  private promptCreateFolder(parentId: string | null): void {
    this.clearTransientInlineUi();
    this.detachFloatingUI();

    const inputContainer = document.createElement('div');
    inputContainer.className = 'gv-chatgpt-folder-inline-input';
    if (parentId) {
      inputContainer.style.marginLeft = '26px';
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'gv-chatgpt-folder-name-input';
    input.placeholder = parentId ? 'Subfolder name' : 'Folder name';
    input.maxLength = 50;

    const saveButton = this.createButton(this.createIconSpan('check'), 'Save');
    saveButton.classList.add('gv-chatgpt-folder-inline-btn');

    const cancelButton = this.createButton(this.createIconSpan('close'), 'Cancel');
    cancelButton.classList.add('gv-chatgpt-folder-inline-btn');

    inputContainer.appendChild(input);
    inputContainer.appendChild(saveButton);
    inputContainer.appendChild(cancelButton);

    const cleanup = () => {
      inputContainer.remove();
      if (this.inlineEditorCleanup === cleanup) {
        this.inlineEditorCleanup = null;
      }
    };

    const save = () => {
      const name = input.value.trim();
      if (!name) {
        cleanup();
        return;
      }

      if (parentId) {
        this.data.folders = this.data.folders.map((folder) =>
          folder.id === parentId
            ? { ...folder, isExpanded: true, updatedAt: Date.now() }
            : folder,
        );
      }

      cleanup();
      this.createFolder(name, parentId);
    };

    saveButton.addEventListener('click', save);
    cancelButton.addEventListener('click', cleanup);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') save();
      if (event.key === 'Escape') cleanup();
    });

    const inserted = this.insertInlineFolderInput(parentId, inputContainer);
    if (!inserted) return;

    this.inlineEditorCleanup = cleanup;
    input.focus();
  }

  private createFolder(name: string, parentId: string | null): void {
    const now = Date.now();
    const sortIndex = this.data.folders
      .filter((folder) => folder.parentId === parentId)
      .reduce((max, folder) => Math.max(max, folder.sortIndex ?? -1), -1);

    const folder: Folder = {
      id: uid(),
      name,
      parentId,
      isExpanded: true,
      sortIndex: sortIndex + 1,
      createdAt: now,
      updatedAt: now,
    };

    this.data.folders.push(folder);
    this.data.folderContents[folder.id] = [];
    void this.saveAndRender();
  }

  private renameFolder(folderId: string): void {
    this.clearTransientInlineUi();
    this.detachFloatingUI();

    const folder = this.data.folders.find((item) => item.id === folderId);
    if (!folder) return;

    const folderItem = this.folderRoot?.querySelector(`[data-folder-id="${folderId}"]`);
    const folderName = folderItem?.querySelector('.gv-chatgpt-folder-name');
    if (!(folderItem instanceof HTMLElement) || !(folderName instanceof HTMLElement)) return;

    const editor = document.createElement('span');
    editor.className = 'gv-chatgpt-folder-rename-inline';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'gv-chatgpt-folder-name-input';
    input.value = folder.name;
    input.maxLength = 50;

    const saveButton = this.createButton(this.createIconSpan('check'), 'Save');
    saveButton.classList.add('gv-chatgpt-folder-inline-btn');

    const cancelButton = this.createButton(this.createIconSpan('close'), 'Cancel');
    cancelButton.classList.add('gv-chatgpt-folder-inline-btn');

    editor.appendChild(input);
    editor.appendChild(saveButton);
    editor.appendChild(cancelButton);

    folderName.classList.add('gv-chatgpt-folder-hidden');
    folderName.insertAdjacentElement('afterend', editor);

    const cleanup = () => {
      editor.remove();
      folderName.classList.remove('gv-chatgpt-folder-hidden');
      if (this.inlineEditorCleanup === cleanup) {
        this.inlineEditorCleanup = null;
      }
    };

    const save = () => {
      const nextName = input.value.trim();
      if (!nextName) {
        cleanup();
        return;
      }

      folder.name = nextName;
      folder.updatedAt = Date.now();
      cleanup();
      void this.saveAndRender();
    };

    saveButton.addEventListener('click', save);
    cancelButton.addEventListener('click', cleanup);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') save();
      if (event.key === 'Escape') cleanup();
    });

    this.inlineEditorCleanup = cleanup;
    input.focus();
    input.select();
  }

  private deleteFolder(folderId: string): void {
    this.clearTransientInlineUi();
    this.detachFloatingUI();

    const folder = this.data.folders.find((item) => item.id === folderId);
    if (!folder) return;

    const anchor = this.folderRoot?.querySelector(`[data-folder-id="${folderId}"] .gv-chatgpt-folder-row`);
    const confirmDialog = document.createElement('div');
    confirmDialog.className = 'gv-chatgpt-folder-confirm-dialog';

    const header = document.createElement('div');
    header.className = 'gv-chatgpt-folder-confirm-header';
    confirmDialog.appendChild(header);

    const icon = this.createIconSpan('delete');
    icon.classList.add('gv-chatgpt-folder-confirm-icon');
    header.appendChild(icon);

    const title = document.createElement('div');
    title.className = 'gv-chatgpt-folder-confirm-title';
    title.textContent = 'Delete folder?';
    header.appendChild(title);

    const message = document.createElement('div');
    message.className = 'gv-chatgpt-folder-confirm-message';
    message.textContent = `"${folder.name}" and any subfolders will be removed from Voyager folders.`;
    confirmDialog.appendChild(message);

    const actions = document.createElement('div');
    actions.className = 'gv-chatgpt-folder-confirm-actions';
    confirmDialog.appendChild(actions);

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'gv-chatgpt-folder-confirm-btn gv-chatgpt-folder-confirm-no';
    cancelButton.textContent = 'Cancel';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'gv-chatgpt-folder-confirm-btn gv-chatgpt-folder-confirm-yes';
    deleteButton.textContent = 'Delete';

    actions.appendChild(cancelButton);
    actions.appendChild(deleteButton);
    document.body.appendChild(confirmDialog);

    const rect = anchor instanceof HTMLElement ? anchor.getBoundingClientRect() : null;
    const width = 220;
    const left = rect ? Math.min(rect.left + 24, window.innerWidth - width - 8) : 8;
    const top = rect ? Math.min(rect.bottom + 6, window.innerHeight - 96) : 8;
    confirmDialog.style.left = `${Math.max(8, left)}px`;
    confirmDialog.style.top = `${Math.max(8, top)}px`;

    const outsideClickHandler = (event: MouseEvent) => {
      if (event.target instanceof Node && !confirmDialog.contains(event.target)) {
        cleanup();
      }
    };

    const cleanup = () => {
      confirmDialog.remove();
      window.removeEventListener('click', outsideClickHandler, true);
      if (this.confirmDialogCleanup === cleanup) {
        this.confirmDialogCleanup = null;
      }
    };

    cancelButton.addEventListener('click', cleanup);
    deleteButton.addEventListener('click', () => {
      const descendantIds = this.getFolderAndDescendants(folderId);
      this.data.folders = this.data.folders.filter((item) => !descendantIds.includes(item.id));
      descendantIds.forEach((id) => {
        delete this.data.folderContents[id];
      });
      cleanup();
      void this.saveAndRender();
    });

    window.setTimeout(() => {
      window.addEventListener('click', outsideClickHandler, true);
    }, 0);

    this.confirmDialogCleanup = cleanup;
  }

  private getFolderAndDescendants(folderId: string): string[] {
    const ids = [folderId];
    const children = this.data.folders.filter((folder) => folder.parentId === folderId);
    for (const child of children) {
      ids.push(...this.getFolderAndDescendants(child.id));
    }
    return ids;
  }

  private toggleFolderExpanded(folderId: string): void {
    this.data.folders = this.data.folders.map((folder) =>
      folder.id === folderId
        ? { ...folder, isExpanded: !(folder.isExpanded !== false), updatedAt: Date.now() }
        : folder,
    );
    void this.saveAndRender();
  }

  private togglePinFolder(folderId: string): void {
    this.data.folders = this.data.folders.map((folder) =>
      folder.id === folderId
        ? { ...folder, pinned: !folder.pinned, updatedAt: Date.now() }
        : folder,
    );
    void this.saveAndRender();
  }

  private changeFolderColor(folderId: string, colorId: string): void {
    this.data.folders = this.data.folders.map((folder) =>
      folder.id === folderId ? { ...folder, color: colorId, updatedAt: Date.now() } : folder,
    );
    void this.saveAndRender();
  }

  private moveConversationToFolder(
    folderId: string,
    conversation: DragConversationPayload,
  ): void {
    if (conversation.sourceFolderId === folderId) return;
    if (conversation.sourceFolderId) {
      this.removeConversationFromFolder(conversation.sourceFolderId, conversation.conversationId, false);
    }
    this.addConversationToFolder(folderId, conversation);
  }

  private addConversationToFolder(folderId: string, conversation: DragConversationPayload): void {
    const nextItems = this.data.folderContents[folderId] || [];
    if (nextItems.some((item) => item.conversationId === conversation.conversationId)) return;

    this.data.folderContents[folderId] = [
      ...nextItems,
      { ...conversation, addedAt: Date.now() },
    ];

    this.data.folderContents[ROOT_CONVERSATIONS_ID] = (
      this.data.folderContents[ROOT_CONVERSATIONS_ID] || []
    ).filter((item) => item.conversationId !== conversation.conversationId);

    void this.saveAndRender();
  }

  private removeConversationFromFolder(
    folderId: string,
    conversationId: string,
    persist = true,
  ): void {
    const currentItems = this.data.folderContents[folderId] || [];
    const nextItems = currentItems.filter((item) => item.conversationId !== conversationId);
    if (nextItems.length === currentItems.length) return;
    this.data.folderContents[folderId] = nextItems;
    if (persist) void this.saveAndRender();
  }

  private navigateToConversation(conversation: ConversationReference): void {
    const target = document.querySelector(
      this.provider.sidebar.link
        .map((selector) => `${selector}[href*="${conversation.conversationId}"]`)
        .join(', '),
    );
    if (target instanceof HTMLElement) {
      target.click();
      return;
    }

    window.history.pushState({}, '', conversation.url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  private decorateNativeConversationLinks(): void {
    const links = this.collectNativeConversationLinks();
    for (const link of links) {
      this.attachNativeConversationDragSource(link);
    }
  }

  private attachNativeConversationDragSource(link: HTMLAnchorElement): void {
    const container = this.getNativeConversationContainer(link);
    const dragSource = container ?? link;
    if (dragSource.dataset.gvFolderDragBound === '1') return;

    dragSource.dataset.gvFolderDragBound = '1';
    dragSource.draggable = true;
    dragSource.addEventListener('dragstart', (event) => {
      const sourceLink =
        dragSource instanceof HTMLAnchorElement
          ? dragSource
          : (dragSource.querySelector('a[href]') as HTMLAnchorElement | null) || link;
      const conversation = this.extractConversationReference(sourceLink);
      if (!conversation) return;
      this.setConversationDragPayload(event, conversation);
    });
  }

  private collectNativeConversationLinks(): HTMLAnchorElement[] {
    return Array.from(
      document.querySelectorAll<HTMLAnchorElement>(this.provider.sidebar.link.join(', ')),
    ).filter((link) => !!this.extractConversationReference(link));
  }

  private extractConversationReference(link: HTMLAnchorElement): ConversationReference | null {
    const conversationId = this.provider.extractConversationIdFromUrl(link.href);
    if (!conversationId) return null;

    const title = normalizeTitle(link.textContent || link.getAttribute('title') || '');
    const url = link.href.startsWith('http')
      ? link.href
      : this.provider.buildConversationUrl(conversationId, window.location.origin);

    return {
      conversationId,
      title,
      url,
      addedAt: Date.now(),
    };
  }

  private getNativeConversationContainer(link: HTMLAnchorElement): HTMLElement | null {
    return (
      (link.closest('[data-testid^="history-item"], li, div[role="listitem"], a') as HTMLElement) ||
      null
    );
  }

  private setConversationDragPayload(event: DragEvent, conversation: DragConversationPayload): void {
    event.dataTransfer?.setData('application/json', JSON.stringify(conversation));
    event.dataTransfer?.setData('text/plain', conversation.title);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  private parseConversationPayload(event: DragEvent): DragConversationPayload | null {
    const payload = event.dataTransfer?.getData('application/json');
    if (!payload) return null;
    try {
      return JSON.parse(payload) as DragConversationPayload;
    } catch {
      return null;
    }
  }

  private attachDropTarget(
    element: HTMLElement,
    onDropConversation: (conversation: DragConversationPayload) => void,
  ): void {
    element.addEventListener('dragover', (event) => {
      event.preventDefault();
      element.classList.add('gv-drag-over');
    });

    element.addEventListener('dragleave', () => {
      element.classList.remove('gv-drag-over');
    });

    element.addEventListener('drop', (event) => {
      event.preventDefault();
      element.classList.remove('gv-drag-over');
      const conversation = this.parseConversationPayload(event);
      if (!conversation) return;
      onDropConversation(conversation);
    });
  }

  private getRootFolders(): Folder[] {
    return [...this.data.folders.filter((folder) => !folder.parentId)].sort(byPinnedAndName);
  }

  private getChildFolders(parentId: string): Folder[] {
    return [...this.data.folders.filter((folder) => folder.parentId === parentId)].sort(
      byPinnedAndName,
    );
  }

  private getFolderConversations(folderId: string): ConversationReference[] {
    return [...(this.data.folderContents[folderId] || [])].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }),
    );
  }

  private updateNativeConversationVisibility(): void {
    const organized = new Set(
      Object.entries(this.data.folderContents)
        .filter(([folderId]) => folderId !== ROOT_CONVERSATIONS_ID)
        .flatMap(([, items]) => items.map((item) => item.conversationId)),
    );

    for (const link of this.collectNativeConversationLinks()) {
      const conversationId = this.provider.extractConversationIdFromUrl(link.href);
      const container = this.getNativeConversationContainer(link) || link;
      if (!conversationId) continue;
      container.classList.toggle('gv-chatgpt-native-hidden', organized.has(conversationId));
    }
  }

  private createButton(icon: HTMLElement, title: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gv-chatgpt-folder-btn';
    button.title = title;
    button.appendChild(icon);
    return button;
  }

  private createIconSpan(icon: string): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = 'google-symbols';
    span.dataset.icon = icon;
    span.textContent = icon;
    return span;
  }

  private clearTransientInlineUi(): void {
    const cleanupEditor = this.inlineEditorCleanup;
    this.inlineEditorCleanup = null;
    cleanupEditor?.();

    const cleanupDialog = this.confirmDialogCleanup;
    this.confirmDialogCleanup = null;
    cleanupDialog?.();
  }

  private insertInlineFolderInput(parentId: string | null, inputContainer: HTMLElement): boolean {
    const list = this.folderRoot?.querySelector('.gv-chatgpt-folder-list');
    if (!(list instanceof HTMLElement)) return false;

    if (!parentId) {
      list.insertBefore(inputContainer, list.firstChild);
      return true;
    }

    const folderItem = list.querySelector(`[data-folder-id="${parentId}"]`);
    if (!(folderItem instanceof HTMLElement)) return false;

    const body = folderItem.querySelector('.gv-chatgpt-folder-body');
    if (body instanceof HTMLElement) {
      body.hidden = false;
      folderItem.dataset.expanded = 'true';
      body.insertBefore(inputContainer, body.firstChild);

      const toggleButton = folderItem.querySelector('.gv-chatgpt-folder-btn-toggle');
      const toggleIcon = toggleButton?.querySelector('.google-symbols');
      if (toggleButton instanceof HTMLButtonElement) {
        toggleButton.title = 'Collapse folder';
      }
      if (toggleIcon instanceof HTMLElement) {
        toggleIcon.dataset.icon = 'expand_more';
        toggleIcon.textContent = 'expand_more';
      }
      return true;
    }

    folderItem.appendChild(inputContainer);
    return true;
  }

  private async saveAndRender(): Promise<void> {
    this.backupService.createEmergencyBackup(this.data);
    await this.storage.saveData(this.storageKey, this.data);
    this.backupService.createPrimaryBackup(this.data);
    this.render();
  }
}

export async function startChatGPTFolderManager(): Promise<ChatGPTFolderManager | null> {
  try {
    const manager = new ChatGPTFolderManager();
    await manager.init();
    return manager;
  } catch (error) {
    console.error('[ChatGPTFolderManager] Start error:', error);
    return null;
  }
}
