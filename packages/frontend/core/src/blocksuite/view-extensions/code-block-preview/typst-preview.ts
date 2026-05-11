import { renderTypstSvg } from '@affine/core/modules/code-block-preview-renderer/bridge';
import { CodeBlockPreviewExtension } from '@blocksuite/affine/blocks/code';
import { SignalWatcher, WithDisposable } from '@blocksuite/affine/global/lit';
import type { CodeBlockModel } from '@blocksuite/affine/model';
import { unsafeCSSVarV2 } from '@blocksuite/affine/shared/theme';
import { ShadowlessElement } from '@blocksuite/std';
import { css, html, nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { choose } from 'lit/directives/choose.js';
import { styleMap } from 'lit/directives/style-map.js';

const RENDER_DEBOUNCE_MS = 200;

export const CodeBlockTypstPreview = CodeBlockPreviewExtension(
  'typst',
  model => html`<typst-preview .model=${model}></typst-preview>`
);

export class TypstPreview extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    .typst-preview-loading {
      color: ${unsafeCSSVarV2('text/placeholder')};
      font-family: 'IBM Plex Mono';
      font-size: 12px;
      line-height: 18px;
      padding: 12px;
      text-align: center;
    }

    .typst-preview-error,
    .typst-preview-fallback {
      color: ${unsafeCSSVarV2('button/error')};
      font-family: 'IBM Plex Mono';
      font-size: 12px;
      line-height: 18px;
      padding: 12px;
      text-align: center;
    }

    details.typst-error-details {
      margin-top: 8px;
      text-align: left;
      border: 1px dashed ${unsafeCSSVarV2('layer/insideBorder/border')};
      border-radius: 6px;
      padding: 8px;
      background: ${unsafeCSSVarV2('layer/background/secondary')};
      color: ${unsafeCSSVarV2('text/secondary')};
      font-family: 'IBM Plex Mono';
      font-size: 12px;
      line-height: 18px;
    }

    .typst-error-text {
      white-space: pre-wrap;
      word-break: break-word;
      user-select: text;
    }

    .typst-copy-row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 6px;
    }

    .typst-copy-button {
      padding: 6px 8px;
      border-radius: 4px;
      border: 1px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
      background: ${unsafeCSSVarV2('layer/background/primary')};
      color: ${unsafeCSSVarV2('text/primary')};
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s ease;
    }

    .typst-copy-button:hover {
      background: ${unsafeCSSVarV2('layer/background/hoverOverlay')};
    }

    .typst-preview-container {
      width: 100%;
      min-height: 300px;
      max-height: 600px;
      border: 1px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
      border-radius: 8px;
      background: ${unsafeCSSVarV2('layer/background/primary')};
      padding: 12px;
      overflow: auto;
      position: relative;
      cursor: grab;
    }

    .typst-preview-svg {
      width: 100%;
      transform-origin: center;
      transition: transform 0.15s ease-out;
      display: inline-block;
    }

    .typst-preview-svg > div {
      display: flex;
      justify-content: center;
      width: 100%;
      transform-origin: center;
    }

    .typst-controls {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 4px;
      z-index: 10;
    }

    .typst-control-button {
      width: 28px;
      height: 28px;
      border: 1px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
      border-radius: 4px;
      background: ${unsafeCSSVarV2('layer/background/primary')};
      color: ${unsafeCSSVarV2('text/primary')};
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: all 0.2s ease;
    }

    .typst-control-button:hover {
      background: ${unsafeCSSVarV2('layer/background/hoverOverlay')};
      border-color: ${unsafeCSSVarV2('layer/insideBorder/primaryBorder')};
    }

    .typst-control-button:active {
      transform: scale(0.96);
    }
  `;

  @property({ attribute: false })
  accessor model: CodeBlockModel | null = null;

  @property({ attribute: false })
  accessor typstCode: string | null = null;

  @state()
  accessor state: 'loading' | 'error' | 'finish' | 'fallback' | 'syntax-error' =
    'loading';

  @state()
  accessor svgContent: string = '';

  @state()
  accessor errorMessage: string | null = null;

  @state()
  accessor copyState: 'idle' | 'copied' | 'failed' = 'idle';

  @query('.typst-preview-container')
  accessor container!: HTMLDivElement;

  private renderTimeout: ReturnType<typeof setTimeout> | null = null;
  private isRendering = false;
  private scale = 1;
  private translateX = 0;
  private translateY = 0;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  private async _copyError() {
    if (!this.errorMessage) return;
    try {
      await navigator.clipboard.writeText(this.errorMessage);
      this.copyState = 'copied';
      setTimeout(() => (this.copyState = 'idle'), 1500);
    } catch (err) {
      console.error('Failed to copy Typst error message:', err);
      this.copyState = 'failed';
      setTimeout(() => (this.copyState = 'idle'), 1500);
    }
  }

  private get _errorMessageDetail() {
    return this.errorMessage
      ? html`<details class="typst-error-details">
          <summary>错误详情</summary>
          <pre
            class="typst-error-text"
            tabindex="0"
            aria-label="Typst 错误信息"
          >
