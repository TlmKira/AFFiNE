import type { PeekViewService } from '@affine/core/modules/peek-view';
import { WithDisposable } from '@blocksuite/global/lit';
import { PageIcon, ViewIcon } from '@blocksuite/icons/lit';
import { ShadowlessElement } from '@blocksuite/std';
import type { Signal } from '@preact/signals-core';
import { html, nothing } from 'lit';
import { property } from 'lit/decorators.js';

import { getToolErrorDisplayName, isToolError } from './tool-result-utils';
import type { ToolError } from './type';

interface DocReadToolCall {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: { doc_id: string };
}

interface DocReadToolResult {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  args: { doc_id: string };
  result:
    | {
        /** Old result may not have docId */
        docId?: string;
        title: string;
        markdown: string;
      }
    | ToolError
    | null;
}

const getFailedName = (result: ToolError | null) => {
  return getToolErrorDisplayName(
    result,
    '\u6587\u6863\u8bfb\u53d6\u5931\u8d25',
    {
      'Workspace Sync Required':
        '\u8bf7\u5148\u542f\u7528\u5de5\u4f5c\u533a\u540c\u6b65\u540e\u518d\u8bfb\u53d6\u6b64\u6587\u6863',
      'Document Sync Pending':
        '\u8bf7\u7b49\u5f85\u6587\u6863\u540c\u6b65\u5b8c\u6210',
    }
  );
};

export class DocReadResult extends WithDisposable(ShadowlessElement) {
  @property({ attribute: false })
  accessor data!: DocReadToolCall | DocReadToolResult;

  @property({ attribute: false })
  accessor width: Signal<number | undefined> | undefined;

  @property({ attribute: false })
  accessor peekViewService!: PeekViewService;

  renderToolCall() {
    // TODO: get document name by doc_id
    return html`<tool-call-card
      .name=${`\u6b63\u5728\u8bfb\u53d6\u6587\u6863`}
      .icon=${ViewIcon()}
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
        .name=${getFailedName(isToolError(result) ? result : null)}
        .icon=${ViewIcon()}
      ></tool-call-failed>`;
    }
    // TODO: better markdown rendering
    return html`<tool-result-card
      .name=${`\u5df2\u8bfb\u53d6\u201c${result.title}\u201d`}
      .icon=${ViewIcon()}
      .width=${this.width}
      .results=${[
        {
          title: result.title,
          icon: PageIcon(),
          content: result.markdown,
          onClick: () => {
            const docId = result.docId;
            if (!docId) {
              return;
            }
            this.peekViewService.peekView
              .open({
                type: 'doc',
                docRef: { docId },
              })
              .catch(console.error);
          },
        },
      ]}
    ></tool-result-card>`;
  }

  protected override render() {
    if (this.data.type === 'tool-call') {
      return this.renderToolCall();
    }
    if (this.data.type === 'tool-result') {
      return this.renderToolResult();
    }
    return nothing;
  }
}
