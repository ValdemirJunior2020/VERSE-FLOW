# Optional Open-Source Integrations

These integrations are deliberately outside the core live engine.


## OmniRoute

Purpose: optional OpenAI-compatible local AI gateway. Current npm installation is `npm install -g omniroute`; the default API base is `http://127.0.0.1:20128/v1`.

VerseFlow Settings only stores/tests a configurable compatible base URL. Do not hard-code provider keys.

## Open-Generative-AI

Purpose: optional background-image/video generation adapter. Generated files must land in a Review queue and must never auto-send live. Provider costs and credentials belong in the adapter, not the live engine.

## Chatterbox

Purpose: local narration/accessibility TTS. Do not bundle PyTorch/model weights into the base app. Run Chatterbox as a separate local service and only reveal "Generate narration" when its health endpoint is available.

## Hermes Agent

Purpose: optional Sunday-service draft assistant. Hermes may propose a service order, media ideas and draft announcements. It must not rewrite imported scripture and its output must remain a draft pending human approval.

## HuMo

Purpose: optional high-end cinematic generation. Gate it behind GPU capability checks and never make it part of installation or live rendering.

## Penpot

Use for theme/template design collaboration. Export assets into VerseFlow; Penpot is not a runtime dependency.

## Development-only tools

OpenHands and Cline may help engineers maintain the repository. Do not install them on production church PCs.

## Rule for every integration

Presentation reliability wins. Network errors, model failures, missing GPU support or provider limits must not change the ability to show Bible text, songs, images, videos or black/clear/logo safety states.
