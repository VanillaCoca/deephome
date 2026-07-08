# Deephome

**Intent-based home search for Toronto (and Canada).** Most search engines match the words you type. Deephome recovers what you actually *mean*, then ranks listings by the attributes that truly satisfy that intent — and explains every result.

<p align="center"><b>English</b> · <a href="./README.zh-CN.md">中文</a></p>

> "I want big windows" usually really means **"I want good natural light"** — which is decided by orientation, floor, obstruction and window ratio, *none of which the user typed*. A keyword search matches the phrase "big windows"; Deephome translates **surface words → true intent → queryable attributes**.

This is a non-profit, open-source tool. No ads, no data resale — just a better way to search.

## The idea, in one example

Query: **"big windows / good light"**

| | Naive keyword search | Deephome (intent) |
|---|---|---|
| Top result | a **north-facing, 3rd-floor** unit whose listing text literally says "big windows" | a **south-facing, 28th-floor** unit with floor-to-ceiling glass |
| Why | matched the phrase | reconstructed *good light* → ranked by orientation + floor + window ratio |

The same phrase under a **different** intent ("big windows / great **view**") ranks a high-floor north unit first — because a view depends on floor, not sun. Same words, different intent, opposite ranking. No keyword or pure-vector search does this.

## How it works

A layered pipeline whose core asset is an **auditable Intent Knowledge Base** (surface → intent → weighted attributes):

- **Layer 1 — Intent understanding.** LLM-pluggable front-end (with a deterministic offline fallback) grounded by the Knowledge Base. Handles novel phrasing, negation, ambiguity, and asks a clarifying question only when intent genuinely forks.
- **Layer 2 — Intent → attribute planning.** Expands each intent into hard filters + weighted soft signals + text/image concepts + neighborhood signals.
- **Layer 3 — Hybrid retrieval.** Structured + full-text + AI image + places — because a single intent's evidence is scattered across all four.
- **Layer 4 — Transparent ranking.** A linear, explainable fusion; every point traces back to an intent and an attribute. (A cross-encoder re-ranker is an optional top-K polish, never a replacement.)
- **Layer 0 — Enrichment.** Turns raw MLS (remarks + basic fields + photos) into the attributes intents need — orientation, floor, ceiling height, pet policy, and a **photo-derived window ratio** — each with a source and confidence.

Full design and rationale: [`DESIGN.md`](./DESIGN.md).

## Quickstart (offline, no API keys)

```bash
npm install
npx tsx demo.ts          # intent search — surface words vs true intent
npx tsx demo-enrich.ts   # raw MLS → enriched attributes (with provenance)
npx tsx demo-vision.ts   # window ratio from photos, not wording
```

Everything runs on bundled sample data with zero keys. Use `npm run build:run` if `tsx` isn't available.

## Real data (Repliers)

Data sources are pluggable (`ListingSource`). There is **no free, redistributable full MLS feed** in Canada — MLS data is licensed by CREA and local boards. Practical paths:

- **Repliers** free *Preview* tier lets you build and validate the whole engine on sample data; real listings need the paid tier **plus** an MLS/brokerage authorization.
- The photo-based window signal uses Repliers **AI Image Search** (available on the free tier). Swap in one line: `enrich(raw, { vision: new RepliersVisionAdapter({ apiKey }) })`.

## Status & roadmap

Working prototype (algorithm + runnable proof). Next: an evaluation harness (LLM-as-judge) to quantify every change, batched photo scoring, and a learning loop that turns user corrections into Knowledge-Base improvements.

## License

Non-profit and open-source. See `LICENSE` (to be added).
