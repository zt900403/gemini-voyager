import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FolderData } from '../types';

const saveData = vi.fn().mockResolvedValue(true);
const loadData = vi.fn<() => Promise<FolderData | null>>();

vi.mock('../storage/FolderStorageAdapter', () => ({
  createFolderStorageAdapter: () => ({
    init: vi.fn().mockResolvedValue(undefined),
    loadData,
    saveData,
    removeData: vi.fn().mockResolvedValue(undefined),
    getBackendName: () => 'mock',
  }),
}));

vi.mock('@/core/services/DataBackupService', () => ({
  DataBackupService: class {
    setupBeforeUnloadBackup = vi.fn();
    createEmergencyBackup = vi.fn();
    createPrimaryBackup = vi.fn();
  },
}));

describe('ChatGPTFolderManager', () => {
  beforeEach(() => {
    vi.resetModules();
    saveData.mockClear();
    loadData.mockReset();
    localStorage.clear();

    Object.defineProperty(window, 'location', {
      value: {
        hostname: 'chatgpt.com',
        pathname: '/c/c-1',
        search: '',
        hash: '',
        href: 'https://chatgpt.com/c/c-1',
        origin: 'https://chatgpt.com',
      },
      writable: true,
      configurable: true,
    });
  });

  it('renders compact sidebar controls and supports inline delete confirmation', async () => {
    loadData.mockResolvedValue({
      folders: [
        {
          id: 'folder-1',
          name: 'Work',
          parentId: null,
          isExpanded: true,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      folderContents: {
        'folder-1': [
          {
            conversationId: 'c-1',
            title: 'Roadmap',
            url: 'https://chatgpt.com/c/c-1',
            addedAt: 1,
          },
        ],
        __root_conversations__: [],
      },
    });

    document.body.innerHTML = `
      <aside>
        <button type="button">New chat</button>
        <nav aria-label="Chat history">
          <div>最近</div>
          <a href="/c/c-1">Roadmap</a>
          <a href="/c/c-2">Specs</a>
        </nav>
      </aside>
    `;

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { startChatGPTFolderManager } = await import('../chatgpt');
    const manager = await startChatGPTFolderManager();

    expect(manager).not.toBeNull();
    expect(document.querySelector('.gv-chatgpt-folder-panel')).not.toBeNull();
    expect(document.querySelector('.gv-chatgpt-folder-conversation')).not.toBeNull();
    expect(document.querySelector('.gv-chatgpt-root-drop')).toBeNull();
    expect(document.querySelector('.gv-chatgpt-folder-drop')).toBeNull();
    const nav = document.querySelector('nav[aria-label="Chat history"]');
    const folderRoot = document.querySelector('.gv-chatgpt-folders');
    expect(folderRoot?.parentElement).toBe(nav);
    expect(nav?.firstElementChild).toBe(folderRoot);
    expect(document.querySelector('aside > .gv-chatgpt-folders')).toBeNull();

    (document.querySelector('[title="Folder actions"]') as HTMLButtonElement).click();
    (document.querySelector('.gv-chatgpt-folder-menu-item-danger') as HTMLButtonElement).click();
    expect(document.querySelector('.gv-chatgpt-folder-confirm-dialog')).not.toBeNull();
    expect(document.querySelector('.gv-chatgpt-folder-confirm-title')?.textContent).toContain(
      'Delete folder?',
    );
    expect(document.querySelector('.gv-chatgpt-folder-confirm-yes')?.textContent).toBe('Delete');
    (document.querySelector('.gv-chatgpt-folder-confirm-yes') as HTMLButtonElement).click();
    await Promise.resolve();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(saveData).toHaveBeenCalled();
    const savedData = saveData.mock.lastCall?.[1] as FolderData;
    expect(savedData.folders).toHaveLength(0);
    expect(savedData.folderContents['folder-1']).toBeUndefined();
    expect(
      document
        .querySelector('[href="/c/c-1"]')
        ?.closest('a')
        ?.classList.contains('gv-chatgpt-native-hidden'),
    ).toBe(false);
  });

  it('offers create subfolder and color actions in the folder menu without using native dialogs', async () => {
    loadData.mockResolvedValue({
      folders: [
        {
          id: 'folder-1',
          name: 'Work',
          parentId: null,
          isExpanded: true,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      folderContents: {
        'folder-1': [],
        __root_conversations__: [],
      },
    });

    document.body.innerHTML = `
      <aside>
        <nav aria-label="Chat history">
          <div>Recent</div>
          <a href="/c/c-1">Roadmap</a>
        </nav>
      </aside>
    `;

    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Child folder');
    const { startChatGPTFolderManager } = await import('../chatgpt');
    await startChatGPTFolderManager();

    (document.querySelector('[title="Folder actions"]') as HTMLButtonElement).click();
    const menuItems = Array.from(document.querySelectorAll('.gv-chatgpt-folder-menu-item')).map(
      (item) => item.textContent?.trim(),
    );
    expect(menuItems.some((item) => item?.includes('Create subfolder'))).toBe(true);
    expect(menuItems.some((item) => item?.includes('Color'))).toBe(true);

    (
      Array.from(document.querySelectorAll('.gv-chatgpt-folder-menu-item')).find(
        (item) => item.textContent?.includes('Create subfolder'),
      ) as HTMLButtonElement
    ).click();
    const input = document.querySelector('.gv-chatgpt-folder-name-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    input.value = 'Child folder';
    (document.querySelector('[title="Save"]') as HTMLButtonElement).click();
    await Promise.resolve();

    expect(promptSpy).not.toHaveBeenCalled();
    expect(saveData).toHaveBeenCalled();
    const savedData = saveData.mock.lastCall?.[1] as FolderData;
    expect(savedData.folders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Child folder',
          parentId: 'folder-1',
        }),
      ]),
    );
  });

  it('renames folders inline instead of using prompt', async () => {
    loadData.mockResolvedValue({
      folders: [
        {
          id: 'folder-1',
          name: 'Work',
          parentId: null,
          isExpanded: true,
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      folderContents: {
        'folder-1': [],
        __root_conversations__: [],
      },
    });

    document.body.innerHTML = `
      <aside>
        <nav aria-label="Chat history">
          <div>Recent</div>
          <a href="/c/c-1">Roadmap</a>
        </nav>
      </aside>
    `;

    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Renamed');
    const { startChatGPTFolderManager } = await import('../chatgpt');
    await startChatGPTFolderManager();

    (document.querySelector('[title="Folder actions"]') as HTMLButtonElement).click();
    (
      Array.from(document.querySelectorAll('.gv-chatgpt-folder-menu-item')).find(
        (item) => item.textContent?.includes('Rename'),
      ) as HTMLButtonElement
    ).click();

    const renameInput = document.querySelector('.gv-chatgpt-folder-rename-inline input');
    expect(renameInput).not.toBeNull();
    (renameInput as HTMLInputElement).value = 'Renamed';
    (document.querySelector('.gv-chatgpt-folder-rename-inline [title="Save"]') as HTMLButtonElement).click();
    await Promise.resolve();

    expect(promptSpy).not.toHaveBeenCalled();
    expect(saveData).toHaveBeenCalled();
    const savedData = saveData.mock.lastCall?.[1] as FolderData;
    expect(savedData.folders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'folder-1',
          name: 'Renamed',
        }),
      ]),
    );
  });

  it('uses theme-aware CSS variables instead of hard-coded light-mode colors', async () => {
    loadData.mockResolvedValue({
      folders: [],
      folderContents: { __root_conversations__: [] },
    });

    document.body.innerHTML = `
      <aside>
        <nav aria-label="Chat history">
          <div>Recent</div>
          <a href="/c/c-1">Roadmap</a>
        </nav>
      </aside>
    `;

    const { startChatGPTFolderManager } = await import('../chatgpt');
    await startChatGPTFolderManager();

    const style = document.getElementById('gv-chatgpt-folder-style');
    expect(style?.textContent).toContain('--gv-folder-bg');
    expect(style?.textContent).toContain("html.dark .gv-chatgpt-folders");
    expect(style?.textContent).toContain('.gv-chatgpt-folder-menu .google-symbols');
    expect(style?.textContent).toContain('-webkit-mask-image');
    expect(style?.textContent).toContain('.gv-chatgpt-folder-confirm-title');
    expect(style?.textContent).not.toContain('--gv-chatgpt-folder-card-bg');
    expect(style?.textContent).not.toContain("content: '□'");
    expect(style?.textContent).not.toContain("content: '◦'");
    expect(style?.textContent).not.toContain("content: '−'");
  });
});
