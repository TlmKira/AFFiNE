import {
  assertSafeUrl as assertSafeUrlFromNative,
  safeFetch as safeFetchFromNative,
  type SafeFetchRequest,
} from '../../native';
import { ResponseTooLargeError, SsrfBlockedError } from '../error/errors.gen';

export type SSRFBlockReason =
  | 'invalid_url'
  | 'disallowed_protocol'
  | 'url_has_credentials'
  | 'blocked_hostname'
  | 'unresolvable_hostname'
  | 'blocked_ip'
  | 'too_many_redirects';

const SSRF_REASONS = new Set<string>([
  'invalid_url',
  'disallowed_protocol',
  'url_has_credentials',
  'blocked_hostname',
  'unresolvable_hostname',
  'blocked_ip',
  'too_many_redirects',
]);

function createSsrfBlockedError(reason: SSRFBlockReason) {
  return new SsrfBlockedError({ reason });
}

function mapNativeFetchError(error: unknown, limitBytes?: number) {
  const message = error instanceof Error ? error.message : String(error);
  const reason = [...SSRF_REASONS].find(reason => message.includes(reason));
  if (reason) {
    return createSsrfBlockedError(reason as SSRFBlockReason);
  }
  if (message.includes('response_too_large')) {
    return new ResponseTooLargeError({
      limitBytes: limitBytes ?? 0,
      receivedBytes: limitBytes ? limitBytes + 1 : 0,
    });
  }
  return error;
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
}

export async function assertSsrFSafeUrl(rawUrl: string | URL): Promise<URL> {
  let url: URL;
  try {
    url = rawUrl instanceof URL ? rawUrl : new URL(rawUrl);
  } catch {
    throw createSsrfBlockedError('invalid_url');
  }

  try {
    assertSafeUrlFromNative({ url: url.toString() });
    return url;
  } catch (error) {
    throw mapNativeFetchError(error);
  }
}

export async function safeFetch(
  rawUrl: string | URL,
  init: RequestInit = {},
  options: SafeFetchOptions = {}
): Promise<Response> {
  const url = rawUrl.toString();
  const method = String(init.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    throw new Error(`Unsupported safeFetch method: ${method}`);
  }

  try {
    const response = await safeFetchFromNative({
      url,
      method: (method === 'HEAD' ? 'head' : 'get') as NonNullable<
        SafeFetchRequest['method']
      >,
      headers: normalizeHeaders(init.headers),
      timeoutMs: options.timeoutMs,
      maxRedirects: options.maxRedirects,
      maxBytes: options.maxBytes,
    });
    const body =
      method === 'HEAD' || [204, 205, 304].includes(response.status)
        ? null
        : response.body;
    const webResponse = new Response(body, {
      status: response.status,
      headers: response.headers,
    });
    Object.defineProperty(webResponse, 'url', {
      value: response.finalUrl,
    });
    return webResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('failed to build http client')) {
      return await safeFetchWithWebApi(rawUrl, init, options, method);
    }
    throw mapNativeFetchError(error, options.maxBytes);
  }
}

async function safeFetchWithWebApi(
  rawUrl: string | URL,
  init: RequestInit,
  options: SafeFetchOptions,
  method: string
) {
  let url = await assertSsrFSafeUrl(rawUrl);
  const maxRedirects = options.maxRedirects ?? 0;
  let redirects = 0;

  while (true) {
    const controller = new AbortController();
    const timeout = options.timeoutMs
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : null;
    try {
      const response = await fetch(url, {
        headers: normalizeHeaders(init.headers),
        method,
        redirect: 'manual',
        signal: controller.signal,
      });
      if (timeout) clearTimeout(timeout);

      const location = response.headers.get('location');
      if (
        location &&
        response.status >= 300 &&
        response.status < 400 &&
        ![304, 305, 306].includes(response.status)
      ) {
        if (redirects >= maxRedirects) {
          throw createSsrfBlockedError('too_many_redirects');
        }
        url = await assertSsrFSafeUrl(new URL(location, url));
        redirects += 1;
        continue;
      }

      const body =
        method === 'HEAD' || [204, 205, 304].includes(response.status)
          ? null
          : await limitedResponseBody(response, options.maxBytes);
      const webResponse = new Response(body, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
      });
      Object.defineProperty(webResponse, 'url', {
        value: response.url || url.toString(),
      });
      return webResponse;
    } catch (error) {
      if (timeout) clearTimeout(timeout);
      throw error;
    }
  }
}

async function limitedResponseBody(response: Response, maxBytes?: number) {
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (maxBytes && contentLength > maxBytes) {
    throw new ResponseTooLargeError({
      limitBytes: maxBytes,
      receivedBytes: contentLength,
    });
  }

  const body = await response.arrayBuffer();
  if (maxBytes && body.byteLength > maxBytes) {
    throw new ResponseTooLargeError({
      limitBytes: maxBytes,
      receivedBytes: body.byteLength,
    });
  }
  return body;
}

function normalizeHeaders(headers: RequestInit['headers'] | undefined) {
  if (!headers) return undefined;
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, String(value)])
  );
}

export function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy.buffer;
}
