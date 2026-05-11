import type { PeekViewService } from '@affine/core/modules/peek-view';
import { WithDisposable } from '@blocksuite/global/lit';
import { PageIcon, SearchIcon } from '@blocksuite/icons/lit';
import { ShadowlessElement } from '@blocksuite/std';
import type { Signal } from '@preact/signals-core';
import { html, nothing } from 'lit';
import { property } from 'lit/decorators.js';

import type { ToolResult } from './tool-result-card';
import { getToolErrorDisplayName, isToolError } from './tool-result-utils';
import type { ToolError } from './type';

interface DocKeywordSearchToolCall {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: { query: string };
}

interface DocKeywordSearchToolResult {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  args: { query: string };
  result: Array<{ title: string; docId: string }> | ToolError | null;
}

export class DocKeywordSearchResult extends WithDisposable(ShadowlessElement) {
  @property({ attribute: false })
  accessor data!: DocKeywordSearchToolCall | DocKeywordSearchToolResult;

  @property({ attribute: false })
  accessor width: Signal<number | undefined> | undefined;

  @property({ attribute: false })
  accessor onOpenDoc!: (docId: string, sessionId?: string) => void;

  @property({ attribute: false })
  accessor peekViewService!: PeekViewService;

  renderToolCall() {
    return html`<tool-call-card
      .name=${`\u6b63\u5728\u641c\u7d22\u5de5\u4f5c\u533a\u6587\u6863\uff1a\u201c${this.data.args.query}\u201d`}
      .icon=${SearchIcon()}
      .width=${this.width}
    ></tool-call-card>`;
  }

  renderToolResult() {
    if (this.data.type !== 'tool-result') {
      return nothing;
    }
    const result = this.data.result;
    if (!result || isToolError(result)) {
      return html`<tool-call-failed
        .name=${getToolErrorDisplayName(
          isToolError(result) ? result : null,
          '\u6587\u6863\u641c\u7d22\u5931\u8d25',
          {
            'Workspace Sync Required':
              '\u8bf7\u5148\u542f\u7528\u5de5\u4f5c\u533a\u540c\u6b65\u540e\u518d\u641c\u7d22\u6587\u6863',
          }
        )}
        .icon=${SearchIcon()}
      ></tool-call-failed>`;
    }
    let results: ToolResult[] = [];
    try {
      results = result.map(item => ({
        title: item.title,
        icon: PageIcon(),
        onClick: () => {
          this.peekViewService.peekView
            .open({
              type: 'doc',
              docRef: { docId: item.docId },
            })
            .catch(console.error);
        },
      }));
    } catch (err) {
      console.error('Failed to parse result', err);
    }
    return html`<tool-result-card
      .name=${`\u627e\u5230 ${result.length} \u4e2a\u4e0e\u201c${this.data.args.query}\u201d\u76f8\u5173\u7684\u9875\u9762`}
      .icon=${SearchIcon()}
      .width=${this.width}
      .results=${results}
    ></tool-result-card>`;
  }

  protected override render() {
    if (this.data.type === 'tool-call') {
      return this.renderToolCall();
    }
    return this.renderToolResult();
  }
}
