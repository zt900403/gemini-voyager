import { getCurrentProvider } from '@/core/providers';

import { startChatGPTFolderManager } from './chatgpt';
import { FolderManager } from './manager';

export async function startFolderManager(): Promise<FolderManager | null> {
  try {
    if (getCurrentProvider().id === 'chatgpt') {
      return (await startChatGPTFolderManager()) as unknown as FolderManager | null;
    }

    const manager = new FolderManager();
    await manager.init();
    return manager;
  } catch (error) {
    console.error('[FolderManager] Start error:', error);
    return null;
  }
}
