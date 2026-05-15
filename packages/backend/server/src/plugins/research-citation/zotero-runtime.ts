import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { Injectable, Logger } from '@nestjs/common';
import { JSDOM } from 'jsdom';

import { BadRequest, ResponseTooLargeError, safeFetch } from '../../base';
import { normalizeCitationDoi } from './citation-format';
import type {
  CitationAttachment,
  CitationMetadata,
  CitationTranslationCandidate,
  CitationTranslationResult,
} from './types';
import type { ZoteroTranslatorManifest } from './zotero-translator';

const FETCH_TIMEOUT_MS = 12_000;
const TRANSLATE_TIMEOUT_MS = 12_000;
const MAX_TRANSLATOR_BYTES = 2 * 1024 * 1024;
const TRANSLATOR_TYPES = {
  import: 1,
  export: 2,
  web: 4,
  search: 8,
} as const;

const SERVER_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const ZOTERO_TRANSLATE_ROOT = join(SERVER_ROOT, 'vendor/zotero-translate');
const ZOTERO_TRANSLATOR_ROOT = join(SERVER_ROOT, 'vendor/zotero-translators');
const ZOTERO_UTILITIES_ROOT = join(ZOTERO_TRANSLATE_ROOT, 'modules/utilities');

type ZoteroRuntimeContext = vm.Context & {
  Zotero: {
    Debug?: { init?: (level: number) => void };
    Date?: { init?: (formats: unknown) => void };
    Schema?: { init?: (schema: unknown) => void };
    HTTP: {
      StatusError: new (
        xmlhttp: ZoteroXMLHttpRequestLike,
        url: string
      ) => Error;
      TimeoutError: new (ms: number) => Error;
      request: (
        method: string,
        url: string,
        options?: ZoteroRequestOptions
      ) => Promise<ZoteroXMLHttpRequestLike>;
      processDocuments: (
        urls: string | string[],
        processor: (doc: Document) => unknown,
        options?: { headers?: Record<string, string> }
      ) => Promise<unknown[]>;
      wrapDocument: (doc: Document, url: string) => Document;
    };
    Translate: {
      Web: new () => ZoteroWebTranslate;
      ItemSaver: {
        prototype: {
          saveItems: (items: unknown[]) => Promise<unknown[]>;
        };
      };
    };
    Translator: new (info: ZoteroTranslatorManifest) => ZoteroTranslator;
    Translators: ZoteroTranslatorProvider;
    Utilities?: {
      cleanAuthor?: (
        name: string,
        creatorType?: string,
        useComma?: boolean
      ) => ZoteroCreator;
      trimInternal?: (value: string) => string;
    };
    debug?: (message: unknown, level?: number) => void;
    logError?: (error: unknown) => void;
  };
  window: unknown;
  document: Document;
};

type ZoteroRequestOptions = {
  body?: string | ArrayBuffer | Uint8Array | Buffer | null;
  headers?: Record<string, string>;
  timeout?: number;
  responseType?: '' | 'text' | 'json' | 'document' | 'arraybuffer';
  responseCharset?: string | null;
  successCodes?: number[] | false | null;
};

type ZoteroXMLHttpRequestLike = {
  status: number;
  statusText: string;
  response: unknown;
  responseText: string;
  responseURL: string;
  getAllResponseHeaders: () => string;
  getResponseHeader: (name: string) => string | null;
};

type ZoteroTranslator = ZoteroTranslatorManifest & {
  code?: string;
  file?: string;
  metadata?: ZoteroTranslatorManifest;
};

type ZoteroTranslatorProvider = {
  init: () => Promise<void>;
  get: (id: string) => Promise<ZoteroTranslator | false>;
  getCodeForTranslator: (translator: ZoteroTranslator) => Promise<string>;
  getAllForType: (
    type: keyof typeof TRANSLATOR_TYPES
  ) => Promise<ZoteroTranslator[]>;
  getWebTranslatorsForLocation: (
    uri: string,
    rootUri: string
  ) => Promise<[ZoteroTranslator[], Array<(url: string) => string>]>;
  _initialized?: boolean;
  _cache?: Record<string, ZoteroTranslator[]>;
};

