import { CaptionedBlockComponent } from '@blocksuite/affine-components/caption';
import { toast } from '@blocksuite/affine-components/toast';
import type { JupyterNotebookBlockModel } from '@blocksuite/affine-model';
import { RANGE_SYNC_EXCLUDE_ATTR } from '@blocksuite/std/inline';
import { html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import { NotebookRuntimeClient } from './runtime-client.js';
import { jupyterNotebookBlockStyles } from './style.js';
import type { NotebookCell, NotebookOutput } from './types.js';
import {
  normalizeNotebook,
  serializeNotebook,
  sourceToString,
} from './utils.js';

function outputText(output: NotebookOutput) {
  const chunks =
    output.text ??
    output.data?.['text/plain'] ??
    output.data?.['text/html'] ??
    output.evalue ??
    '';
  return Array.isArray(chunks) ? chunks.join('') : chunks;
}

export class JupyterNotebookBlockComponent extends CaptionedBlockComponent<JupyterNotebookBlockModel> {
  static override styles = jupyterNotebookBlockStyles;

  private _sessionId: string | null = null;
  private readonly _draftSources = new Map<string, string>();
  private readonly _runningCellKeys = new Set<string>();

  override connectedCallback() {
    super.connectedCallback();
    this.contentEditable = 'false';
    this.setAttribute(RANGE_SYNC_EXCLUDE_ATTR, 'true');
  }

  private get _notebook() {
    return normalizeNotebook(this.model.props.notebookJson);
  }

  private get _runtimeClient() {
    return new NotebookRuntimeClient(
      this.store.workspace.id,
      this.store.id,
      this.model.id
    );
  }

  private _updateNotebook(cells: NotebookCell[]) {
    const notebook = this._notebook;
    this.store.updateBlock(this.model, {
      notebookJson: serializeNotebook({
        ...notebook,
        cells,
      }),
      lastSavedAt: Date.now(),
      syncStatus: 'synced',
    });
  }

  private _updateCell(index: number, patch: Partial<NotebookCell>) {
    const cells = this._notebook.cells.map((cell, cellIndex) =>
      cellIndex === index ? { ...cell, ...patch } : cell
    );
    this._updateNotebook(cells);
  }

  private _setRuntimeStatus(
    runtimeStatus: JupyterNotebookBlockModel['props']['runtimeStatus']
  ) {
    this.store.updateBlock(this.model, { runtimeStatus });
  }

  private _cellKey(cell: NotebookCell, index: number) {
    return cell.id ?? `${cell.cell_type}-${index}`;
  }

  private _cellSource(cell: NotebookCell, index: number) {
    return (
      this._draftSources.get(this._cellKey(cell, index)) ??
      sourceToString(cell.source)
    );
  }

  private _flushDraftSources() {
    if (!this._draftSources.size) {
      return this._notebook.cells;
    }

    let changed = false;
    const cells = this._notebook.cells.map((cell, index) => {
      const key = this._cellKey(cell, index);
      const source = this._draftSources.get(key);
      if (source === undefined) {
        return cell;
      }

      if (sourceToString(cell.source) === source) {
        return cell;
      }

      changed = true;
      return { ...cell, source };
    });

    this._draftSources.clear();
    if (changed) {
      this._updateNotebook(cells);
    }
    return cells;
  }

  private _executionLabel(cell: NotebookCell, index: number) {
    if (this._runningCellKeys.has(this._cellKey(cell, index))) {
      return '[*]';
    }

    return `[${cell.execution_count ?? ' '}]`;
  }

  private readonly _stopEditorEvent = (event: Event) => {
    event.stopPropagation();
  };

  private _handleSourceInput(cell: NotebookCell, index: number, event: Event) {
    event.stopPropagation();
    this._draftSources.set(
      this._cellKey(cell, index),
      (event.target as HTMLTextAreaElement).value
    );
  }

  private _handleSourceKeydown(
    cell: NotebookCell,
    index: number,
    event: KeyboardEvent
  ) {
    event.stopPropagation();

    if (event.key !== 'Tab') {
      return;
    }

    event.preventDefault();
    const textarea = event.target as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.setRangeText('  ', start, end, 'end');
    this._draftSources.set(this._cellKey(cell, index), textarea.value);
  }

  private _handleSourceBlur() {
    this._flushDraftSources();
  }

  private async _ensureSession(notebookJson = this.model.props.notebookJson) {
    if (this._sessionId) {
      return this._sessionId;
    }

    this._setRuntimeStatus('connecting');
    const session = await this._runtimeClient.createSession(notebookJson);
    this._sessionId = session.sessionId;
    this._setRuntimeStatus('connected');
    return session.sessionId;
  }

  private async _runCell(index: number) {
    const cells = this._flushDraftSources();
    const cell = cells[index];
    if (!cell || cell.cell_type !== 'code') {
      return;
    }

    const cellKey = this._cellKey(cell, index);
    this._runningCellKeys.add(cellKey);
    this.requestUpdate();

    try {
      const sessionId = await this._ensureSession(
        serializeNotebook({ ...this._notebook, cells })
      );
      this._setRuntimeStatus('running');
      this._updateCell(index, {
        outputs: [
          {
            output_type: 'stream',
            name: 'status',
            text: '正在运行...',
          },
        ],
      });
      const result = await this._runtimeClient.execute(
        sessionId,
        sourceToString(cell.source),
        cell.id
      );
      this._updateCell(index, {
        execution_count: result.executionCount ?? cell.execution_count ?? null,
        outputs: result.outputs,
      });
      this.store.updateBlock(this.model, {
        lastExecutedAt: Date.now(),
        runtimeStatus: result.status === 'ok' ? 'connected' : 'error',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this._updateCell(index, {
        outputs: [
          {
            output_type: 'error',
            ename: 'RuntimeError',
            evalue: message,
          },
        ],
      });
      this._setRuntimeStatus('error');
      toast(this.host, `Notebook 运行失败：${message}`);
    } finally {
      this._runningCellKeys.delete(cellKey);
      this.requestUpdate();
    }
  }

  async runAllCodeCells() {
    const cells = this._flushDraftSources();
    const codeCellIndexes = cells
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => cell.cell_type === 'code')
      .map(({ index }) => index);

    for (const index of codeCellIndexes) {
      await this._runCell(index);
    }

    return codeCellIndexes.length;
  }

  private _renderOutput(output: NotebookOutput, index: number) {
    const png = output.data?.['image/png'];
    const jpeg = output.data?.['image/jpeg'];
    const image = png ?? jpeg;
    const imageData = Array.isArray(image) ? image.join('') : image;
    if (imageData) {
      const mime = png ? 'image/png' : 'image/jpeg';
      return html`<img
        alt="Notebook 输出图片"
        src=${`data:${mime};base64,${imageData}`}
      />`;
    }

    const text =
      output.output_type === 'error'
        ? [output.ename, output.evalue, ...(output.traceback ?? [])]
            .filter(Boolean)
            .join('\n')
        : outputText(output);
    return text ? html`<pre data-output-index=${index}>${text}</pre>` : nothing;
  }

  private _renderCell(cell: NotebookCell, index: number) {
    const source = this._cellSource(cell, index);
    return html`
      <div class=${`affine-jupyter-cell ${cell.cell_type}`}>
        <div class="affine-jupyter-cell-gutter">
          <button
            class="affine-jupyter-run"
            title="运行当前 cell"
            @pointerdown=${this._stopEditorEvent}
            @click=${(event: Event) => {
              this._stopEditorEvent(event);
              this._runCell(index).catch(console.error);
            }}
          >
            ▶
          </button>
          <span class="affine-jupyter-execution-label">
            ${this._executionLabel(cell, index)}
          </span>
        </div>
        <div class="affine-jupyter-cell-body">
          <textarea
            class=${`affine-jupyter-source ${cell.cell_type}`}
            spellcheck="false"
            .value=${source}
            @input=${(event: Event) =>
              this._handleSourceInput(cell, index, event)}
            @blur=${this._handleSourceBlur}
            @keydown=${(event: KeyboardEvent) =>
              this._handleSourceKeydown(cell, index, event)}
            @keyup=${this._stopEditorEvent}
            @beforeinput=${this._stopEditorEvent}
            @compositionstart=${this._stopEditorEvent}
            @compositionupdate=${this._stopEditorEvent}
            @compositionend=${this._stopEditorEvent}
            @pointerdown=${this._stopEditorEvent}
            @mousedown=${this._stopEditorEvent}
            @click=${this._stopEditorEvent}
            @dblclick=${this._stopEditorEvent}
            @cut=${this._stopEditorEvent}
            @copy=${this._stopEditorEvent}
            @paste=${this._stopEditorEvent}
          ></textarea>
          ${cell.outputs?.length
            ? html`<div class="affine-jupyter-output">
                ${cell.outputs.map((output, outputIndex) =>
                  this._renderOutput(output, outputIndex)
                )}
              </div>`
            : nothing}
        </div>
      </div>
    `;
  }

  override renderBlock() {
    const notebook = this._notebook;
    const codeCells = notebook.cells
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => cell.cell_type === 'code');
    return html`
      <div class="affine-jupyter-notebook">
        <div class="affine-jupyter-cell-list">
          ${repeat(
            codeCells,
            ({ cell, index }) => cell.id ?? `${cell.cell_type}-${index}`,
            ({ cell, index }) => this._renderCell(cell, index)
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-jupyter-notebook-block': JupyterNotebookBlockComponent;
  }
}
