window.__ModuleLoader__.load({
	id: "dsh-vision-reader",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/index.tsx
		const NS = "vision-reader";
		const CHANNEL = "/vision-reader";
		const MAX_MEDIA_ITEMS = 6;
		let latestFollowLocale = true;
		const dict = {
			zh: {
				nav: "视觉模型",
				title: "视觉模型",
				hint: "连接 OpenAI 兼容的视觉 Provider。地址与密钥只保存在 DS Harness 服务端，不会发送到浏览器设置。",
				providerTitle: "Provider 连接",
				providerCaption: "OpenAI-compatible API",
				baseUrl: "API Base URL",
				baseUrlPlaceholder: "https://provider.example.com/v1",
				apiKey: "API Key",
				apiKeyPlaceholder: "输入 VISION_KEY",
				apiKeyFilled: "已安全保存；留空保持原密钥",
				envHint: "服务端环境：VISION_BASE · VISION_KEY",
				save: "保存",
				saving: "保存中…",
				probe: "检测连接",
				probing: "检测中…",
				saved: "设置已安全保存",
				healthOk: "连接正常 · HTTP {status} · {count} 个模型",
				healthBad: "Provider 检测失败",
				notProbed: "尚未检测连接",
				modelTitle: "视觉模型",
				modelHint: "选择处理已附加图片与影片的模型。",
				noModels: "检测 Provider 后会在这里显示模型。",
				selected: "当前：{model}",
				supported: "支持视觉",
				unsupported: "未声明视觉能力",
				followLabel: "设置标题跟随界面语言",
				followHint: "关闭后固定显示“视觉模型”。",
				upload: "添加媒体",
				uploadBusy: "正在添加…",
				uploadTip: "添加最多 6 张图片或影片",
				uploadFail: "无法添加媒体：{err}",
				conversationUnavailable: "Harness 附件服务尚未就绪"
			},
			en: {
				nav: "Visual Model",
				title: "Visual Model",
				hint: "Connect an OpenAI-compatible vision provider. The endpoint and key stay on the DS Harness server and are never projected into browser settings.",
				providerTitle: "Provider connection",
				providerCaption: "OpenAI-compatible API",
				baseUrl: "API Base URL",
				baseUrlPlaceholder: "https://provider.example.com/v1",
				apiKey: "API Key",
				apiKeyPlaceholder: "Enter VISION_KEY",
				apiKeyFilled: "Securely saved; leave blank to keep it",
				envHint: "Server environment: VISION_BASE · VISION_KEY",
				save: "Save",
				saving: "Saving…",
				probe: "Test connection",
				probing: "Testing…",
				saved: "Settings saved securely",
				healthOk: "Connected · HTTP {status} · {count} models",
				healthBad: "Provider check failed",
				notProbed: "Connection has not been tested",
				modelTitle: "Vision model",
				modelHint: "Choose the model that processes attached images and videos.",
				noModels: "Models appear here after testing the provider.",
				selected: "Current: {model}",
				supported: "Vision capable",
				unsupported: "Vision capability not declared",
				followLabel: "Follow the interface language",
				followHint: "When off, the section name stays “视觉模型”.",
				upload: "Add media",
				uploadBusy: "Adding…",
				uploadTip: "Attach up to 6 images or videos",
				uploadFail: "Could not add media: {err}",
				conversationUnavailable: "Harness attachment service is not ready"
			}
		};
		const styles = `
.vr-section{display:flex;flex-direction:column;gap:12px;max-width:720px;color:var(--dsw-alias-label-primary)}
.vr-title{margin:0;font-size:16px;line-height:24px;font-weight:500}.vr-intro{margin:0;font-size:14px;line-height:22px;color:var(--dsw-alias-label-tertiary)}
.vr-card{border-radius:12px;background:var(--dsw-alias-bg-module-platform);padding:14px 16px;display:flex;flex-direction:column;gap:14px}
.vr-card-head{display:flex;align-items:baseline;gap:8px}.vr-card-title{font-size:14px;line-height:22px;font-weight:500}.vr-caption,.vr-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.vr-field{display:flex;flex-direction:column;gap:6px}.vr-label{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.vr-input{box-sizing:border-box;width:100%;height:36px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;outline:none}
.vr-input:focus{border-color:var(--dsw-alias-border-l3);box-shadow:0 0 0 2px var(--dsw-alias-interactive-bg-hover)}
.vr-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding-top:2px}.vr-button{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;height:36px;padding:0 14px;border-radius:18px;font:inherit;font-size:14px;line-height:22px;cursor:pointer}
.vr-primary{border:0;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}.vr-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}
.vr-secondary{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary)}.vr-secondary:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}
.vr-button:disabled{opacity:.4;cursor:default}.vr-button:focus-visible,.vr-model:focus-visible,.vr-upload:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}
.vr-status{display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l3);border-radius:10px;font-size:12px;line-height:18px}.vr-dot{flex:none;width:8px;height:8px;border-radius:50%;margin-top:5px;background:var(--dsw-alias-label-tertiary)}.vr-ok .vr-dot{background:var(--dsw-alias-state-success-primary)}.vr-bad .vr-dot{background:var(--dsw-alias-state-error-primary)}
.vr-error{color:var(--dsw-alias-state-error-primary);white-space:pre-wrap}.vr-saved{color:var(--dsw-alias-state-success-primary);font-size:12px;line-height:18px}
.vr-models{display:flex;flex-direction:column;gap:8px}.vr-model{box-sizing:border-box;width:100%;display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}.vr-model:hover{background:var(--dsw-alias-interactive-bg-hover)}.vr-model-selected{border-color:var(--dsw-alias-border-l3);background:var(--dsw-alias-interactive-bg-hover-solid)}
.vr-radio{box-sizing:border-box;flex:none;width:16px;height:16px;border:1px solid var(--dsw-alias-border-l3);border-radius:50%;padding:3px}.vr-model-selected .vr-radio:after{content:'';display:block;width:100%;height:100%;border-radius:50%;background:var(--dsw-alias-button-primary-fill)}.vr-model-copy{min-width:0;flex:1}.vr-model-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:20px}.vr-model-meta{display:block;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.vr-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 0}.vr-toggle-copy{display:flex;flex-direction:column;gap:2px}.vr-switch{position:relative;flex:none;width:36px;height:20px;border:0;border-radius:10px;background:var(--dsw-alias-bg-module-platform);box-shadow:inset 0 0 0 1px var(--dsw-alias-border-l2);cursor:pointer}.vr-switch:after{content:'';position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-tertiary);transition:transform .16s ease}.vr-switch-on{background:var(--dsw-alias-button-primary-fill);box-shadow:none}.vr-switch-on:after{transform:translateX(16px);background:var(--dsw-alias-label-primary-foreground)}
.vr-upload-wrap{position:relative;display:inline-flex;align-items:center}.vr-upload{box-sizing:border-box;display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}.vr-upload:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}.vr-upload svg{width:15px;height:15px}.vr-upload-error{position:absolute;left:0;top:34px;z-index:20;width:max-content;max-width:300px;padding:7px 9px;border-radius:8px;background:var(--dsw-alias-bg-module-platform);box-shadow:0 4px 18px rgba(0,0,0,.18);color:var(--dsw-alias-state-error-primary);font-size:11px;line-height:16px}
`;
		function fmt(template, vars) {
			return template.replace(/\{(\w+)\}/g, (_match, key) => String(vars[key] ?? ""));
		}
		const name = "dsh-vision-reader";
		const inject = [
			"slots",
			"locale",
			"connection",
			"settingsScope",
			"conversation"
		];
		async function apply(ctx) {
			const slots = ctx.get("slots");
			const locale = ctx.get("locale");
			const connection = ctx.get("connection");
			const settingsScope = ctx.get("settingsScope");
			const conversation = ctx.get("conversation");
			if (!slots || !locale || !connection || !settingsScope) return;
			const t = locale.bind(NS);
			ctx.effect(() => {
				const dispose = locale.register(NS, dict);
				return () => {
					if (typeof dispose === "function") dispose();
				};
			}, "dsh-vision-reader: dictionaries");
			ctx.effect(() => {
				const element = document.createElement("style");
				element.dataset["dshVisionReader"] = "true";
				element.textContent = styles;
				document.head.append(element);
				return () => {
					element.remove();
				};
			}, "dsh-vision-reader: styles");
			const scope = settingsScope.bind({ namespace: NS });
			const call = async (endpoint, payload = {}) => {
				const result = await connection.rpc.call(CHANNEL, endpoint, payload);
				if (result.ok) return result.value;
				throw new Error(result.error?.message ?? "RPC failed");
			};
			const readFollow = () => {
				latestFollowLocale = scope.getSnapshot().value?.followLocale ?? true;
			};
			const unsubscribe = scope.subscribe(readFollow);
			readFollow();
			ctx.effect(() => () => {
				if (typeof unsubscribe === "function") unsubscribe();
			}, "dsh-vision-reader: settings subscription");
			const toggleFollow = async (value) => {
				latestFollowLocale = value;
				await scope.set("followLocale", value);
			};
			slots.inject("settings.section", () => slots.register({
				name: "settings.section",
				id: "vision-reader",
				order: 25,
				label: () => latestFollowLocale ? t("nav") : "视觉模型",
				locale: NS,
				inject: () => ({
					scope,
					call,
					t,
					toggleFollow
				})
			}, VLProviderSection));
			slots.inject("conversation.input.left", () => slots.register({
				name: "conversation.input.left",
				id: "vision-reader-upload",
				order: 0,
				locale: NS,
				inject: (sessionId) => ({
					call,
					t,
					conversation,
					sessionId
				})
			}, UploadEntry));
		}
		function VLProviderSection({ scope, call, t, toggleFollow }) {
			const [baseUrl, setBaseUrl] = (0, react.useState)("");
			const [apiKey, setApiKey] = (0, react.useState)("");
			const [hasKey, setHasKey] = (0, react.useState)(false);
			const [selectedModel, setSelectedModel] = (0, react.useState)("");
			const [followLocale, setFollowLocale] = (0, react.useState)(true);
			const [models, setModels] = (0, react.useState)([]);
			const [health, setHealth] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)("");
			const [saved, setSaved] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)("idle");
			(0, react.useEffect)(() => {
				let live = true;
				const initialFollow = scope.getSnapshot().value?.followLocale ?? true;
				setFollowLocale(initialFollow);
				latestFollowLocale = initialFollow;
				call("get-state").then((value) => {
					if (!live) return;
					const state = value;
					setBaseUrl(state.baseUrl ?? "");
					setHasKey(state.hasKey === true);
					setSelectedModel(state.selectedModel ?? "");
				}).catch((cause) => {
					if (live) setError(messageOf(cause));
				});
				return () => {
					live = false;
				};
			}, [call, scope]);
			const probe = async () => {
				setBusy("probing");
				setError("");
				setSaved(false);
				try {
					const result = await call("probe");
					setHealth(result);
					setModels(result.models ?? []);
					if (!result.ok) setError(result.error ?? t("healthBad"));
				} catch (cause) {
					setHealth({
						ok: false,
						models: []
					});
					setError(messageOf(cause));
				} finally {
					setBusy("idle");
				}
			};
			const save = async (event) => {
				event.preventDefault();
				setBusy("saving");
				setError("");
				setSaved(false);
				try {
					const result = await call("save-config", {
						baseUrl,
						apiKey
					});
					setBaseUrl(result.baseUrl);
					setHasKey(result.hasKey);
					setApiKey("");
					setSaved(true);
					const checked = await call("probe");
					setHealth(checked);
					setModels(checked.models ?? []);
					if (!checked.ok) setError(checked.error ?? t("healthBad"));
				} catch (cause) {
					setError(messageOf(cause));
				} finally {
					setBusy("idle");
				}
			};
			const pickModel = async (model) => {
				setError("");
				try {
					await call("set-model", { model });
					setSelectedModel(model);
				} catch (cause) {
					setError(messageOf(cause));
				}
			};
			const changeFollow = async () => {
				const next = !followLocale;
				setFollowLocale(next);
				try {
					await toggleFollow(next);
				} catch (cause) {
					setFollowLocale(!next);
					setError(messageOf(cause));
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "vr-section",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: "vr-title",
						children: t("title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "vr-intro",
						children: t("hint")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
						className: "vr-card",
						onSubmit: save,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "vr-card-head",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "vr-card-title",
									children: t("providerTitle")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "vr-caption",
									children: t("providerCaption")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "vr-field",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "vr-label",
									children: t("baseUrl")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "vr-input",
									value: baseUrl,
									placeholder: t("baseUrlPlaceholder"),
									onChange: (event) => setBaseUrl(event.target.value),
									autoComplete: "url"
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "vr-field",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "vr-label",
									children: t("apiKey")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "vr-input",
									type: "password",
									value: apiKey,
									placeholder: hasKey ? t("apiKeyFilled") : t("apiKeyPlaceholder"),
									onChange: (event) => setApiKey(event.target.value),
									autoComplete: "off"
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "vr-hint",
								children: t("envHint")
							}),
							saved && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "vr-saved",
								role: "status",
								children: t("saved")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "vr-actions",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "vr-button vr-secondary",
									type: "button",
									disabled: busy !== "idle" || !baseUrl.trim(),
									onClick: () => {
										probe();
									},
									children: busy === "probing" ? t("probing") : t("probe")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "vr-button vr-primary",
									type: "submit",
									disabled: busy !== "idle" || !baseUrl.trim(),
									children: busy === "saving" ? t("saving") : t("save")
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: `vr-status ${health?.ok ? "vr-ok" : health ? "vr-bad" : ""}`,
						role: "status",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "vr-dot" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: health?.ok ? fmt(t("healthOk"), {
							status: health.status ?? "",
							count: health.count ?? models.length
						}) : health ? t("healthBad") : t("notProbed") })]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "vr-error",
						role: "alert",
						children: error
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "vr-card",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "vr-card-title",
								children: t("modelTitle")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "vr-hint",
								children: t("modelHint")
							})] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "vr-models",
								children: [models.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "vr-hint",
									children: t("noModels")
								}), models.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: `vr-model ${selectedModel === model.id ? "vr-model-selected" : ""}`,
									onClick: () => {
										pickModel(model.id);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "vr-radio" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "vr-model-copy",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "vr-model-name",
											title: model.id,
											children: model.name
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "vr-model-meta",
											children: model.vision ? t("supported") : t("unsupported")
										})]
									})]
								}, model.id))]
							}),
							selectedModel && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "vr-hint",
								children: fmt(t("selected"), { model: selectedModel })
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "vr-toggle-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "vr-toggle-copy",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "vr-card-title",
								children: t("followLabel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "vr-hint",
								children: t("followHint")
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							role: "switch",
							"aria-checked": followLocale,
							className: `vr-switch ${followLocale ? "vr-switch-on" : ""}`,
							onClick: () => {
								changeFollow();
							}
						})]
					})
				]
			});
		}
		function UploadEntry({ call, t, conversation, sessionId, inputActions }) {
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const inputRef = (0, react.useRef)(null);
			const onPick = async (event) => {
				const files = [...event.target.files ?? []].slice(0, MAX_MEDIA_ITEMS);
				event.target.value = "";
				if (files.length === 0) return;
				setBusy(true);
				setError("");
				let drafts = [];
				try {
					if (!conversation || !inputActions) throw new Error(t("conversationUnavailable"));
					const items = await Promise.all(files.map(async (file) => ({
						name: file.name,
						mime: file.type,
						dataUrl: await readFileAsDataUrl(file)
					})));
					const previews = await Promise.all(files.map((file) => previewFile(file)));
					drafts = conversation.createDraftImages(previews);
					await call("receive-media", {
						sessionId,
						items
					});
					if (!inputActions.addImages(drafts.map((item) => item.id))) {
						conversation.releaseDraftImages(drafts);
						drafts = [];
						await call("clear-media", { sessionId });
						throw new Error(t("conversationUnavailable"));
					}
				} catch (cause) {
					if (drafts.length > 0) conversation?.releaseDraftImages(drafts);
					setError(fmt(t("uploadFail"), { err: messageOf(cause) }));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "vr-upload-wrap",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "vr-upload",
						title: t("uploadTip"),
						disabled: busy,
						onClick: () => inputRef.current?.click(),
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							viewBox: "0 0 24 24",
							"aria-hidden": "true",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "1.8",
							strokeLinecap: "round",
							strokeLinejoin: "round",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 5v14M5 12h14" })
						}), busy ? t("uploadBusy") : t("upload")]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						ref: inputRef,
						type: "file",
						accept: "image/*,video/*",
						multiple: true,
						hidden: true,
						onChange: (event) => {
							onPick(event);
						}
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "vr-upload-error",
						role: "alert",
						children: error
					})
				]
			});
		}
		function messageOf(value) {
			return value instanceof Error ? value.message : String(value);
		}
		function readFileAsDataUrl(file) {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result));
				reader.onerror = () => reject(reader.error ?? /* @__PURE__ */ new Error("File read failed"));
				reader.readAsDataURL(file);
			});
		}
		async function previewFile(file) {
			if (/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return file;
			if (file.type.startsWith("image/")) return renderImagePreview(file);
			if (file.type.startsWith("video/")) return renderVideoPreview(file);
			throw new Error(`Unsupported media type: ${file.type || "unknown"}`);
		}
		async function renderImagePreview(file) {
			const url = URL.createObjectURL(file);
			try {
				const image = new Image();
				image.src = url;
				await image.decode();
				return canvasFile(drawToCanvas(image, image.naturalWidth, image.naturalHeight), `${file.name || "image"}-preview.jpg`);
			} finally {
				URL.revokeObjectURL(url);
			}
		}
		async function renderVideoPreview(file) {
			const url = URL.createObjectURL(file);
			try {
				const video = document.createElement("video");
				video.muted = true;
				video.playsInline = true;
				video.preload = "metadata";
				video.src = url;
				await eventOnce(video, "loadeddata", 1e4);
				if (Number.isFinite(video.duration) && video.duration > .1) {
					video.currentTime = Math.min(.25, video.duration / 10);
					await eventOnce(video, "seeked", 1e4);
				}
				const canvas = drawToCanvas(video, video.videoWidth || 640, video.videoHeight || 360);
				const context = canvas.getContext("2d");
				if (context) {
					context.fillStyle = "rgba(0,0,0,.58)";
					context.beginPath();
					context.arc(34, 34, 20, 0, Math.PI * 2);
					context.fill();
					context.fillStyle = "#fff";
					context.beginPath();
					context.moveTo(29, 24);
					context.lineTo(29, 44);
					context.lineTo(44, 34);
					context.closePath();
					context.fill();
				}
				return canvasFile(canvas, `${file.name || "video"}-preview.jpg`);
			} finally {
				URL.revokeObjectURL(url);
			}
		}
		function drawToCanvas(source, width, height) {
			const scale = Math.min(1, 1280 / Math.max(width, height));
			const canvas = document.createElement("canvas");
			canvas.width = Math.max(1, Math.round(width * scale));
			canvas.height = Math.max(1, Math.round(height * scale));
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Canvas is unavailable");
			context.drawImage(source, 0, 0, canvas.width, canvas.height);
			return canvas;
		}
		function canvasFile(canvas, name) {
			return new Promise((resolve, reject) => canvas.toBlob((blob) => {
				if (!blob) reject(/* @__PURE__ */ new Error("Could not create media preview"));
				else resolve(new File([blob], name, {
					type: "image/jpeg",
					lastModified: Date.now()
				}));
			}, "image/jpeg", .86));
		}
		function eventOnce(target, name, timeoutMs) {
			return new Promise((resolve, reject) => {
				const timer = window.setTimeout(() => finish(/* @__PURE__ */ new Error(`Video preview timed out at ${name}`)), timeoutMs);
				const onSuccess = () => finish();
				const onError = () => finish(/* @__PURE__ */ new Error("The browser could not decode this video for preview"));
				const finish = (error) => {
					window.clearTimeout(timer);
					target.removeEventListener(name, onSuccess);
					target.removeEventListener("error", onError);
					if (error) reject(error);
					else resolve();
				};
				target.addEventListener(name, onSuccess, { once: true });
				target.addEventListener("error", onError, { once: true });
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map