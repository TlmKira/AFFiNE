import type { DocsService } from '@affine/core/modules/doc';
import { Service } from '@toeverything/infra';
import { map, type Observable } from 'rxjs';

import type { FilterProvider } from '../../provider';
import type { FilterParams } from '../../types';

function hasPaperProperty(value: unknown) {
  if (!value) return false;
  if (typeof value === 'object') {
    return !!(value as { title?: unknown }).title;
  }
  if (typeof value !== 'string') return false;
  try {
    const parsed = JSON.parse(value) as { title?: unknown };
    return !!parsed.title;
  } catch {
    return false;
  }
}

export class PaperFilterProvider extends Service implements FilterProvider {
  constructor(private readonly docsService: DocsService) {
    super();
  }

  filter$(params: FilterParams): Observable<Set<string>> {
    const expected = params.value !== 'false';
    if (params.method !== 'is' && params.method !== 'is-not') {
      throw new Error(`Unsupported paper filter method: ${params.method}`);
    }
    const invert = params.method === 'is-not';

    return this.docsService.list.docs$.pipe(
      map(docs => {
        const match = new Set<string>();
        for (const doc of docs) {
          const hasPaper = hasPaperProperty(doc.getProperties().paper);
          if ((hasPaper === expected) !== invert) {
            match.add(doc.id);
          }
        }
        return match;
      })
    );
  }
}
