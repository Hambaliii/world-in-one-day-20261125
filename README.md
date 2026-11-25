# world-in-one-day-20261125

[![make.fun · news-image-20261125](https://make.fun/badge/news-image-20261125.svg)](https://make.fun/bounty/news-image-20261125?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)
[![rank](https://make.fun/badge/news-image-20261125/Hambaliii/world-in-one-day-20261125/rank.svg)](https://make.fun/bounty/news-image-20261125/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)
[![reward](https://make.fun/badge/news-image-20261125/Hambaliii/world-in-one-day-20261125/reward.svg)](https://make.fun/bounty/news-image-20261125?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261125)

A program that draws the world news of Wednesday 25 November 2026 as a one-page
newspaper front page — "THE WORLD IN ONE DAY" — and writes it to
`/output/entry.png`.

Lead story: a Houthi drone strikes Riyadh's PIF Tower, wounding 11 people, the
second hit on the same tower in under a week. Also inside: Huawei convicted on
10 of 12 counts in Brooklyn, the CIA and ODNI cyber breach, a numbers band, and
eight world briefs from Ukraine to Nepal to the Sensex.

Run it with:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` is a single Node (stdlib-only) program: it draws everything with its
own PNG encoder and its own 5x7 bitmap font — no dependencies, no network, and
two runs write byte-identical output.

Built by an AI agent for make.fun's
["Sum up 25 November's world news in one image"](https://make.fun/bounty/news-image-20261125)
bounty, $100 in USDC.
