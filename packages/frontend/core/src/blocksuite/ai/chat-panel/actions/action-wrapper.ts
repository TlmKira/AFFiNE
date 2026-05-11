import { WithDisposable } from '@blocksuite/affine/global/lit';
import { unsafeCSSVar, unsafeCSSVarV2 } from '@blocksuite/affine/shared/theme';
import type { EditorHost } from '@blocksuite/affine/std';
import { ThemeProvider } from '@blocksuite/affine-shared/services';
import {
  ArrowDownBigIcon as ArrowDownIcon,
  ArrowUpBigIcon as ArrowUpIcon,
  DoneIcon,
  ExplainIcon,
  ImageIcon,
  ImproveWritingIcon,
  LanguageIcon,
  LongerIcon,
  MakeItRealIcon,
  MindmapIcon,
  MindmapNodeIcon,
  PenIcon,
  PresentationIcon,
  SearchIcon,
  SelectionIcon,
  ShorterIcon,
  ToneIcon,
} from '@blocksuite/icons/lit';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';

import { type ChatAction } from '../../components/ai-chat-messages';
import { createTextRenderer } from '../../components/text-renderer';
import { HISTORY_IMAGE_ACTIONS } from '../../utils/history-image-actions';

const icons: Record<string, TemplateResult<1>> = {
  'Fix spelling for it': DoneIcon(),
  'Improve grammar for it': DoneIcon(),
  'Explain this code': ExplainIcon(),
  'Check code error': SearchIcon(),
  'Explain this': SelectionIcon(),
  Translate: LanguageIcon(),
  'Change tone': ToneIcon(),
  'Improve writing for it': ImproveWritingIcon(),
  'Make it longer': LongerIcon(),
  'Make it shorter': ShorterIcon(),
  'Continue writing': PenIcon(),
  'Make it real': MakeItRealIcon(),
  'Find action items from it': SearchIcon(),
  Summary: PenIcon(),
  'Create headings': PenIcon(),
  'Write outline': PenIcon(),
  image: ImageIcon(),
  'Brainstorm mindmap': MindmapIcon(),
  'Expand mind map': MindmapNodeIcon(),
  'Create a presentation': PresentationIcon(),
  'Write a poem about this': PenIcon(),
  'Write a blog post about this': PenIcon(),
  'AI image filter clay style': ImageIcon(),
  'AI image filter sketch style': ImageIcon(),
  'AI image filter anime style': ImageIcon(),
  'AI image filter pixel style': ImageIcon(),
  Clearer: ImageIcon(),
  'Remove background': ImageIcon(),
  'Convert to sticker': ImageIcon(),
};

const actionLabels: Record<string, string> = {
  'Fix spelling for it': '\u4fee\u6b63\u62fc\u5199',
  'Improve grammar for it': '\u4fee\u6b63\u8bed\u6cd5',
  'Explain this code': '\u89e3\u91ca\u4ee3\u7801',
  'Check code error': '\u68c0\u67e5\u4ee3\u7801\u9519\u8bef',
  'Explain this': '\u89e3\u91ca\u5185\u5bb9',
  Translate: '\u7ffb\u8bd1',
  'Change tone': '\u8c03\u6574\u8bed\u6c14',
  'Improve writing for it': '\u4f18\u5316\u5199\u4f5c',
  'Make it longer': '\u6269\u5199',
  'Make it shorter': '\u7f29\u5199',
  'Continue writing': '\u7ee7\u7eed\u5199\u4f5c',
  'Make it real': '\u751f\u6210\u53ef\u89c6\u5316',
  'Find action items from it': '\u63d0\u53d6\u5f85\u529e\u4e8b\u9879',
  Summary: '\u603b\u7ed3',
  'Create headings': '\u521b\u5efa\u6807\u9898',
  'Write outline': '\u64b0\u5199\u5927\u7eb2',
  image: '\u56fe\u7247',
  'Brainstorm mindmap': '\u5934\u8111\u98ce\u66b4\u601d\u7ef4\u5bfc\u56fe',
  'Expand mind map': '\u6269\u5c55\u601d\u7ef4\u5bfc\u56fe',
  'Create a presentation': '\u521b\u5efa\u6f14\u793a\u6587\u7a3f',
  'Write a poem about this': '\u5199\u4e00\u9996\u8bd7',
  'Write a blog post about this': '\u5199\u4e00\u7bc7\u535a\u5ba2',
  'AI image filter clay style': '\u7c98\u571f\u98ce\u683c',
  'AI image filter sketch style': '\u7d20\u63cf\u98ce\u683c',
  'AI image filter anime style': '\u52a8\u6f2b\u98ce\u683c',
  'AI image filter pixel style': '\u50cf\u7d20\u98ce\u683c',
  Clearer: '\u53d8\u6e05\u6670',
  'Remove background': '\u79fb\u9664\u80cc\u666f',
  'Convert to sticker': '\u8f6c\u4e3a\u8d34\u7eb8',
};

