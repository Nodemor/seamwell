# 06 · Virtual Try-On

## How it works
1. **Photo** — the customer uploads a full-body photo (or takes one on mobile). It's downscaled to ≤1280 px JPEG **in the browser**.
2. **Photo check (free, in-browser)** — MediaPipe Pose (`lib/tryon/photo-check.ts`). **Blocks** before any GPU time is spent if: no person, several people, face/head cut off, a hand hidden. **Tips** for: feet not visible, small photo. The customer can choose "Use this photo anyway".
3. **Outfit** — pick a full kit, or blazer / shirt / trousers. If they pick a blazer only, the UI asks which shirt and trousers to wear (or "keep my own").
4. **AI passes** (`lib/tryon/engine.ts`) — the customer's browser calls the Hugging Face Space **`fashn-ai/fashn-vton-1.5`**, endpoint **`/try_on`**, via `@gradio/client`. Order: **trousers → shirt → blazer** (each result feeds the next) or **one pass** for a full kit.
5. **Result** — before/after, save image, "add to bag".

Nothing goes through the shop server, and no Hugging Face token is used → **each visitor spends their own free daily GPU quota** (about 2 min/day per internet connection ≈ **2 garments**, shared across every copy of the model; calls from our site don't carry the visitor's Hugging Face login, so signing in there most likely doesn't add more). Hugging Face can change these limits.

## Tested settings (Nov 2026)
| Parameter | Value | Why |
|---|---|---|
| `category` | `tops` (blazer/shirt), `bottoms` (trousers), `one-pieces` (full kit) | model's categories |
| `garment_photo_type` | `flat-lay` for white-background product shots, `model` for photos worn by a model | |
| `num_timesteps` | **50** | quota is charged per request (~60 s), not per step → max quality is free |
| `guidance_scale` | 1.5 | model default |
| `segmentation_free` | **true** ("volume mode") | keeps the person's body & pose; on a good photo both modes face forward; on a bad photo (face cut off, hands in pockets) "clean replace" drew the person from behind |

Results: ~25 s per garment; small logo text may come out slightly garbled; it shows **how it looks, not whether the size fits** → keep the size guide / measurements form next to it.

## Getting good results (tell customers)
- Full body head-to-feet, face visible, facing the camera, arms relaxed by the sides, plain background, good light, fitted clothes.
- Shop side: upload a **white-background, front, unfolded** garment photo for each product (`products.tryon_image_url`). Full suits as **one kit image** = 1 pass and the most accurate result.

## Production notes
- The Space is run by FASHN on Hugging Face — they may change, rate-limit or stop it. For more control later: duplicate the Space to your own account (may need HF PRO ~US$9/month for ZeroGPU hosting) and set `NEXT_PUBLIC_TRYON_SPACE=<you>/<space>`; set `@spaces.GPU(duration=20)` there to fit more runs per quota.
- CSP already allows `*.hf.space`, `huggingface.co`, `cdn.jsdelivr.net` and `storage.googleapis.com` (MediaPipe).
- Privacy policy must say photos are processed by a third-party AI service (Hugging Face / FASHN) and not stored by the shop.
- Original single-file prototype with the full tested behaviour: `docs/reference/tryon-prototype.html`.

## The studio (phase 7)
- `components/tryon/TryOnStudio.tsx` — guided 3 steps: **Photo** (`PhotoStep`, animated `PoseGuide`, good/bad `PhotoExamples`, MediaPipe check with "Upload another photo" / "Use this photo anyway") → **Outfit** (`OutfitStep`, `GarmentCard` with hover tilt, "Your outfit" tray, `CompleteLookDialog`) → **Result** (`ResultStep`: `StitchLoader` progress per pass, `CompareSlider` before/after, per-pass thumbnails, clean-mode retry, Save, Share, `OutfitToBag` with the measurements → size suggestion).
- Pairing rules ("Complete the look") and the size suggestion live in `packages/shared` (`completeTheLook`, `suggestSize`, `SIZE_CHARTS`) and are unit-tested in `apps/api/src/lib/tryon-helpers.test.ts`.
- The photo is kept only in memory (`lib/tryon/memory.ts`): it survives moving around the shop in the same tab, is gone on reload, and is never sent to our API or written to browser storage.
- **Gradio client gotcha:** `Client.connect()` streams only `"data"` events by default. The engine passes `events: ["data", "status"]` — without it there is no queue position / progress, and **errors (e.g. quota used up) never arrive, so the page waits forever.**
- **Queue:** the Space runs on shared free ZeroGPU. At busy times the queue can be long (seen: position 25, ETA ≈ 10 min, Nov 2026). The UI shows the position and ETA; the "~25 s per piece" only starts once it's your turn. If the position doesn't change for 3 minutes the UI says the free service may be overloaded (seen 24–25 Nov 2026: the public queue sat frozen at 25 for 40+ minutes). If this keeps happening, duplicate the Space to your own account (see Production notes).
- **Testing without spending quota (dev only):** `/try-on?fake=1` (or `fake=error`, `fake=partial`) swaps in `lib/tryon/fake-engine.ts`, which emits the same events and returns `/tryon/demo-result.webp`. Ignored when `NODE_ENV=production`.
- **Several Spaces / failover:** `NEXT_PUBLIC_TRYON_SPACE` may list several copies of the same model, comma-separated (e.g. `yourshop/fashn-vton-1.5,fashn-ai/fashn-vton-1.5`). Each try-on checks every Space's `/gradio_api/queue/status` (no photo is sent for that) and uses the shortest queue; when a queue is stuck for 3 minutes the customer gets a "Try a less busy server" button. Only list Spaces you trust — the customer's photo goes to whichever one is picked, and the privacy page must name who runs them.
- **Verified 25 Nov 2026:** the official Space's queue was frozen (24–25 jobs, barely moving for over an hour), while copies with identical `/try_on` inputs (e.g. `merve/fashn-vton-1.5`) had empty queues and returned a result for the sample photo + navy trousers in ~37 s (output 576×864 WebP).
- **Free allowance in practice (25 Nov 2026):** after 2 passes from one connection, the 3rd returned the quota error ("Today's free try-on time is used up…"); the finished passes are still shown. So a blazer + shirt + trousers look (3 passes) usually can't finish for a free visitor in one day. The outfit tray warns when a look needs more passes than are likely left; "Keep my own" and full-suit kit photos (1 pass) are the ways round it.
