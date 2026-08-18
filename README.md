# dsh-vision-reader

A vision media reading plugin for **DeepSeek Harness (DSH)**. Upload an image or video
from the composer, and let the agent analyze it with your own **OpenAI-compatible VL
provider**. Appears under **Settings → Plugins** and runs persistently — no per-session
toggling.

![MIT](https://img.shields.io/badge/license-MIT-green)

## Features

- Plugin-owned **Add media** composer control and in-composer thumbnail rail — accepts up to six
  images/videos without putting image blocks into Harness's primary-model request.
- **Settings → 视觉模型 / Visual Model**: fill in your Provider **Base URL** + **API key**
  (OpenAI-compatible), save, and it auto-reads the provider **health** and **VL model list**.
- **VL capability guard**: selecting a model without vision shows an error and is rejected.
- **Automatic text-model fallback**: an on-by-default setting at the top of the plugin lets
  the configured VL provider read media when the primary model has no vision support.
- **Agent-tool VL routing**: the ordinary user message enters the main agent first. The agent
  calls `analyze_media` once, the tool sends the pending media to the selected VL provider,
  and the returned analysis is durably deferred as `Context injection · vision-analysis`
  for the agent's next model step. The primary chat model may remain text-only. Provider,
  model, endpoint, and internal routing details are deliberately omitted from the context and
  the final user-facing answer.
- **Harness-native localization**: the plugin settings and title always follow the current
  Harness interface language.
- **Server-only credentials**: the UI writes `VISION_BASE` and `VISION_KEY` to
  `$DSH_HOME/vision-reader.env` (mode `0600`). The key is never projected through browser
  settings. Model and language preferences remain in the `vision-reader` settings namespace.
- **Conversation isolation**: pending media is scoped by Harness session rather than shared
  across conversations.

## Install

Clone / publish this repo, then install it into a profile with:

```sh
dsh plugin --profile web add github:easonz1989/dsh-vision-reader
```

Because the package declares `dsh.bundle.patch`, `dsh plugin add` automatically:

1. installs it into the profile's `node_modules`,
2. joins it into `dsh.profile.bundles`,
3. mounts its Host plugin row persistently — it shows in **Settings → Plugins** and runs on
   every boot.

(message: your profile needs `pnpm` and the web build toolchain available so the browser
half (`dsh.client`) gets bundled into the web app at build time.)

## Build (for contributors)

```sh
pnpm install
pnpm build        # tsdown -> lib/index.js + lib/client.js
```

The distributed package ships `lib/` and `cordis.patch.yml` (see `files` in `package.json`).
A GitHub Action (`.github/workflows/build.yml`) builds `lib/` on push to `main` and commits
it back, so `dsh plugin add github:...` always fetches a ready-to-install package.

## Usage

1. Open **Settings → 视觉模型 / Visual Model**.
2. Enter your Provider **Base URL** (e.g. `https://api.provider.com/v1`) and, if required,
   the **API Key**; click **Save**. Then use **Test connection**.
3. Pick a model marked **VL** (choosing a non-VL model is rejected with an error).
4. Back in the conversation, click **Add media**, choose one or more images/videos, and
   review the plugin thumbnail rail, and ask a question (an empty draft is populated with a
   localized "analyze the attached media" request).
5. Send normally. The main agent calls the plugin tool, the plugin reads the media once, and
   Harness records the returned text as `Context injection · vision-analysis` before the main
   agent answers. Harness never asks the primary model to accept an image block.

### Video note

Videos are sent as a base64 `input_video` content part to the selected model. This works
best with providers/models that natively accept video input. Images use the OpenAI
`image_url` (data URL) convention.

## License

MIT © easonz1989
