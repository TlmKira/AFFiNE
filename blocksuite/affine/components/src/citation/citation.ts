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

type CitationField = {
  label: string;
  value: string;
};

const FIELD_LABELS = new Set([
  '作者',
  '年份',
  '来源',
  'DOI',
  'arXiv',
  '摘要',
  '补全',
]);

export class CitationCard extends SignalWatcher(WithDisposable(LitElement)) {
  static override styles = css`
    .citation-container {
      width: 100%;
      box-sizing: border-box;
      border-radius: 8px;
      display: flex;
      gap: 10px;
      flex-direction: column;
      align-items: flex-start;
      align-self: stretch;
      padding: 14px 16px;
      background: ${unsafeCSSVarV2('layer/background/primary')};
      border: 1px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
      font-family: ${unsafeCSS(baseTheme.fontSansFamily)};
      cursor: pointer;
      user-select: none;
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease,
        background-color 0.2s ease;
    }

    .citation-container:hover {
      border-color: ${unsafeCSSVarV2('button/primary')};
      box-shadow: var(--affine-shadow-1);
    }

    .citation-header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      width: 100%;
      box-sizing: border-box;
      min-height: 24px;
    }

    .citation-icon {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 26px;
      min-width: 40px;
      padding: 0 8px;
      box-sizing: border-box;
      color: ${unsafeCSSVarV2('button/primary')};
      background: ${unsafeCSSVarV2('layer/background/secondary')};
      border-radius: 6px;
      font-size: var(--affine-font-xs);
      font-weight: 600;
      line-height: 26px;
    }

    .citation-icon img,
    .citation-icon svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }

    .citation-main {
      min-width: 0;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .citation-title-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      width: 100%;
    }

    .citation-title {
      flex: 1;
      min-width: 0;
      text-align: left;
      line-height: 22px;
      color: ${unsafeCSSVarV2('text/primary')};
      font-size: var(--affine-font-base);
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      word-break: break-word;
    }

    .citation-identifier {
      flex: 0 0 auto;
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
      font-weight: 500;
      line-height: 20px;
      transition: background-color 0.3s ease-in-out;
    }

    .citation-container:hover .citation-identifier,
    .citation-identifier.active {
      background: ${unsafeCSSVarV2('button/primary')};
      color: ${unsafeCSSVarV2('button/pureWhiteText')};
    }

    .citation-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      width: 100%;
    }

    .citation-pill {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
      height: 22px;
      padding: 0 8px;
      border-radius: 999px;
      background: ${unsafeCSSVarV2('layer/background/secondary')};
      color: ${unsafeCSSVarV2('text/secondary')};
      font-size: var(--affine-font-xs);
      line-height: 22px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .citation-abstract {
      width: 100%;
      color: ${unsafeCSSVarV2('text/secondary')};
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: normal;
      word-break: break-word;
      font-size: var(--affine-font-xs);
      line-height: 20px;
    }

    .citation-warning {
      color: ${unsafeCSSVarV2('text/secondary')};
      font-size: var(--affine-font-xs);
      line-height: 18px;
    }

    .citation-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding-top: 2px;
    }

    .citation-action {
      height: 24px;
      border: 1px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
      border-radius: 6px;
      background: ${unsafeCSSVarV2('layer/background/primary')};
      color: ${unsafeCSSVarV2('text/primary')};
      padding: 0 8px;
      font-size: var(--affine-font-xs);
      line-height: 22px;
      cursor: pointer;
    }

    .citation-action:hover {
      color: ${unsafeCSSVarV2('button/primary')};
      border-color: ${unsafeCSSVarV2('button/primary')};
      background: ${unsafeCSSVarV2('layer/background/secondary')};
    }
  `;

  private readonly _IconTemplate = (icon: TemplateResult | string) => {
    if (typeof icon === 'string') {
      return html`<img src="${icon}" alt="favicon" />`;
    }
    return icon;
  };

  private _parseFields() {
    const fields: CitationField[] = [];
    const rawLines = (this.citationContent ?? '')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    for (const line of rawLines) {
      const separator = line.indexOf('：');
      if (separator < 0) continue;
      const label = line.slice(0, separator);
      const value = line.slice(separator + 1).trim();
      if (FIELD_LABELS.has(label) && value) {
        fields.push({ label, value });
      }
    }
    return fields;
  }

  private _search(query: string, engine: 'google' | 'cnki' | 'baidu') {
    const encoded = encodeURIComponent(query);
    const urls = {
      google: `https://scholar.google.com/scholar?q=${encoded}`,
      cnki: `https://kns.cnki.net/kns8s/defaultresult/index?kw=${encoded}`,
      baidu: `https://xueshu.baidu.com/s?wd=${encoded}`,
    };
    window.open(urls[engine], '_blank', 'noopener,noreferrer');
  }

  private _onSearchClick(
    event: MouseEvent,
    engine: 'google' | 'cnki' | 'baidu'
  ) {
    event.stopPropagation();
    const query = this.citationTitle || this.citationUrl || '';
    if (query) {
      this._search(query, engine);
    }
  }

  override render() {
    const citationIdentifierClasses = classMap({
      'citation-identifier': true,
      active: this.active,
    });
    const fields = this._parseFields();
    const abstract = fields.find(field => field.label === '摘要')?.value;
    const warning = fields.find(field => field.label === '补全')?.value;
    const metaFields = fields.filter(
      field => field.label !== '摘要' && field.label !== '补全'
    );

    return html`
      <div
        class="citation-container"
        @click=${this.onClickCallback}
        @dblclick=${this.onDoubleClickCallback}
      >
        <div class="citation-header">
          <div class="citation-icon">
            ${this.icon ? this._IconTemplate(this.icon) : '文献'}
          </div>
          <div class="citation-main">
            <div class="citation-title-row">
              <div class="citation-title">${this.citationTitle}</div>
              <div class=${citationIdentifierClasses}>
                ${this.citationIdentifier}
              </div>
            </div>
            ${metaFields.length
              ? html`<div class="citation-meta">
                  ${metaFields.map(
                    field =>
                      html`<span class="citation-pill"
                        >${field.label}: ${field.value}</span
                      >`
                  )}
                </div>`
              : this.citationContent
                ? html`<div class="citation-abstract">
                    ${this.citationContent}
                  </div>`
                : nothing}
            ${abstract
              ? html`<div class="citation-abstract">${abstract}</div>`
              : nothing}
            ${warning
              ? html`<div class="citation-warning">${warning}</div>`
              : nothing}
            <div class="citation-actions">
              <button
                class="citation-action"
                @click=${(event: MouseEvent) =>
                  this._onSearchClick(event, 'google')}
              >
                Google Scholar
              </button>
              <button
                class="citation-action"
                @click=${(event: MouseEvent) =>
                  this._onSearchClick(event, 'cnki')}
              >
                知网搜索
              </button>
              <button
                class="citation-action"
                @click=${(event: MouseEvent) =>
                  this._onSearchClick(event, 'baidu')}
              >
                百度学术
              </button>
            </div>
          </div>
        </div>
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
  accessor citationUrl: string = '';

  @property({ attribute: false })
  accessor onClickCallback: ((e: MouseEvent) => void) | undefined = undefined;

  @property({ attribute: false })
  accessor onDoubleClickCallback: ((e: MouseEvent) => void) | undefined =
    undefined;

  @property({ attribute: false })
  accessor active: boolean = false;
}
