import { GoogleGenAI, type GenerateContentParameters } from '@google/genai';

let key = '';
let generation = 0;
const active = new Set<AbortController>();
const cancelled = () => new Error('The API key changed or was cleared. Please start again.');
export const hasVisitorKey = () => Boolean(key);
export function setVisitorKey(value: string) {
  key = value.trim();
  generation++;
  for (const controller of active) controller.abort();
  active.clear();
}
export function redactVisitorKey<T>(value: T): T {
  return key ? JSON.parse(JSON.stringify(value).split(key).join('[redacted]')) : value;
}
export function safeProviderError(error: unknown): string {
  if (error instanceof Error && (error.message === 'Enter your Gemini API key in API settings before generating.' || error.message === cancelled().message)) return error.message;
  const status = (error as { status?: number })?.status;
  if (status === 400 || status === 401 || status === 403) return 'Gemini rejected the request. Check your API key, permissions and model access.';
  if (status === 429) return 'Gemini quota or rate limit reached. Check your account and try again later.';
  return 'Gemini could not complete the request. Check your key and connection, then try again.';
}
export function beginSession() {
  if (!key) throw new Error('Enter your Gemini API key in API settings before generating.');
  const sessionKey = key;
  const version = generation;
  const controller = new AbortController();
  active.add(controller);
  const ai = new GoogleGenAI({ apiKey: sessionKey, vertexai: false });
  const assertCurrent = () => { if (version !== generation || controller.signal.aborted) throw cancelled(); };
  return {
    assertCurrent,
    redact<T>(value: T): T { return JSON.parse(JSON.stringify(value).split(sessionKey).join('[redacted]')); },
    async generateContent(parameters: GenerateContentParameters) {
      assertCurrent();
      try {
        const response = await ai.models.generateContent({ ...parameters, config: { ...parameters.config, abortSignal: controller.signal } });
        assertCurrent();
        return response;
      } catch (error) {
        assertCurrent();
        throw new Error(safeProviderError(error));
      }
    },
    close() { active.delete(controller); },
  };
}
export type VisitorSession = ReturnType<typeof beginSession>;