type ZoteroWebTranslate = {
  document?: Document;
  newItems?: ZoteroItem[];
  setDocument: (doc: Document) => void;
  setTranslatorProvider: (provider: ZoteroTranslatorProvider) => void;
  setRequestHeaders: (headers: Record<string, string>) => void;
  setHandler: (name: string, handler: (...args: unknown[]) => unknown) => void;
  getTranslators: () => Promise<ZoteroTranslator[]>;
  translate: (options?: {
    libraryID?: false | number | null;
    saveAttachments?: boolean;
  }) => Promise<ZoteroItem[]>;
};

type ZoteroCreator = {
  firstName?: string;
  lastName?: string;
  name?: string;
  creatorType?: string;
};

type ZoteroItem = {
  itemType?: string;
  title?: string;
  creators?: ZoteroCreator[];
  date?: string;
  year?: string;
  publicationTitle?: string;
  journalAbbreviation?: string;
  conferenceName?: string;
  proceedingsTitle?: string;
  bookTitle?: string;
  websiteTitle?: string;
  repository?: string;
  DOI?: string;
  url?: string;
  abstractNote?: string;
  extra?: string;
  attachments?: CitationAttachment[];
};

function clean(value?: string | null) {
  return (
    value
      ?.replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() ?? ''
  );
}

function yearFromDate(value?: string | null) {
  return clean(value).match(/\d{4}/)?.[0];
}

function parseHttpUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new BadRequest('Translator URL is invalid.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequest('Only http and https URLs are supported.');
  }
  return url;
}

function withTimeout<T>(promise: Promise<T>, message: string) {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new BadRequest(message)),
        TRANSLATE_TIMEOUT_MS
      );
    }),
  ]);
}

function readTranslatorHeader(source: string) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let started = false;
  let start = -1;

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (!started) {
      if (/\s/.test(char)) continue;
      if (char !== '{') return null;
      started = true;
      start = index;
      depth = 1;
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return null;
}

@Injectable()
export class ResearchZoteroRuntimeService {
  private readonly logger = new Logger(ResearchZoteroRuntimeService.name);
  private contextPromise: Promise<ZoteroRuntimeContext> | null = null;
  private manifestCache: ZoteroTranslatorManifest[] | null = null;
  private codeCache = new Map<string, string>();

  async translateUrl(
    urlInput: string
  ): Promise<CitationTranslationResult | null> {
    const url = parseHttpUrl(urlInput);
    const html = await this.fetchText(url.toString());
    return await this.translateHtml(url.toString(), html);
  }