${this.errorMessage}</pre
          >
          <div class="typst-copy-row">
            <button class="typst-copy-button" @click=${this._copyError}>
              ${this._copyButtonLabel}
            </button>
          </div>
        </details>`
      : nothing;
  }

  private get _errorMessageComponent() {
    const lower = this.errorMessage?.toLowerCase() ?? '';

    const friendlyMessage = lower.includes('no font could be found')
      ? '\u5b57\u4f53\u52a0\u8f7d\u5931\u8d25\u3002\u8bf7\u68c0\u67e5\u7f51\u7edc\u6216\u7a0d\u540e\u91cd\u8bd5\u3002'
      : 'Typst \u6e32\u67d3\u5931\u8d25\u3002\u8bf7\u68c0\u67e5\u4ee3\u7801\u3002';

    return [friendlyMessage, this._errorMessageDetail];
  }

  private get _copyButtonLabel() {
    if (this.copyState === 'copied') {
      return '\u5df2\u590d\u5236';
    } else if (this.copyState === 'failed') {
      return '\u590d\u5236\u5931\u8d25';
    } else {
      return '\u590d\u5236';
    }
  }

  private get _finalPreview() {
    return this.state === 'finish'
      ? html`
          <div class="typst-controls">
            <button
              class="typst-control-button"
              @click=${this._zoomOut}
              title="Zoom out"
            >
              −
            </button>
            <button
              class="typst-control-button"
              @click=${this._resetView}
              title="Reset view"
            >
              ⟳
            </button>
            <button
              class="typst-control-button"
              @click=${this._zoomIn}
              title="Zoom in"
            >
              +
            </button>
          </div>
          <div
            class="typst-preview-svg"
            style=${styleMap({
              transform: `translate(${this.translateX}px, ${this.translateY}px) scale(${this.scale})`,
            })}
          >
            ${this.svgContent
              ? html`<div .innerHTML=${this.svgContent}></div>`
              : nothing}
          </div>
        `
      : nothing;
  }

  override firstUpdated() {
    this._scheduleRender();
    this._setupDragListeners();

    if (this.model) {
      this.disposables.add(
        this.model.props.text$.subscribe(() => {
          this._scheduleRender();
        })
      );
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
      this.renderTimeout = null;
    }
  }

  get normalizedCode() {
    return this.model?.props.text.toString() ?? this.typstCode ?? '';
  }

  private _scheduleRender() {
    if (this.renderTimeout) {
      clearTimeout(this.renderTimeout);
    }

    this.renderTimeout = setTimeout(() => {
      this._render().catch(error => {
        console.error('Typst preview render failed:', error);
      });
    }, RENDER_DEBOUNCE_MS);
  }

  private _resetView() {
    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.requestUpdate();
  }

  private _zoomIn() {
    this.scale = Math.min(this.scale * 1.2, 5);
    this.requestUpdate();
  }

  private _zoomOut() {
    this.scale = Math.max(this.scale / 1.2, 0.2);
    this.requestUpdate();
  }

  private _setupDragListeners() {
    if (!this.container) return;

    this.disposables.addFromEvent(
      this.container,
      'mousedown',
      (event: MouseEvent) => {
        if (event.button !== 0) return;
        this.isDragging = true;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        this.container.style.cursor = 'grabbing';
      }
    );

    this.disposables.addFromEvent(
      document,
      'mousemove',
      (event: MouseEvent) => {
        if (!this.isDragging) return;
        const deltaX = event.clientX - this.lastMouseX;
        const deltaY = event.clientY - this.lastMouseY;

        this.translateX += deltaX;
        this.translateY += deltaY;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        this.requestUpdate();
      }
    );

    this.disposables.addFromEvent(document, 'mouseup', () => {
      this.isDragging = false;
      if (this.container) {
        this.container.style.cursor = 'grab';
      }
    });

    this.disposables.addFromEvent(this.container, 'selectstart', e =>
      e.preventDefault()
    );
  }

  private async _render() {
    if (this.isRendering) return;
    this.isRendering = true;
    this.state = 'loading';
    this.errorMessage = null;

    const code = this.normalizedCode.trim();
    if (!code) {
      this.svgContent = '';
      this.state = 'fallback';
      this.isRendering = false;
      return;
    }

    try {
      const { svg } = await renderTypstSvg({ code });
      this.svgContent = svg;
      this.state = 'finish';
      this._resetView();
    } catch (error) {
      console.error('Typst preview failed:', error);
      const message =
        (error as Error | undefined)?.message ??
        (typeof error === 'string' ? error : null);
      this.errorMessage = message;
      this.state =
        message && message.toLowerCase().includes('syntax')
          ? 'syntax-error'
          : 'error';
    } finally {
      this.isRendering = false;
    }
  }

  override render() {
    return html`
      <div class="typst-preview-wrapper">
        ${choose(this.state, [
          [
            'loading',
            () =>
              html`<div class="typst-preview-loading">
                正在渲染 Typst 代码...
              </div>`,
          ],
          [
            'error',
            () =>
              html`<div class="typst-preview-error">
                ${this._errorMessageComponent}
              </div>`,
          ],
          [
            'syntax-error',
            () =>
              html`<div class="typst-preview-error">
                Typst
                代码存在错误：${this.errorMessage ??
                '\u672a\u77e5\u9519\u8bef\u3002'}
                ${this._errorMessageDetail}
              </div>`,
          ],
          [
            'fallback',
            () =>
              html`<div class="typst-preview-fallback">
                输入 Typst 代码以预览。
              </div>`,
          ],
        ])}
        <div
          class="typst-preview-container"
          style=${styleMap({
            display: this.state === 'finish' ? undefined : 'none',
          })}
        >
          ${this._finalPreview}
        </div>
      </div>
    `;
  }
}

export function effects() {
  customElements.define('typst-preview', TypstPreview);
}

declare global {
  interface HTMLElementTagNameMap {
    'typst-preview': TypstPreview;
  }
}
