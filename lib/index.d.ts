import z from "@deepseek-ai/schemastery";
import { Context } from "@deepseek-ai/cordis";
//#region src/index.d.ts
/**
 * Minimal local wire types for the Client→Host RPC channel. Matches the DSH
 * `RpcResult`/`RpcError` contract used by `ctx.connection.rpc` without depending
 * on an internal @deepseek-ai package that is not published for consumers.
 */
interface RpcError {
  code: string;
  message: string;
  details: Record<string, unknown>;
}
type RpcResult<T> = {
  ok: true;
  value: T;
} | {
  ok: false;
  error: RpcError;
};
/** Durable settings namespace: Provider config lives in $DSH_HOME/settings.yaml. */
declare const NS: import("@deepseek-ai/dsh-settings").SettingsNamespace;
declare const SCHEMA: z<Schemastery.ObjectS<{
  baseUrl: z<string, string>;
  apiKey: z<string, string>;
  selectedModel: z<string, string>;
  followLocale: z<boolean, boolean>;
}>, Schemastery.ObjectT<{
  baseUrl: z<string, string>;
  apiKey: z<string, string>;
  selectedModel: z<string, string>;
  followLocale: z<boolean, boolean>;
}>>;
interface VisionConfig {
  baseUrl: string;
  apiKey: string;
  selectedModel: string;
  followLocale: boolean;
}
interface ModelDescriptor {
  id: string;
  name: string;
  vision: boolean;
}
interface ProbeResult {
  ok: boolean;
  error?: string;
  status?: number;
  count?: number;
  models: ModelDescriptor[];
}
interface AnalyzeResult {
  ok: boolean;
  error?: string;
  text?: string;
  model?: string;
  media?: string;
  status?: number;
}
interface MediaItem {
  name: string;
  mime: string;
  dataUrl: string;
}
declare const name = "dsh-vision-reader";
declare const inject: string[];
declare function apply(ctx: Context): () => void;
//#endregion
export { AnalyzeResult, MediaItem, ModelDescriptor, NS, ProbeResult, RpcError, RpcResult, SCHEMA, VisionConfig, apply, apply as default, inject, name };
//# sourceMappingURL=index.d.ts.map