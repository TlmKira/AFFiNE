import { css } from 'lit';

export const jupyterNotebookBlockStyles = css`
  :host {
    display: block;
  }

  .affine-jupyter-notebook {
    background: transparent;
    font-family: var(--affine-font-family);
  }

  .affine-jupyter-cell-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0;
  }

  .affine-jupyter-cell {
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr);
    border: 1px solid var(--affine-border-color);
    border-radius: 7px;
    overflow: hidden;
    background: var(--affine-background-primary-color);
    transition:
      border-color 0.12s ease,
      box-shadow 0.12s ease;
  }

  .affine-jupyter-cell:focus-within {
    border-color: #1a73e8;
    box-shadow: 0 0 0 1px #1a73e8;
  }

  .affine-jupyter-cell-gutter {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 7px;
    padding: 12px 4px 8px;
    border-right: 1px solid var(--affine-border-color);
    background: #f8f9fa;
    color: var(--affine-text-secondary-color);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
  }

  .affine-jupyter-run {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: #202124;
    color: white;
    cursor: pointer;
    font-size: 11px;
    line-height: 1;
  }

  .affine-jupyter-run:hover {
    background: #1a73e8;
  }

  .affine-jupyter-execution-label {
    color: var(--affine-text-secondary-color);
    white-space: nowrap;
  }

  .affine-jupyter-cell-body {
    min-width: 0;
    padding: 0;
  }

  .affine-jupyter-source {
    box-sizing: border-box;
    width: 100%;
    min-height: 92px;
    resize: vertical;
    border: none;
    border-radius: 0;
    outline: none;
    padding: 12px 14px;
    background: #fff;
    color: var(--affine-text-primary-color);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
    line-height: 1.55;
  }

  .affine-jupyter-source:focus {
    box-shadow: inset 0 0 0 1px transparent;
  }

  .affine-jupyter-output {
    border-top: 1px solid var(--affine-border-color);
    padding: 10px 14px;
    background: var(--affine-background-primary-color);
  }

  .affine-jupyter-output pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
  }

  .affine-jupyter-output img {
    max-width: 100%;
    border-radius: 4px;
  }

  @media (max-width: 640px) {
    .affine-jupyter-cell {
      grid-template-columns: 44px minmax(0, 1fr);
    }
  }
`;
