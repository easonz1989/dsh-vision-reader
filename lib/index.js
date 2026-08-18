import z from "@deepseek-ai/schemastery";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region src/index.ts
/** Durable settings namespace: Provider config lives in $DSH_HOME/settings.yaml. */
const NS = settingsNamespace("vision-reader");
const SCHEMA = z.object({
	baseUrl: z.string(),
	apiKey: z.string(),
	selectedModel: z.string(),
	followLocale: z.boolean().default(false)
});
const MODEL_TIMEOUT_MS = 4e4;
const ANALYZE_TIMEOUT_MS = 15e4;
const DEFAULT_PROMPT = "请用简洁清晰的中文，描述这张图片/影片的内容与关键细节。";
/** Normalize a user-supplied base URL to `https://host/v1`-style (no trailing slash). */
function normalizeBaseUrl(url) {
	let u = (url || "").trim();
	if (!u) return "";
	if (!/^https?:\/\//i.test(u)) u = "https://" + u;
	return u.replace(/\/+$/, "");
}
/** Whether an OpenAI-compatible model id / capabilities look vision-capable. */
function looksVision(id, caps) {
	const s = String(id || "").toLowerCase();
	if (caps && typeof caps === "object") {
		const c = caps;
		if (Array.isArray(c.input_modalities)) return c.input_modalities.includes("image");
		if (Array.isArray(c.modalities)) return c.modalities.includes("image");
		if (c.supports_vision) return true;
	}
	const yes = /gpt-4o|gpt-4\.1|gpt-4-vision|vision|v[_-]?lm|gemini|claude|qwen[_-]?vl|qwen2\.[25]-vl|internvl|glm-4v|glm-4\.5v|llava|pixtral|molmo|idefics|paligemma|gemma-3|kimi-latest|step-1v|doubao-1\.5-vision|hunyuan-vision|yi-vision|o3|o4-mini|grok-2-vision|phi-4-vision/i.test(s);
	const no = /embed|davinci|babbage|whisper|tts|rerank|jina-embed|text-embedding|replicate:/.test(s);
	const textOnly = /^gpt-3\.5|^text-|^babbage|^davinci|^codex-|^o1-mini|^o1-preview/.test(s);
	if (yes) return true;
	if (no || textOnly) return false;
	return true;
}
function rpcInternal(message) {
	return {
		ok: false,
		error: {
			code: "internal",
			message,
			details: {}
		}
	};
}
function rpcFail(endpoint, message) {
	return {
		ok: false,
		error: {
			code: "internal",
			message: `${endpoint}: ${message}`,
			details: {}
		}
	};
}
async function fetchJson(url, init, timeoutMs) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			...init,
			signal: controller.signal
		});
		const text = await res.text();
		let body;
		try {
			body = JSON.parse(text);
		} catch {
			body = text;
		}
		return {
			status: res.status,
			body,
			text
		};
	} finally {
		clearTimeout(timer);
	}
}
async function probeProvider(config) {
	const base = normalizeBaseUrl(config.baseUrl);
	if (!base) return {
		ok: false,
		error: "请先填写 Provider API Base URL",
		models: []
	};
	const headers = {};
	if (config.apiKey) headers["Authorization"] = "Bearer " + config.apiKey;
	try {
		const { status, body } = await fetchJson(base + "/models", {
			method: "GET",
			headers
		}, MODEL_TIMEOUT_MS);
		if (status >= 200 && status < 300) {
			const arr = body?.data;
			const models = (Array.isArray(arr) ? arr : []).map((m) => {
				const rec = m;
				const id = String(rec.id ?? rec.name ?? "");
				return {
					id,
					name: String(rec.name ?? rec.id ?? id),
					vision: looksVision(id, rec)
				};
			});
			return {
				ok: true,
				status,
				count: models.length,
				models
			};
		}
		return {
			ok: false,
			error: `Provider 返回 HTTP ${status}: ${JSON.stringify(body).slice(0, 300)}`,
			status,
			models: []
		};
	} catch (e) {
		return {
			ok: false,
			error: `请求 Provider 失败: ${e instanceof Error ? e.message : String(e)}`,
			models: []
		};
	}
}
async function analyzeMedia(config, prompt, media) {
	const base = normalizeBaseUrl(config.baseUrl);
	if (!base) return {
		ok: false,
		error: "请先配置 Provider API Base URL"
	};
	if (!config.selectedModel) return {
		ok: false,
		error: "请先在设置中选择支持视觉的模型"
	};
	const content = /^image\//.test(media.mime) ? [{
		type: "text",
		text: prompt
	}, {
		type: "image_url",
		image_url: { url: media.dataUrl }
	}] : [{
		type: "text",
		text: prompt
	}, {
		type: "input_video",
		video: media.dataUrl
	}];
	const payload = {
		model: config.selectedModel,
		messages: [{
			role: "user",
			content
		}],
		max_tokens: 1200
	};
	const headers = { "Content-Type": "application/json" };
	if (config.apiKey) headers["Authorization"] = "Bearer " + config.apiKey;
	try {
		const { status, body } = await fetchJson(base + "/chat/completions", {
			method: "POST",
			headers,
			body: JSON.stringify(payload)
		}, ANALYZE_TIMEOUT_MS);
		if (status >= 200 && status < 300) {
			const rec = body;
			const answer = rec.choices?.[0]?.message?.content ?? String(rec.output_text ?? JSON.stringify(body));
			return {
				ok: true,
				text: String(answer),
				model: config.selectedModel,
				media: media.name
			};
		}
		return {
			ok: false,
			error: `分析失败 HTTP ${status}: ${JSON.stringify(body).slice(0, 500)}`,
			status
		};
	} catch (e) {
		return {
			ok: false,
			error: `调用 Provider 失败: ${e instanceof Error ? e.message : String(e)}`
		};
	}
}
const name = "dsh-vision-reader";
const inject = [
	"connection",
	"tools",
	"settings"
];
function apply(ctx) {
	let settings;
	let pendingMedia = null;
	ctx.effect(() => () => {
		settings = void 0;
		pendingMedia = null;
	}, "dsh-vision-reader: state teardown");
	ctx.inject(["settings"], (sctx) => {
		settings = sctx.settings.register(NS, SCHEMA, { base: {
			baseUrl: "",
			apiKey: "",
			selectedModel: "",
			followLocale: false
		} });
	});
	const getConfig = () => {
		const s = settings?.get();
		return {
			baseUrl: s?.baseUrl ?? "",
			apiKey: s?.apiKey ?? "",
			selectedModel: s?.selectedModel ?? "",
			followLocale: s?.followLocale ?? false
		};
	};
	ctx.inject(["connection"], (cc) => {
		cc.connection.rpc.handle("/vision-reader", async (endpoint, payload) => {
			try {
				const p = payload ?? {};
				const cfg = getConfig();
				if (endpoint === "save-config") {
					await settings?.update({
						baseUrl: normalizeBaseUrl(typeof p.baseUrl === "string" ? p.baseUrl : cfg.baseUrl),
						apiKey: typeof p.apiKey === "string" ? p.apiKey : cfg.apiKey
					});
					return {
						ok: true,
						value: { hasKey: !!getConfig().apiKey }
					};
				}
				if (endpoint === "probe") return {
					ok: true,
					value: await probeProvider(getConfig())
				};
				if (endpoint === "set-model") {
					const model = (await probeProvider(getConfig())).models.find((m) => m.id === p.model);
					if (!model) return rpcFail("set-model", "模型不在列表中: " + String(p.model));
					if (!model.vision) return {
						ok: false,
						error: {
							code: "internal",
							message: `选择失败：「${model.id}」不支持视觉(VL)功能，无法用于图片/影片分析。`,
							details: {}
						}
					};
					await settings?.update({ selectedModel: model.id });
					return {
						ok: true,
						value: { model: model.id }
					};
				}
				if (endpoint === "receive-media") {
					const dataUrl = typeof p.dataUrl === "string" ? p.dataUrl : "";
					if (!dataUrl) return rpcFail("receive-media", "未收到媒体数据");
					if (dataUrl.length > 31457280) return rpcFail("receive-media", "媒体文件过大（超过约 20MB），请压缩后重试。");
					pendingMedia = {
						name: String(p.name ?? "media"),
						mime: String(p.mime ?? "application/octet-stream"),
						dataUrl
					};
					return {
						ok: true,
						value: { media: {
							name: pendingMedia.name,
							mime: pendingMedia.mime,
							mediaId: "m-" + Date.now()
						} }
					};
				}
				if (endpoint === "get-state") return {
					ok: true,
					value: {
						baseUrl: cfg.baseUrl,
						hasKey: !!cfg.apiKey,
						selectedModel: cfg.selectedModel,
						followLocale: cfg.followLocale,
						media: pendingMedia ? {
							name: pendingMedia.name,
							mime: pendingMedia.mime
						} : null
					}
				};
				if (endpoint === "analyze") {
					const prompt = typeof p.prompt === "string" && p.prompt ? p.prompt : DEFAULT_PROMPT;
					if (!pendingMedia) return {
						ok: false,
						error: {
							code: "internal",
							message: "请先通过 Upload 上传图片或影片。",
							details: {}
						}
					};
					return {
						ok: true,
						value: await analyzeMedia(getConfig(), prompt, pendingMedia)
					};
				}
				return rpcFail(endpoint, "未知 endpoint");
			} catch (e) {
				return rpcInternal(e instanceof Error ? e.message : String(e));
			}
		}, { authority: "trusted-host" });
	});
	ctx.inject(["tools"], (tctx) => {
		tctx.tools.register(defineTool({
			name: "analyze_media",
			description: "分析用户已上传的图片或影片：把当前上传的媒体发送给你配置的视觉(VL) Provider，返回模型的分析结果。前置条件：插件设置中已填写 Provider 并选择支持视觉的模型，且用户已通过输入框旁的 Upload 按钮上传媒体。参数 prompt 为可选的分析要求。",
			parameters: { prompt: {
				type: "string",
				description: "可选，具体的分析要求或问题（例如“用中文描述画面内容”）。"
			} },
			output: {
				schema: { type: "json" },
				render: (_args, value) => [{
					type: "text",
					text: JSON.stringify(value, null, 2)
				}]
			},
			async execute(args) {
				if (!pendingMedia) return {
					ok: false,
					error: "请先通过 Upload 上传图片或影片。"
				};
				return analyzeMedia(getConfig(), args?.prompt ?? DEFAULT_PROMPT, pendingMedia);
			},
			presentCall: (args) => ({
				card: "generic",
				title: "分析媒体",
				kind: "other",
				rawInput: args
			})
		}));
	});
	return () => {
		pendingMedia = null;
	};
}
//#endregion
export { NS, SCHEMA, apply, apply as default, inject, name };

//# sourceMappingURL=index.js.map