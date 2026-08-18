# dsh-vision-reader

A vision media reading plugin for **DeepSeek Harness (DSH)**. Upload an image or video
from the composer, and let the agent analyze it with your own **OpenAI-compatible VL
provider**. Appears under **Settings → Plugins** and runs persistently — no per-session
toggling.

![MIT](https://img.shields.io/badge/license-MIT-green)

## Features

- **Upload** button in the input tool row — accepts `image/*` and `video/*`.
- **Settings → 视觉模型 / Visual Model**: fill in your Provider **Base URL** + **API key**
  (OpenAI-compatible), save, and it auto-reads the provider **health** and **VL model list**.
- **VL capability guard**: selecting a model without vision shows an error and is rejected.
- **Agent tool `analyze_media`**: after uploading, just tell the agent "analyze this media";
  the image/video (base64) is sent to your VL provider and the result comes back in the
  conversation.
- **Follow-UI-language toggle**: the settings section title follows the harness language
  (`中文 → 视觉模型`, `English → Visual Model`), or stays fixed when the toggle is off.
- **Durable config**: your Provider settings persist in `$DSH_HOME/settings.yaml` via the
  DSH settings namespace `vision-reader`.

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
   the **API Key**; click **Save & probe**.
3. Pick a model marked **VL** (choosing a non-VL model is rejected with an error).
4. Back in the conversation, click **Upload**, choose an image or video.
5. Tell the agent: **"analyze this media"** (or ask a specific question). The agent calls
   the `analyze_media` tool, which sends the media to your VL provider and returns the
   analysis into the conversation.

### Video note

Videos are sent as a base64 `input_video` content part to the selected model. This works
best with providers/models that natively accept video input. Images use the OpenAI
`image_url` (data URL) convention.

## License

MIT © easonz1989