  async translateHtml(
    urlInput: string,
    html: string
  ): Promise<CitationTranslationResult | null> {
    const url = parseHttpUrl(urlInput);
    const context = await this.getContext();
    const doc = this.createDocument(context, html, url.toString());
    const translate = new context.Zotero.Translate.Web();
    const selectedTranslators: string[] = [];

    translate.setTranslatorProvider(context.Zotero.Translators);
    translate.setRequestHeaders({
      'User-Agent': 'AFFiNE Research Translator (Zotero-compatible)',
    });
    translate.setDocument(doc);
    translate.setHandler('translators', (_translate, translators) => {
      selectedTranslators.splice(
        0,
        selectedTranslators.length,
        ...(Array.isArray(translators)
          ? translators.map(translator => translator?.label).filter(Boolean)
          : [])
      );
    });
    translate.setHandler('debug', (_translate, message) => {
      if (message) this.logger.debug(String(message));
      return false;
    });

    try {
      const translators = await withTimeout(
        translate.getTranslators(),
        'Zotero translator detection timed out.'
      );
      if (!translators.length) return null;

      const items = await withTimeout(
        translate.translate({
          libraryID: false,
          saveAttachments: false,
        }),
        'Zotero translator execution timed out.'
      );
      const metadata = (items ?? [])
        .map(item => this.zoteroItemToMetadata(item, selectedTranslators[0]))
        .filter((item): item is CitationMetadata => !!item);
      if (!metadata.length) return null;

      const translator =
        selectedTranslators[0] ?? translators[0]?.label ?? 'Zotero Translator';
      if (metadata.length === 1) {
        return {
          kind: 'single',
          translator,
          metadata: metadata[0],
        };
      }
      return {
        kind: 'multiple',
        translator,
        items: metadata.map((item, index) =>
          this.metadataToCandidate(item, index)
        ),
      };
    } catch (error) {
      this.logger.debug(
        `Zotero runtime failed for ${url.hostname}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    } finally {
      this.destroyDocument(doc);
    }
  }

  async listTranslators() {
    const context = await this.getContext();
    await context.Zotero.Translators.init();
    return await this.listVendoredTranslators();
  }

  async matchTranslators(url: string) {
    const parsed = parseHttpUrl(url);
    const context = await this.getContext();
    await context.Zotero.Translators.init();
    const [translators] =
      await context.Zotero.Translators.getWebTranslatorsForLocation(
        parsed.toString(),
        parsed.toString()
      );
    return translators.map(translator => translator.metadata ?? translator);
  }

  private async getContext() {
    this.contextPromise ??= this.createContext();
    return await this.contextPromise;
  }

  private async createContext(): Promise<ZoteroRuntimeContext> {
    const { window } = new JSDOM(
      '<!doctype html><html><head></head><body></body></html>',
      { url: 'https://affine.local/' }
    );
    const context = vm.createContext({
      console,
      setTimeout,
      clearTimeout,
      URL,
      TextDecoder,
      TextEncoder,
      Promise,
      Node: window.Node,
      Element: window.Element,
      XMLSerializer: window.XMLSerializer,
      window: null,
      self: null,
      globalThis: null,
      document: window.document,
      navigator: window.navigator,
      DOMParser: window.DOMParser,
      XPathResult: window.XPathResult,
    }) as ZoteroRuntimeContext;
    context.window = context;
    context.self = context;
    context.globalThis = context;

    for (const file of this.runtimeFiles()) {
      await this.runScript(context, file);
    }

    const schema = JSON.parse(
      await readFile(
        join(ZOTERO_UTILITIES_ROOT, 'resource/schema/global/schema.json'),
        'utf8'
      )
    );
    const dateFormats = JSON.parse(
      await readFile(
        join(ZOTERO_UTILITIES_ROOT, 'resource/dateFormats.json'),
        'utf8'
      )
    );
    context.Zotero.Schema?.init?.(schema);
    context.Zotero.Date?.init?.(dateFormats);
    context.Zotero.Debug?.init?.(1);
    context.Zotero.debug = message => this.logger.debug(String(message));
    context.Zotero.logError = error =>
      this.logger.debug(error instanceof Error ? error.message : String(error));

    this.installHttp(context);
    this.installItemSaver(context);
    this.installTranslatorProvider(context);

    await context.Zotero.Translators.init();
    return context;
  }

  private runtimeFiles() {
    return [
      join(ZOTERO_TRANSLATE_ROOT, 'src/zotero.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/promise.js'),
      join(ZOTERO_UTILITIES_ROOT, 'openurl.js'),
      join(ZOTERO_UTILITIES_ROOT, 'date.js'),
      join(ZOTERO_UTILITIES_ROOT, 'xregexp-all.js'),
      join(ZOTERO_UTILITIES_ROOT, 'xregexp-unicode-zotero.js'),
      join(ZOTERO_UTILITIES_ROOT, 'utilities.js'),
      join(ZOTERO_UTILITIES_ROOT, 'utilities_item.js'),
      join(ZOTERO_UTILITIES_ROOT, 'schema.js'),
      join(ZOTERO_UTILITIES_ROOT, 'resource/zoteroTypeSchemaData.js'),
      join(ZOTERO_UTILITIES_ROOT, 'cachedTypes.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/utilities_translate.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/debug.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/http.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/translator.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/translators.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/repo.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/translation/translate.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/translation/sandboxManager.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/translation/translate_item.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/tlds.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/proxy.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/rdf/init.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/rdf/uri.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/rdf/term.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/rdf/identity.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/rdf/n3parser.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/rdf/rdfparser.js'),
      join(ZOTERO_TRANSLATE_ROOT, 'src/rdf/serialize.js'),
    ];
  }

  private async runScript(context: vm.Context, file: string) {
    const source = await readFile(file, 'utf8');
    vm.runInContext(source, context, {
      filename: file,
      displayErrors: true,
    });
  }

  private installTranslatorProvider(context: ZoteroRuntimeContext) {
    const provider = context.Zotero.Translators;
    const translatorById = new Map<string, ZoteroTranslator>();
    const service = this;

    provider.init = async function init() {
      const manifests = await service.listVendoredTranslators();
      const cache: Record<string, ZoteroTranslator[]> = {
        import: [],
        export: [],
        web: [],
        search: [],
      };
      translatorById.clear();

      for (const manifest of manifests) {
        try {
          const translator = new context.Zotero.Translator(
            manifest
          ) as ZoteroTranslator;
          translator.file = manifest.file;
          translator.metadata = manifest;
          translatorById.set(translator.translatorID, translator);

          for (const [type, bit] of Object.entries(TRANSLATOR_TYPES)) {
            if (translator.translatorType && translator.translatorType & bit) {
              cache[type].push(translator);
            }
          }
        } catch (error) {
          service.logger.debug(
            `Could not load Zotero translator ${manifest.label}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }

      for (const translators of Object.values(cache)) {
        translators.sort((a, b) =>
          a.priority === b.priority
            ? a.label.localeCompare(b.label)
            : a.priority - b.priority
        );
      }
      provider._cache = cache;
      provider._initialized = true;
    };

    provider.get = async function get(id: string) {
      if (!provider._initialized) await provider.init();
      const translator = translatorById.get(id);
      if (!translator) return false;
      translator.code ??= await provider.getCodeForTranslator(translator);
      return translator;
    };

    provider.getCodeForTranslator = async function getCodeForTranslator(
      translator: ZoteroTranslator
    ) {
      if (translator.code) return translator.code;
      const manifest =
        translator.metadata ??
        translatorById.get(translator.translatorID)?.metadata;
      const file = manifest?.file ?? translator.file;
      if (!file) {
        throw new Error(`Translator ${translator.label} has no local file.`);
      }
      const code = await service.readTranslatorCode(file);
      translator.code = code;
      return code;
    };

    provider.getAllForType = async function getAllForType(
      type: keyof typeof TRANSLATOR_TYPES
    ) {
      if (!provider._initialized) await provider.init();
      const translators = [...(provider._cache?.[type] ?? [])];
      await Promise.all(
        translators.map(async translator => {
          translator.code ??= await provider.getCodeForTranslator(translator);
        })
      );
      return translators;
    };
  }

