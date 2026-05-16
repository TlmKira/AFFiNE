import { BrowserWindow, WebContentsView, session } from 'electron';
import { nanoid } from 'nanoid';

import { logger } from '../logger';
import type { NamespaceHandlers } from '../type';
import {
  isAllowedResearchBrowserUrl,
  markResearchBrowserWebContents,
  unmarkResearchBrowserWebContents,
} from './web-contents';

type ResearchBrowserBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ResearchBrowserInstance = {
  id: string;
  ownerId: number;
  window: BrowserWindow;
  view: WebContentsView;
};

const instances = new Map<string, ResearchBrowserInstance>();

const getInstance = (
  e: Electron.IpcMainInvokeEvent,
  id: string
): ResearchBrowserInstance => {
  const instance = instances.get(id);
  if (!instance || instance.ownerId !== e.sender.id) {
    throw new Error('研究浏览器实例不存在');
  }
  return instance;
};

const normalizeUrl = (rawUrl: string) => {
  const value = rawUrl.trim();
  if (!value) {
    throw new Error('请输入网页地址');
  }

  const withProtocol = /^[a-z][a-z\d+\-.]*:/i.test(value)
    ? value
    : `https://${value}`;

  if (!isAllowedResearchBrowserUrl(withProtocol)) {
    throw new Error('研究浏览器只支持 http/https 网页');
  }

  return withProtocol;
};

const normalizeBounds = (bounds: ResearchBrowserBounds) => {
  const values = [bounds.x, bounds.y, bounds.width, bounds.height];
  if (!values.every(value => Number.isFinite(value))) {
    throw new Error('研究浏览器尺寸无效');
  }

  return {
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width: Math.max(0, Math.round(bounds.width)),
    height: Math.max(0, Math.round(bounds.height)),
  };
};

const destroyInstance = (id: string) => {
  const instance = instances.get(id);
  if (!instance) return;

  instances.delete(id);
  unmarkResearchBrowserWebContents(instance.view.webContents.id);

  try {
    if (instance.window.contentView.children.includes(instance.view)) {
      instance.window.contentView.removeChildView(instance.view);
    }
  } catch (error) {
    logger.warn('[research-browser] failed to remove view', error);
  }

  try {
    if (!instance.view.webContents.isDestroyed()) {
      instance.view.webContents.close();
    }
  } catch (error) {
    logger.warn('[research-browser] failed to close web contents', error);
  }
};

export const researchBrowserHandlers = {
  create: async (e: Electron.IpcMainInvokeEvent) => {
    const window = BrowserWindow.fromWebContents(e.sender);
    if (!window) {
      throw new Error('无法找到 AFFiNE 桌面窗口');
    }

    const id = nanoid();
    const partition = `research-browser:${id}`;
    const browserSession = session.fromPartition(partition);
    browserSession.setPermissionRequestHandler(
      (_webContents, _permission, cb) => {
        cb(false);
      }
    );
    browserSession.setPermissionCheckHandler(() => false);

    const view = new WebContentsView({
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: true,
        javascript: true,
        nodeIntegration: false,
        partition,
        sandbox: true,
        webSecurity: true,
      },
    });

    markResearchBrowserWebContents(view.webContents.id);
    window.contentView.addChildView(view);
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 });

    view.webContents.setWindowOpenHandler(({ url }) => {
      if (isAllowedResearchBrowserUrl(url)) {
        view.webContents.loadURL(url).catch(error => {
          logger.warn('[research-browser] failed to open popup url', error);
        });
      }
      return { action: 'deny' };
    });

    view.webContents.on('will-navigate', (event, target) => {
      if (!isAllowedResearchBrowserUrl(target)) {
        event.preventDefault();
      }
    });

    view.webContents.on('destroyed', () => {
      destroyInstance(id);
    });

    e.sender.once('destroyed', () => {
      destroyInstance(id);
    });

    instances.set(id, {
      id,
      ownerId: e.sender.id,
      view,
      window,
    });

    return { id };
  },

  navigate: async (
    e: Electron.IpcMainInvokeEvent,
    id: string,
    rawUrl: string
  ) => {
    const { view } = getInstance(e, id);
    const url = normalizeUrl(rawUrl);
    await view.webContents.loadURL(url);
    return { url };
  },

  goBack: async (e: Electron.IpcMainInvokeEvent, id: string) => {
    const { view } = getInstance(e, id);
    const navigationHistory = view.webContents.navigationHistory;
    if (navigationHistory?.canGoBack()) {
      navigationHistory.goBack();
    } else if (view.webContents.canGoBack()) {
      view.webContents.goBack();
    }
  },

  goForward: async (e: Electron.IpcMainInvokeEvent, id: string) => {
    const { view } = getInstance(e, id);
    const navigationHistory = view.webContents.navigationHistory;
    if (navigationHistory?.canGoForward()) {
      navigationHistory.goForward();
    } else if (view.webContents.canGoForward()) {
      view.webContents.goForward();
    }
  },

  reload: async (e: Electron.IpcMainInvokeEvent, id: string) => {
    const { view } = getInstance(e, id);
    view.webContents.reload();
  },

  stop: async (e: Electron.IpcMainInvokeEvent, id: string) => {
    const { view } = getInstance(e, id);
    view.webContents.stop();
  },

  capture: async (e: Electron.IpcMainInvokeEvent, id: string) => {
    const { view } = getInstance(e, id);
    const html = await view.webContents.executeJavaScript(
      'document.documentElement.outerHTML',
      true
    );

    return {
      url: view.webContents.getURL(),
      title: view.webContents.getTitle(),
      html,
    };
  },

  setBounds: async (
    e: Electron.IpcMainInvokeEvent,
    id: string,
    bounds: ResearchBrowserBounds
  ) => {
    const { view } = getInstance(e, id);
    view.setBounds(normalizeBounds(bounds));
  },

  destroy: async (e: Electron.IpcMainInvokeEvent, id: string) => {
    getInstance(e, id);
    destroyInstance(id);
  },
} satisfies NamespaceHandlers;
