import type { CopilotChatHistoryFragment } from '@affine/graphql';
import { createLitPortal } from '@blocksuite/affine/components/portal';
import { WithDisposable } from '@blocksuite/affine/global/lit';
import type { NotificationService } from '@blocksuite/affine/shared/services';
import { unsafeCSSVarV2 } from '@blocksuite/affine/shared/theme';
import { ShadowlessElement } from '@blocksuite/affine/std';
import {
  HistoryIcon,
  PinedIcon,
  PinIcon,
  PlusIcon,
} from '@blocksuite/icons/lit';
import { flip, offset } from '@floating-ui/dom';
import { css, html } from 'lit';
import { property, query } from 'lit/decorators.js';

import type { DocDisplayConfig } from '../ai-chat-chips';
import type { ChatStatus } from '../ai-chat-messages';

export class AIChatToolbar extends WithDisposable(ShadowlessElement) {
  @property({ attribute: false })
  accessor session!: CopilotChatHistoryFragment | null | undefined;

  @property({ attribute: false })
  accessor workspaceId!: string;

  @property({ attribute: false })
  accessor docId: string | undefined;

  @property({ attribute: false })
  accessor status!: ChatStatus;

  @property({ attribute: false })
  accessor onNewSession!: () => void;

  @property({ attribute: false })
  accessor canCreateNewSession = true;

  @property({ attribute: false })
  accessor onTogglePin!: () => Promise<void>;

  @property({ attribute: false })
  accessor onOpenSession!: (sessionId: string) => void;

  @property({ attribute: false })
  accessor onOpenDoc!: (docId: string, sessionId: string) => void;

  @property({ attribute: false })
  accessor onSessionDelete!: (
    session: BlockSuitePresets.AIRecentSession
  ) => void;

  @property({ attribute: false })
  accessor docDisplayConfig!: DocDisplayConfig;

  @property({ attribute: false })
  accessor notificationService!: NotificationService;

  @query('.history-button')
  accessor historyButton!: HTMLDivElement;

  private abortController: AbortController | null = null;

  get isGenerating() {
    return this.status === 'transmitting' || this.status === 'loading';
  }

  static override styles = css`
    .ai-chat-toolbar {
      display: flex;
      gap: 8px;
      align-items: center;

      .chat-toolbar-icon {
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        &:hover {
          background-color: ${unsafeCSSVarV2('layer/background/hoverOverlay')};
        }

        svg {
          width: 16px;
          height: 16px;
          color: ${unsafeCSSVarV2('icon/primary')};
        }

        &[data-disabled='true'] {
          cursor: not-allowed;
        }
      }
    }
  `;

  override render() {
    const pinned = this.session?.pinned;
    return html`
      <div class="ai-chat-toolbar">
        ${this.canCreateNewSession
          ? html` <div
              class="chat-toolbar-icon"
              @click=${this.onPlusClick}
              data-testid="ai-panel-new-chat"
            >
              ${PlusIcon()}
              <affine-tooltip>新对话</affine-tooltip>
            </div>`
          : null}
        <div
          class="chat-toolbar-icon"
          @click=${this.onPinClick}
          data-pinned=${!!pinned}
          data-disabled=${this.isGenerating}
          data-testid="ai-panel-pin-chat"
        >
          ${pinned ? PinedIcon() : PinIcon()}
          <affine-tooltip>
            ${pinned
              ? '\u53d6\u6d88\u56fa\u5b9a\u5bf9\u8bdd'
              : '\u56fa\u5b9a\u5bf9\u8bdd'}
          </affine-tooltip>
        </div>
        <div
          class="chat-toolbar-icon history-button"
          @click=${this.toggleHistoryMenu}
          data-testid="ai-panel-chat-history"
        >
          ${HistoryIcon()}
          <affine-tooltip>对话历史</affine-tooltip>
        </div>
      </div>
    `;
  }

  private readonly onPinClick = async () => {
    if (this.isGenerating) {
      this.notificationService.toast(
        'AI \u6b63\u5728\u751f\u6210\u56de\u7b54\u65f6\u65e0\u6cd5\u56fa\u5b9a\u5bf9\u8bdd'
      );
      return;
    }
    await this.onTogglePin();
  };

  private readonly unpinConfirm = async () => {
    if (this.session && this.session.pinned) {
      try {
        const confirm = await this.notificationService.confirm({
          title:
            '\u5207\u6362\u5bf9\u8bdd\uff1f\u5f53\u524d\u5bf9\u8bdd\u5df2\u56fa\u5b9a',
          message:
            '\u5207\u6362\u540e\u5c06\u53d6\u6d88\u56fa\u5b9a\u5f53\u524d\u5bf9\u8bdd\uff0c\u5e76\u5207\u6362\u5230\u5176\u4ed6\u5bf9\u8bdd\u5386\u53f2\u3002',
          confirmText: '\u5207\u6362\u5bf9\u8bdd',
          cancelText: '\u53d6\u6d88',
        });
        if (!confirm) {
          return false;
        }
        await this.onTogglePin();
      } catch {
        this.notificationService.toast(
          '\u53d6\u6d88\u56fa\u5b9a\u5bf9\u8bdd\u5931\u8d25'
        );
      }
    }
    return true;
  };

  private readonly onPlusClick = async () => {
    const confirm = await this.unpinConfirm();
    if (confirm) {
      this.onNewSession();
    }
  };

  private readonly onSessionClick = async (sessionId: string) => {
    if (this.session?.sessionId === sessionId) {
      this.notificationService.toast('You are already in this chat');
      return;
    }
    const confirm = await this.unpinConfirm();
    if (confirm) {
      this.onOpenSession(sessionId);
    }
  };

  private readonly onDocClick = async (docId: string, sessionId: string) => {
    if (this.docId === docId && this.session?.sessionId === sessionId) {
      this.notificationService.toast('You are already in this chat');
      return;
    }
    this.onOpenDoc(docId, sessionId);
  };

  private readonly toggleHistoryMenu = () => {
    if (this.abortController) {
      this.abortController.abort();
      return;
    }

    this.abortController = new AbortController();
    this.abortController.signal.addEventListener('abort', () => {
      this.abortController = null;
    });

    createLitPortal({
      template: html`
        <ai-session-history
          .session=${this.session}
          .workspaceId=${this.workspaceId}
          .docId=${this.docId}
          .docDisplayConfig=${this.docDisplayConfig}
          .onSessionClick=${this.onSessionClick}
          .onSessionDelete=${this.onSessionDelete}
          .onDocClick=${this.onDocClick}
          .notificationService=${this.notificationService}
        ></ai-session-history>
      `,
      portalStyles: {
        zIndex: 'var(--affine-z-index-popover)',
      },
      container: document.body,
      computePosition: {
        referenceElement: this.historyButton,
        placement: 'bottom-end',
        middleware: [offset({ crossAxis: 0, mainAxis: 5 }), flip()],
        autoUpdate: { animationFrame: true },
      },
      abortController: this.abortController,
      closeOnClickAway: true,
    });
  };

  public closeHistoryMenu() {
    this.abortController?.abort();
  }
}
