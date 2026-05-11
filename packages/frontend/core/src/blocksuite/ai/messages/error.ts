import { SignalWatcher, WithDisposable } from '@blocksuite/affine/global/lit';
import { scrollbarStyle } from '@blocksuite/affine/shared/styles';
import { unsafeCSSVarV2 } from '@blocksuite/affine/shared/theme';
import { type EditorHost } from '@blocksuite/affine/std';
import { InformationIcon, ToggleDownIcon } from '@blocksuite/icons/lit';
import { signal } from '@preact/signals-core';
import { baseTheme } from '@toeverything/theme';
import { css, html, LitElement, nothing, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';

import { PRIVATE_SERVICE_SUPPORT_EMAIL } from '@affine/core/modules/brand/constant';
import {
  type AIError,
  AIProvider,
  PaymentRequiredError,
  UnauthorizedError,
} from '../provider';

export class AIErrorWrapper extends SignalWatcher(WithDisposable(LitElement)) {
  static override styles = css`
    .error-wrapper {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      gap: 8px;
      align-self: stretch;
      border-radius: 4px;
      padding: 8px 8px 12px 8px;
      background-color: ${unsafeCSSVarV2('aI/errorBackground')};
      font-family: ${unsafeCSS(baseTheme.fontSansFamily)};

      .content {
        align-items: flex-start;
        display: flex;
        gap: 8px;
        align-self: stretch;
        color: ${unsafeCSSVarV2('aI/errorText')};
        font-feature-settings:
          'clig' off,
          'liga' off;
        /* light/sm */
        font-size: var(--affine-font-sm);
        font-style: normal;
        font-weight: 400;
        line-height: 22px; /* 157.143% */

        .icon svg {
          position: relative;
          top: 3px;
        }
      }

      .text-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .detail-container {
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
      }
      .detail-title {
        display: flex;
        align-items: center;
      }
      .detail-title:hover {
        cursor: pointer;
      }
      .detail-content {
        padding: 8px;
        border-radius: 4px;
        background-color: ${unsafeCSSVarV2('aI/errorDetailBackground')};
        overflow: auto;
      }
      ${scrollbarStyle('.detail-content')}

      .toggle {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .toggle.up svg {
        transform: rotate(180deg);
        transition: all 0.2s ease-in-out;
      }

      .action {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        width: 100%;
      }
      .action-button {
        cursor: pointer;
        color: ${unsafeCSSVarV2('text/primary')};
        background: ${unsafeCSSVarV2('button/secondary')};
        border-radius: 8px;
        border: 1px solid ${unsafeCSSVarV2('button/innerBlackBorder')};
        padding: 4px 12px;
        font-size: var(--affine-font-xs);
        font-style: normal;
        font-weight: 500;
        line-height: 20px;
      }
      .action-button:hover {
        transition: all 0.2s ease-in-out;
        background-image: linear-gradient(
          rgba(0, 0, 0, 0.04),
          rgba(0, 0, 0, 0.04)
        );
      }
    }
  `;

  private readonly _showDetailContent = signal(false);

  protected override render() {
    return html` <div class="error-wrapper">
      <div class="content">
        <div class="icon">${InformationIcon()}</div>
        <div class="text-container">
          <div>${this.text}</div>
          ${this.showDetailPanel
            ? html`<div class="detail-container">
                <div
                  class="detail-title"
                  @click=${() =>
                    (this._showDetailContent.value =
                      !this._showDetailContent.value)}
                >
                  <span>查看详情</span>
                  <span
                    class="toggle ${this._showDetailContent.value
                      ? 'down'
                      : 'up'}"
                  >
                    ${ToggleDownIcon({ width: '16px', height: '16px' })}
                  </span>
                </div>
                ${this._showDetailContent.value
                  ? html`<div class="detail-content">${this.errorMessage}</div>`
                  : nothing}
              </div>`
            : nothing}
        </div>
      </div>
      <div class="action">
        <span
          class="action-button"
          @click=${this.onClick}
          data-testid="ai-error-action-button"
        >
          ${this.actionText}
          ${this.actionTooltip
            ? html`<affine-tooltip tip-position="top">
                ${this.actionTooltip}
              </affine-tooltip>`
            : nothing}
        </span>
      </div>
    </div>`;
  }

  @property({ attribute: false })
  accessor text: string = '';

  @property({ attribute: false })
  accessor onClick: () => void = () => {};

  @property({ attribute: false })
  accessor errorMessage: string = '';

  @property({ attribute: false })
  accessor actionText: string = '\u8054\u7cfb\u6211\u4eec';

  @property({ attribute: false })
  accessor actionTooltip: string = '';

  @property({ attribute: false })
  accessor showDetailPanel: boolean = false;

  @property({ attribute: 'data-testid', reflect: true })
  accessor testId = 'ai-error';
}

const PaymentRequiredErrorRenderer = (host?: EditorHost | null) => html`
  <ai-error-wrapper
    .text=${'\u5df2\u8fbe\u5230\u5f53\u524d AI \u4f7f\u7528\u4e0a\u9650\u3002\u8bf7\u8054\u7cfb\u7ba1\u7406\u5458\u5f00\u901a\u6216\u8c03\u6574\u79c1\u6709\u670d\u52a1\u914d\u989d\u3002'}
    .actionText=${'\u77e5\u9053\u4e86'}
    .onClick=${() => {}}
  ></ai-error-wrapper>
`;

const LoginRequiredErrorRenderer = (host?: EditorHost | null) => html`
  <ai-error-wrapper
    .text=${'\u9700\u8981\u767b\u5f55\u79c1\u6709\u670d\u52a1\u540e\u624d\u80fd\u7ee7\u7eed\u4f7f\u7528 AI\u3002'}
    .actionText=${'\u767b\u5f55'}
    .onClick=${() => AIProvider.slots.requestLogin.next({ host })}
  ></ai-error-wrapper>
`;

type ErrorProps = {
  text?: string;
  errorMessage?: string;
  actionText?: string;
  actionTooltip?: string;
};

const generalErrorText =
  '\u53d1\u751f\u9519\u8bef\u3002\u5982\u679c\u95ee\u9898\u6301\u7eed\uff0c\u8bf7\u8054\u7cfb\u6211\u4eec\u3002';

const GeneralErrorRenderer = (props: ErrorProps = {}) => {
  const onClick = () => {
    window.open(`mailto:${PRIVATE_SERVICE_SUPPORT_EMAIL}`, '_blank');
  };

  return html`<ai-error-wrapper
    .text=${props.text ?? generalErrorText}
    .errorMessage=${props.errorMessage ?? ''}
    .showDetailPanel=${!!props.errorMessage}
    .actionText=${props.actionText ?? '\u8054\u7cfb\u6211\u4eec'}
    .actionTooltip=${props.actionTooltip ?? PRIVATE_SERVICE_SUPPORT_EMAIL}
    .onClick=${onClick}
  ></ai-error-wrapper>`;
};

export function AIChatErrorRenderer(error: AIError, host?: EditorHost | null) {
  if (error instanceof PaymentRequiredError) {
    return PaymentRequiredErrorRenderer(host);
  } else if (error instanceof UnauthorizedError) {
    return LoginRequiredErrorRenderer(host);
  } else {
    return GeneralErrorRenderer({
      errorMessage: error.message,
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ai-error-wrapper': AIErrorWrapper;
  }
}
