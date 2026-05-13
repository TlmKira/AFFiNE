import { unsafeCSSVarV2 } from '@blocksuite/affine-shared/theme';
import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import { baseTheme } from '@toeverything/theme';
import {
  css,
  html,
  LitElement,
  nothing,
  type TemplateResult,
  unsafeCSS,
} from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

export class CitationCard extends SignalWatcher(WithDisposable(LitElement)) {
  static override styles = css`
    .citation-container {
      width: 100%;
      box-sizing: border-box;
      border-radius: 8px;
      display: flex;
      gap: 8px;
      flex-direction: column;
      align-items: flex-start;
      align-self: stretch;
      padding: 12px;
      background-color: ${unsafeCSSVarV2('layer/background/primary')};
      border: 1px solid ${unsafeCSSVarV2('layer/background/tertiary')};
      font-family: ${unsafeCSS(baseTheme.fontSansFamily)};
      cursor: pointer;
      user-select: none;
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease,
        background-color 0.2s ease;
    }

    .citation-container:hover {
      border-color: ${unsafeCSSVarV2('layer/insideBorder/border')};
      box-shadow: var(--affine-shadow-1);
    }

    .citation-header {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      box-sizing: border-box;
      min-height: 22px;

      .citation-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 16px;
        width: 16px;
        color: ${unsafeCSSVarV2('icon/primary')};
        border-radius: 4px;

        svg,
        img {
          width: 16px;
          height: 16px;
          fill: ${unsafeCSSVarV2('icon/primary')};
        }
      }

      .citation-title {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: left;
        line-height: 22px;
        color: ${unsafeCSSVarV2('text/primary')};
        font-size: var(--affine-font-sm);
        font-weight: 600;
      }

      .citation-identifier {
        display: flex;
        min-width: 22px;
        height: 20px;
        padding: 0 6px;
        box-sizing: border-box;
        justify-content: center;
        align-items: center;
        border-radius: 999px;
        background: ${unsafeCSSVarV2('block/footnote/numberBg')};
        color: ${unsafeCSSVarV2('text/secondary')};
        text-align: center;
        font-size: var(--affine-font-xs);
        font-style: normal;
        font-weight: 500;
        line-height: 20px;
        transition: background-color 0.3s ease-in-out;
      }
    }

    .citation-container:hover .citation-identifier,
    .citation-identifier.active {
      background: ${unsafeCSSVarV2('button/primary')};
      color: ${unsafeCSSVarV2('button/pureWhiteText')};
    }

    .citation-content {
      width: 100%;
      box-sizing: border-box;
      color: ${unsafeCSSVarV2('text/primary')};
      font-feature-settings:
        'liga' off,
        'clig' off;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: normal;
      word-break: break-word;
      font-size: var(--affine-font-xs);
      font-style: normal;
      font-weight: 400;
      line-height: 20px;
    }
  `;

  private readonly _IconTemplate = (icon: TemplateResult | string) => {
    if (typeof icon === 'string') {
      return html`<img src="${icon}" alt="favicon" />`;
    }
    return icon;
  };

  override render() {
    const citationIdentifierClasses = classMap({
      'citation-identifier': true,
      active: this.active,
    });
    return html`
      <div
        class="citation-container"
        @click=${this.onClickCallback}
        @dblclick=${this.onDoubleClickCallback}
      >
        <div class="citation-header">
          ${this.icon
            ? html`<div class="citation-icon">
                ${this._IconTemplate(this.icon)}
              </div>`
            : nothing}
          <div class="citation-title">${this.citationTitle}</div>
          <div class=${citationIdentifierClasses}>
            ${this.citationIdentifier}
          </div>
        </div>
        ${this.citationContent
          ? html`<div class="citation-content">${this.citationContent}</div>`
          : nothing}
      </div>
    `;
  }

  @property({ attribute: false })
  accessor icon: TemplateResult | string | undefined = undefined;

  @property({ attribute: false })
  accessor citationTitle: string = '';

  @property({ attribute: false })
  accessor citationContent: string | undefined = undefined;

  @property({ attribute: false })
  accessor citationIdentifier: string = '';

  @property({ attribute: false })
  accessor onClickCallback: ((e: MouseEvent) => void) | undefined = undefined;

  @property({ attribute: false })
  accessor onDoubleClickCallback: ((e: MouseEvent) => void) | undefined =
    undefined;

  @property({ attribute: false })
  accessor active: boolean = false;
}
