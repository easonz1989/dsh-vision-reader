window.__ModuleLoader__.load({
	id: "dsh-vision-reader",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/index.tsx
		/** Must match the host-registered namespace in src/index.ts. */
		const NS = "vision-reader";
		const CHANNEL = "/vision-reader";
		let latestFollowLocale = true;
		const dict = {
			zh: {
				nav: "视觉模型",
				title: "视觉媒体 (VL) Provider",
				hint: "填写 OpenAI 兼容的 Provider API 与 Key，保存后自动读取健康状态和 VL 模型列表。没有视觉能力的模型会被拒绝。",
				baseUrlPlaceholder: "https://api.provider.com/v1",
				apiKeyPlaceholder: "API Key（如有）",
				apiKeyFilled: "••••••••（已填写，可留空保持不变）",
				saveProbe: "保存并检测",
				saveProbeBusy: "保存并检测中…",
				reprobe: "重新检测",
				healthOk: "Provider 正常 (HTTP {status})，发现 {count} 个模型",
				healthBad: "Provider 健康检查失败",
				notProbed: "尚未检测 Provider 状态",
				pickModel: "选择用于分析的 VL 模型：",
				selected: "已选择: {model}",
				followLabel: "设置项文案跟随界面语言",
				followOn: "跟随（中文=视觉模型 / English=Visual Model）",
				followOff: "固定为“视觉模型”",
				upload: "上传",
				uploadTip: "上传图片或影片供 VL 模型分析",
				uploaded: "已上传「{name}」，可以说“分析这个媒体”",
				uploadFail: "上传失败: {err}"
			},
			en: {
				nav: "Visual Model",
				title: "Visual Media (VL) Provider",
				hint: "Fill in an OpenAI-compatible Provider API and Key; save to auto-read health and the VL model list. Models without vision are rejected.",
				baseUrlPlaceholder: "https://api.provider.com/v1",
				apiKeyPlaceholder: "API Key (if any)",
				apiKeyFilled: "•••••••• (saved; leave blank to keep)",
				saveProbe: "Save & probe",
				saveProbeBusy: "Saving…",
				reprobe: "Re-probe",
				healthOk: "Provider OK (HTTP {status}), {count} models found",
				healthBad: "Provider health check failed",
				notProbed: "Provider not probed yet",
				pickModel: "Choose the VL model to analyze with:",
				selected: "Selected: {model}",
				followLabel: "Section text follows UI language",
				followOn: "Follow (中文=视觉模型 / English=Visual Model)",
				followOff: "Fixed to “视觉模型”",
				upload: "Upload",
				uploadTip: "Upload an image or video for the VL model",
				uploaded: "Uploaded “{name}” — say “analyze this media”",
				uploadFail: "Upload failed: {err}"
			}
		};
		function fmt(template, vars) {
			return template.replace(/\{(\w+)\}/g, (_m, k) => String(vars[k] ?? ""));
		}
		const name = "dsh-vision-reader";
		const inject = [
			"slots",
			"locale",
			"connection",
			"settingsScope"
		];
		async function apply(ctx) {
			const slots = ctx.get("slots");
			const locale = ctx.get("locale");
			const connection = ctx.get("connection");
			const settingsScope = ctx.get("settingsScope");
			if (!slots || !locale || !connection || !settingsScope) return;
			const t = locale.bind(NS);
			ctx.effect(() => {
				const dispose = locale.register(NS, dict);
				return () => {
					if (typeof dispose === "function") dispose();
				};
			}, "dsh-vision-reader: dictionaries");
			const scope = settingsScope.bind({ namespace: NS });
			const call = async (endpoint, payload = {}) => {
				const r = await connection.rpc.call(CHANNEL, endpoint, payload);
				if (r.ok) return r.value;
				throw new Error(r.error?.message ?? "RPC failed");
			};
			const readFollow = () => {
				latestFollowLocale = scope.getSnapshot().value?.followLocale ?? true;
			};
			scope.subscribe(readFollow);
			readFollow();
			const toggleFollow = async (v) => {
				latestFollowLocale = v;
				await scope.set("followLocale", v);
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
					scope,
					call,
					t
				})
			}, UploadEntry));
		}
		function VLProviderSection({ scope, call, t, toggleFollow }) {
			const [baseUrl, setBaseUrl] = (0, react.useState)("");
			const [apiKey, setApiKey] = (0, react.useState)("");
			const [hasKey, setHasKey] = (0, react.useState)(false);
			const [selectedModel, setSelectedModel] = (0, react.useState)("");
			const [followLocale, setFollowLocaleState] = (0, react.useState)(true);
			const [models, setModels] = (0, react.useState)([]);
			const [health, setHealth] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)("");
			const [probeState, setProbeState] = (0, react.useState)("idle");
			(0, react.useEffect)(() => {
				const v = scope.getSnapshot().value ?? {};
				setBaseUrl(v.baseUrl ?? "");
				setHasKey(!!v.apiKey);
				setSelectedModel(v.selectedModel ?? "");
				setFollowLocaleState(v.followLocale ?? true);
				readFollow();
			}, []);
			function readFollow() {
				latestFollowLocale = scope.getSnapshot().value?.followLocale ?? true;
			}
			const save = async () => {
				setError("");
				setProbeState("probing");
				try {
					await call("save-config", {
						baseUrl,
						apiKey
					});
					await probe();
				} catch (e) {
					setError(e instanceof Error ? e.message : String(e));
				} finally {
					setProbeState("idle");
				}
			};
			const probe = async () => {
				setProbeState("probing");
				setError("");
				try {
					const r = await call("probe");
					setHealth(r);
					setModels(r.models ?? []);
					if (!r.ok) setError(r.error ?? "检测失败");
				} catch (e) {
					setHealth({
						ok: false,
						models: []
					});
					setError(e instanceof Error ? e.message : String(e));
				} finally {
					setProbeState("idle");
				}
			};
			const pickModel = async (id) => {
				setError("");
				try {
					await call("set-model", { model: id });
					setSelectedModel(id);
				} catch (e) {
					setError(e instanceof Error ? e.message : String(e));
					setSelectedModel("");
				}
			};
			const onToggle = async () => {
				const next = !followLocale;
				setFollowLocaleState(next);
				await toggleFollow(next);
			};
			const styleInput = {
				flex: 1,
				minWidth: 0,
				border: "none",
				outline: "none",
				background: "transparent",
				fontSize: 14,
				lineHeight: "22px",
				color: "var(--dsw-alias-label-primary, inherit)"
			};
			const styleField = {
				display: "inline-flex",
				alignItems: "center",
				gap: 6,
				height: 32,
				padding: "0 8px",
				boxSizing: "border-box",
				border: "1px solid var(--dsw-alias-border-l2, #bbb)",
				borderRadius: 8,
				background: "var(--dsw-alias-bg-layer-1, transparent)",
				margin: "6px 0"
			};
			const styleRow = {
				display: "flex",
				gap: 8,
				alignItems: "center"
			};
			const styleButton = {
				display: "inline-flex",
				alignItems: "center",
				padding: "0 14px",
				height: 32,
				border: "none",
				borderRadius: 8,
				cursor: "pointer",
				fontSize: 14,
				color: "#fff",
				background: "var(--dsw-alias-brand-primary, #4f7cff)"
			};
			const styleBadge = {
				display: "inline-block",
				padding: "2px 8px",
				borderRadius: 999,
				fontSize: 12
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					padding: 4,
					color: "var(--dsw-alias-label-primary, inherit)"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("title") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: {
							fontSize: 12,
							opacity: .7
						},
						children: t("hint")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: styleRow,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: styleField,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								style: styleInput,
								placeholder: t("baseUrlPlaceholder"),
								value: baseUrl,
								onChange: (e) => setBaseUrl(e.target.value)
							})
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: styleRow,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: styleField,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								style: styleInput,
								type: "password",
								placeholder: hasKey ? t("apiKeyFilled") : t("apiKeyPlaceholder"),
								value: apiKey,
								onChange: (e) => setApiKey(e.target.value)
							})
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: styleRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							style: styleButton,
							disabled: probeState === "probing" || !baseUrl.trim(),
							onClick: save,
							children: probeState === "probing" ? t("saveProbeBusy") : t("saveProbe")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							style: {
								...styleButton,
								background: "transparent",
								color: "var(--dsw-alias-label-primary)",
								border: "1px solid var(--dsw-alias-border-l2, #bbb)"
							},
							disabled: probeState === "probing",
							onClick: probe,
							children: t("reprobe")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							...styleRow,
							margin: "8px 0",
							cursor: "pointer"
						},
						onClick: onToggle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: followLocale,
							onChange: onToggle,
							style: { marginRight: 6 }
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: { fontSize: 13 },
							children: [
								t("followLabel"),
								" — ",
								followLocale ? t("followOn") : t("followOff")
							]
						})]
					}),
					health ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: styleRow,
						children: health.ok ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								...styleBadge,
								color: "var(--dsw-alias-state-success-primary, #16a34a)"
							},
							children: fmt(t("healthOk"), {
								status: health.status ?? "",
								count: health.count ?? models.length
							})
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								...styleBadge,
								color: "var(--dsw-alias-state-error-primary, #dc2626)"
							},
							children: t("healthBad")
						})
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: 12,
							opacity: .7
						},
						children: t("notProbed")
					}),
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							color: "var(--dsw-alias-state-error-primary, #dc2626)",
							fontSize: 12,
							whiteSpace: "pre-wrap",
							margin: "6px 0"
						},
						children: error
					}) : null,
					models.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: { marginTop: 8 },
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								fontSize: 12,
								opacity: .7
							},
							children: t("pickModel")
						}), models.map((m) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								gap: 6,
								alignItems: "center",
								padding: "4px 0",
								cursor: "pointer"
							},
							onClick: () => pickModel(m.id),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: selectedModel === m.id ? "● " : "○ " }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: {
										flex: 1,
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap"
									},
									title: m.id,
									children: m.name
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: {
										...styleBadge,
										color: m.vision ? "var(--dsw-alias-state-success-primary, #16a34a)" : "var(--dsw-alias-state-error-primary, #dc2626)"
									},
									children: m.vision ? "VL" : "无VL / No VL"
								})
							]
						}, m.id))]
					}) : null,
					selectedModel ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							fontSize: 12,
							opacity: .7,
							marginTop: 6
						},
						children: fmt(t("selected"), { model: selectedModel })
					}) : null
				]
			});
		}
		function UploadEntry({ call, t }) {
			const [busy, setBusy] = (0, react.useState)(false);
			const [name, setName] = (0, react.useState)("");
			const inputRef = { current: null };
			const onPick = async (e) => {
				const file = e.target.files?.[0];
				e.target.value = "";
				if (!file) return;
				setBusy(true);
				try {
					const dataUrl = await readFileAsDataUrl(file);
					await call("receive-media", {
						name: file.name,
						mime: file.type || "application/octet-stream",
						dataUrl
					});
					setName(file.name);
				} catch (err) {
					setName("");
					window.alert(fmt(t("uploadFail"), { err: err instanceof Error ? err.message : String(err) }));
				} finally {
					setBusy(false);
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "inline-flex",
					alignItems: "center",
					gap: 6
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					style: {
						display: "inline-flex",
						alignItems: "center",
						padding: "4px 8px",
						cursor: "pointer",
						border: "1px solid var(--dsw-alias-border-l2, #bbb)",
						borderRadius: 8,
						background: "transparent",
						color: "var(--dsw-alias-label-primary, inherit)",
						fontSize: 13
					},
					title: t("uploadTip"),
					disabled: busy,
					onClick: () => inputRef.current?.click(),
					children: busy ? "…" : name || t("upload")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					ref: (el) => inputRef.current = el,
					type: "file",
					accept: "image/*,video/*",
					style: { display: "none" },
					onChange: onPick
				})]
			});
		}
		function readFileAsDataUrl(file) {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result));
				reader.onerror = () => reject(reader.error);
				reader.readAsDataURL(file);
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