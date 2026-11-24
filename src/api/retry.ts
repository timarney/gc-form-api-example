export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}

function retryAfterMs(response: Response): number | undefined {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit,
  options: RetryOptions = {},
): Promise<Response> {
  const attempts = options.attempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 500;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response: Response | undefined;
    try {
      response = await fetch(input, {
        ...init,
        signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
      });
      if (response.ok) return response;
      if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
        return response;
      }
      if (!isRetryableStatus(response.status) || attempt === attempts - 1) {
        const detail = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`);
      }
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("HTTP ")) throw error;
      lastError = error;
      if (attempt === attempts - 1) break;
    }

    const retryDelay = response ? retryAfterMs(response) : undefined;
    const exponentialDelay = Math.min(baseDelayMs * 2 ** attempt, 15_000);
    await wait(retryDelay ?? Math.round(exponentialDelay * (0.8 + Math.random() * 0.4)));
  }
  throw new Error(`Request failed after ${attempts} attempts`, { cause: lastError });
}

export async function checkedJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`);
  }
  return (await response.json()) as T;
}