  private installItemSaver(context: ZoteroRuntimeContext) {
    context.Zotero.Translate.ItemSaver.prototype.saveItems = async function (
      jsonItems: unknown[]
    ) {
      return jsonItems;
    };
  }

  private installHttp(context: ZoteroRuntimeContext) {
    const service = this;

    context.Zotero.HTTP.request = async function request(
      method: string,
      rawUrl: string,
      options: ZoteroRequestOptions = {}
    ) {
      const url = parseHttpUrl(rawUrl);
      try {
        const response = await safeFetch(
          url.toString(),
          {
            method,
            headers: {
              'User-Agent': 'AFFiNE Research Translator (Zotero-compatible)',
              Accept:
                'text/html,application/xhtml+xml,application/xml,text/plain,application/json,*/*',
              ...(options.headers ?? {}),
            },
            body:
              options.body == null
                ? undefined
                : (options.body as RequestInit['body']),
          },
          {
            timeoutMs: Math.min(options.timeout ?? FETCH_TIMEOUT_MS, 20_000),
            maxRedirects: 3,
            maxBytes: MAX_TRANSLATOR_BYTES,
          }
        );
        const responseType = options.responseType ?? '';
        const responseBuffer = await response.arrayBuffer();
        const responseText = new TextDecoder(
          options.responseCharset ?? undefined
        ).decode(responseBuffer);
        const responseObject =
          responseType === 'arraybuffer'
            ? responseBuffer
            : responseType === 'json'
              ? JSON.parse(responseText)
              : responseType === 'document'
                ? service.createDocument(context, responseText, response.url)
                : responseText;
        const headers = service.headersToString(response.headers);
        const xhr: ZoteroXMLHttpRequestLike = {
          status: response.status,
          statusText: response.statusText,
          response: responseObject,
          responseText,
          responseURL: response.url || url.toString(),
          getAllResponseHeaders: () => headers,
          getResponseHeader: name => response.headers.get(name),
        };
        const successCodes = options.successCodes ?? null;
        const invalidDefaultStatus =
          successCodes === null &&
          (response.status < 200 || response.status >= 300);
        const invalidStatus =
          Array.isArray(successCodes) &&
          !successCodes.includes(response.status);
        if (invalidDefaultStatus || invalidStatus) {
          throw new context.Zotero.HTTP.StatusError(xhr, url.toString());
        }
        return xhr;
      } catch (error) {
        if (error instanceof ResponseTooLargeError) {
          throw new BadRequest('Translator response is too large.');
        }
        throw error;
      }
    };

    context.Zotero.HTTP.wrapDocument = (doc, url) =>
      service.wrapDocument(doc, url);

    context.Zotero.HTTP.processDocuments = async (
      urls,
      processor,
      options = {}
    ) => {
      const list = Array.isArray(urls) ? urls : [urls];
      const results: unknown[] = [];
      for (const url of list) {
        const xhr = await context.Zotero.HTTP.request('GET', url, {
          headers: options.headers,
          responseType: 'document',
        });
        results.push(await processor(xhr.response as Document));
      }
      return results;
    };
  }

