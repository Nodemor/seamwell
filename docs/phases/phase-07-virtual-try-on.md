# Phase 7 · Virtual Try-On polish

**Goal:** make the try-on the shop's signature experience — guided, fast-feeling, beautiful, and honest about limits.
**Read first:** `docs/06-virtual-try-on.md` (tested settings & lessons), `apps/web/src/lib/tryon/*`, `components/tryon/TryOnStudio.tsx`, `docs/reference/tryon-prototype.html`.

## Prompt to paste into Claude Code
```
Phase 7 (virtual try-on) of Seamwell. Read CLAUDE.md and docs/06-virtual-try-on.md carefully — the settings there were tested; don't change the defaults (volume mode on, 50 steps, guidance 1.5, pass order trousers → shirt → blazer, browser-side calls with NO token).

Rebuild components/tryon/TryOnStudio.tsx as a guided 3-step experience:
1. Photo step: upload or take a photo (mobile camera), animated outline guide showing the ideal pose, the MediaPipe check with friendly blocking messages ("Upload another photo" / "Use anyway"), example good/bad photo thumbnails.
2. Outfit step: gender tabs, category tabs, garment cards (product photo, or the "photo coming soon" tile from ProductPhoto — no drawn garments), selected outfit tray. If a blazer is picked without shirt/trousers, open a "Complete the look" dialog suggesting shirts + trousers (simple rules: navy/black/charcoal blazer → white or sky-blue shirt + black/charcoal trousers; linen → white shirt + stone chinos) with "keep my own" options. Full kits replace separates.
3. Result step: progress UI per pass (queue position, step x of y, an elegant GSAP "stitching" loader using DrawSVG), before/after comparison slider (drag + keyboard), per-pass thumbnails, "Try again in clean mode" button (segmentation_free=false) for when old clothes show through, Save image, Share (Web Share API when available), "Add this outfit to bag" (opens size pickers for each item).
- Show remaining-quota hints and the friendly errors from friendlyTryOnError; Cancel button.
- Remember the last photo only in memory (never upload it to our server, never localStorage).
- Product page "Try this on me" pre-selects that product (already supported via ?product=).
- Add a measurements helper (optional): height, chest, waist → suggest a size per item from a size chart in packages/shared (clearly labelled as a suggestion).
- GSAP: step transitions, garment card hover tilt, result reveal wipe. Respect reduced motion.
Test with real photos: good front photo, cut-off head (must block), hands in pockets (must block), two people (must block).
```

## Acceptance criteria
- [ ] A shopper can go photo → outfit → result on a phone in under a minute of interaction
- [ ] Blocking photo problems are caught before any GPU time is used
- [ ] Clean-mode retry, save, add-outfit-to-bag all work
- [ ] Clear note: "Shows how it looks, not the exact fit — see the size guide"

## Security & privacy checklist
- [ ] No Hugging Face token anywhere in the code or env for the web app
- [ ] Customer photo never sent to our API; privacy policy explains the third-party processing
- [ ] CSP still allows only the needed hosts (`*.hf.space`, `huggingface.co`, `cdn.jsdelivr.net`, `storage.googleapis.com`)