export class ActionWrapper extends WithDisposable(LitElement) {
  static override styles = css`
    .action-name {
      display: flex;
      align-items: center;
      gap: 8px;
      height: 22px;
      margin-bottom: 12px;

      svg {
        color: ${unsafeCSSVar('primaryColor')};
      }

      div:last-child {
        cursor: pointer;
        display: flex;
        align-items: center;
        flex: 1;

        div:last-child svg {
          margin-left: auto;
        }
      }
    }

    .answer-prompt {
      padding: 8px;
      background-color: ${unsafeCSSVarV2('block/callout/background/grey')};
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 14px;
      font-weight: 400;
      color: ${unsafeCSSVarV2('text/primary')};
      max-height: 500px;
      overflow-y: auto;
      border-radius: 4px;

      .subtitle {
        font-size: 12px;
        font-weight: 500;
        color: ${unsafeCSSVarV2('text/secondary')};
        height: 20px;
        line-height: 20px;
      }

      .prompt {
        margin-top: 12px;
      }
    }

    .answer-prompt::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    .answer-prompt::-webkit-scrollbar-thumb {
      background-color: ${unsafeCSSVar('borderColor')};
    }
    .answer-prompt::-webkit-scrollbar-track {
      background: transparent;
    }
  `;

  @state()
  accessor promptShow = false;

  @property({ attribute: false })
  accessor item!: ChatAction;

  @property({ attribute: false })
  accessor host!: EditorHost;

  protected override render() {
    const { item } = this;

    const originalText = item.messages[1].content;
    const answer = item.messages[2]?.content;
    const images = item.messages[1].attachments;

    return html`<style></style>
      <slot></slot>
      <div
        class="action-name"
        data-testid="action-name"
        @click=${() => (this.promptShow = !this.promptShow)}
      >
        ${icons[item.action] ? icons[item.action] : DoneIcon()}
        <div>
          <div>${actionLabels[item.action] ?? item.action}</div>
          <div>${this.promptShow ? ArrowDownIcon() : ArrowUpIcon()}</div>
        </div>
      </div>
      ${this.promptShow
        ? html`
            <div class="answer-prompt" data-testid="answer-prompt">
              <div class="subtitle">回答</div>
              ${HISTORY_IMAGE_ACTIONS.includes(item.action)
                ? images &&
                  html`<chat-content-images
                    .images=${images}
                    data-testid="generated-image"
                  ></chat-content-images>`
                : nothing}
              ${answer
                ? createTextRenderer({
                    customHeading: true,
                    testId: 'chat-message-action-answer',
                    theme: this.host.std.get(ThemeProvider).app$,
                  })(answer)
                : nothing}
              ${originalText
                ? html`<div class="subtitle prompt">提示词</div>
                    ${createTextRenderer({
                      customHeading: true,
                      testId: 'chat-message-action-prompt',
                      theme: this.host.std.get(ThemeProvider).app$,
                    })(item.messages[0].content + originalText)}`
                : nothing}
            </div>
          `
        : nothing} `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'action-wrapper': ActionWrapper;
  }
}