  private createDocument(
    context: ZoteroRuntimeContext,
    html: string,
    url: string
  ) {
    const { window } = new JSDOM(
      html || '<!doctype html><html><head></head><body></body></html>',
      { url }
    );
    const doc = window.document;
    const wrapped = this.wrapDocument(doc as unknown as Document, url);
    context.document = wrapped;
    return wrapped;
  }

  private wrapDocument(doc: Document, url: string) {
    const location = new URL(url);
    const target = doc as Document & { documentURI?: string };
    try {
      Object.defineProperty(target, 'documentURI', {
        configurable: true,
        value: url,
      });
    } catch {
      // Some DOM implementations expose documentURI as read-only.
    }

    const wrappedDoc = new Proxy(target, {
      get(target, prop, receiver) {
        if (prop === 'location') return location;
        if (prop === 'URL') return location.href;
        if (prop === 'documentURI') return location.href;
        if (prop === 'evaluate') {
          return (...args: unknown[]) => {
            if (args[1] === wrappedDoc) args[1] = target;
            const evaluate = (
              target as Document & {
                evaluate: (...args: unknown[]) => unknown;
              }
            ).evaluate;
            return evaluate.apply(target, args);
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    return wrappedDoc as Document;
  }

  private destroyDocument(doc: Document) {
    try {
      (
        doc as Document & { defaultView?: { close?: () => void } | null }
      ).defaultView?.close?.();
    } catch {
      // happy-dom cleanup is best-effort.
    }
  }

  private headersToString(headers: Headers) {
    return Array.from(headers.entries())
      .map(([key, value]) => `${key}: ${value}`)
      .join('\r\n');
  }

  private async fetchText(url: string) {
    const response = await safeFetch(
      url,
      {
        headers: {
          'User-Agent': 'AFFiNE Research Translator (Zotero-compatible)',
          Accept:
            'text/html,application/xhtml+xml,application/xml,text/plain,*/*',
        },
      },
      {
        timeoutMs: FETCH_TIMEOUT_MS,
        maxRedirects: 3,
        maxBytes: MAX_TRANSLATOR_BYTES,
      }
    );
    if (!response.ok || !response.body) {
      throw new BadRequest(`Translator fetch failed: ${response.status}`);
    }
    return await response.text();
  }

  private async listVendoredTranslators() {
    if (this.manifestCache) return this.manifestCache;
    const files = (await readdir(ZOTERO_TRANSLATOR_ROOT)).filter(file =>
      file.endsWith('.js')
    );
    const manifests = await Promise.all(
      files.map(async file => {
        const source = await readFile(
          join(ZOTERO_TRANSLATOR_ROOT, file),
          'utf8'
        );
        const header = readTranslatorHeader(source);
        return header
          ? ({ ...JSON.parse(header), file } as ZoteroTranslatorManifest)
          : null;
      })
    );
    this.manifestCache = manifests
      .filter((item): item is ZoteroTranslatorManifest => !!item)
      .sort((a, b) =>
        a.priority === b.priority
          ? a.label.localeCompare(b.label)
          : a.priority - b.priority
      );
    return this.manifestCache;
  }

  private async readTranslatorCode(file: string) {
    if (this.codeCache.has(file)) return this.codeCache.get(file) ?? '';
    const code = await readFile(join(ZOTERO_TRANSLATOR_ROOT, file), 'utf8');
    this.codeCache.set(file, code);
    return code;
  }

  private zoteroItemToMetadata(
    item: ZoteroItem,
    translator?: string
  ): CitationMetadata | null {
    const title = clean(item.title);
    if (!title) return null;
    const doi = normalizeCitationDoi(
      item.DOI ?? item.extra?.match(/\bDOI:\s*([^\s]+)\b/i)?.[1]
    );
    const authors = item.creators
      ?.filter(
        creator => !creator.creatorType || creator.creatorType === 'author'
      )
      .map(creator =>
        clean(
          creator.name ||
            [creator.firstName, creator.lastName].filter(Boolean).join(' ')
        )
      )
      .filter(Boolean)
      .slice(0, 16);
    const source = clean(
      item.publicationTitle ||
        item.proceedingsTitle ||
        item.conferenceName ||
        item.bookTitle ||
        item.websiteTitle ||
        item.repository ||
        item.journalAbbreviation
    );
    const attachments = item.attachments
      ?.map(attachment => ({
        title: clean(attachment.title),
        url: clean(attachment.url),
        mimeType: clean(attachment.mimeType),
      }))
      .filter(attachment => attachment.url || attachment.title);

    return {
      title,
      authors,
      year: item.year ?? yearFromDate(item.date),
      source: source || translator,
      doi,
      url: clean(item.url) || (doi ? `https://doi.org/${doi}` : undefined),
      abstract: clean(item.abstractNote),
      attachments: attachments?.length ? attachments : undefined,
      provider: 'zotero-translator',
      confidence: doi ? 0.92 : 0.82,
      reliable: true,
    };
  }

  private metadataToCandidate(
    metadata: CitationMetadata,
    index: number
  ): CitationTranslationCandidate {
    return {
      id: metadata.doi ?? metadata.arxivId ?? metadata.url ?? `${index}`,
      title: metadata.title,
      url: metadata.url,
      metadata,
    };
  }
}
