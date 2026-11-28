---
metadata:
  version: "1.0"
name: elegance-audit
description: "Use this skill when a game or repo has too many mechanics, too much special-case code, or shallow gameplay despite lots of content. Trigger on: 'my game feels bloated', 'should I cut this mechanic', 'my codebase is full of special cases', 'players found an exploit/dominant strategy', 'balance review', 'the game is complicated but shallow', 'simplify my game', or any request to evaluate mechanics for interaction, emergence, or balance. Also trigger during feature-creep discussions and when auditing a repo where gameplay code has grown by accretion. Pairs with emotion-engine-audit: that skill asks whether a mechanic produces feeling, this one asks whether it earns its complexity."
---

# Elegance Audit

An elegant game gets a lot of gameplay out of few rules. Depth comes from mechanics interacting to produce situations the designer never authored, and every mechanic that fails to interact is complexity the player pays for without return. This skill hunts non-earning mechanics in designs and their fingerprints in code.

Concepts adapted from Tynan Sylvester's *Designing Games* (O'Reilly, 2013), rewritten here; also draws on his treatment of balance and degenerate strategies. Explain ideas in your own words; never reproduce the book's text.

## Core concepts

**Emergence is the engine of value.** When mechanics combine, possible situations multiply faster than rules do. A mechanic's worth is roughly the number of meaningful interactions it has with other mechanics, times the frequency players encounter them.

**Complexity is a cost paid by the player.** Every rule must be learned, remembered, and read from the interface. A mechanic that interacts with nothing charges full learning cost and returns one situation. Cut it or make it connect.

**Elegant mechanics share traits.** They reuse conventions players already know, work in many game situations rather than one, overlap several roles at once, and do not demand constant interface attention. Inelegant ones exist for a single scripted moment, need exceptions bolted on to work, or duplicate another mechanic's job with different numbers.

**Degenerate strategies rot depth.** A degenerate strategy is one dominant enough that a player who knows it has no reason to engage with the rest of the game. It does not need to be literally unbeatable; it needs only to outperform everything else reliably. Counting "viable strategies" flatters a design; the honest test is what a skilled, unsentimental player converges on.

**Balance serves fairness and depth, and only sometimes.** Multiplayer starting positions demand fairness. Single-player games often profit from deliberate imbalance (overpowered toys are fun). Decide what the balance goal is before tuning numbers; tuning without a goal is churn.

## Design review workflow

1. **Inventory the mechanics.** List every rule the player must understand. Be honest about count; devs undercount by grouping.
2. **Build the interaction matrix.** Mechanics on both axes; mark each pair that produces a meaningful combined situation in real play. Sparse rows are cut candidates. Dense rows are the game's core; protect them.
3. **Score cut candidates.** For each sparse mechanic ask: what would the game lose if this vanished tomorrow? If the answer is "a menu gets shorter", cut it. If it exists for one scripted beat, ask whether the beat can run on an existing mechanic instead.
4. **Hunt degenerate strategies.** Play as the ruthless optimiser: what is the highest-return, lowest-effort line? Check the classic sites: safe-distance attrition, stacking one stat, repeatable exploit loops, turtling, single-answer counters. Then check whether the game punishes or ignores that line.
5. **Set the balance goal.** Fairness, depth, drama, or power fantasy. Only then recommend number changes, and prefer changes that add or remove interactions over pure stat nudges; stat nudges rarely fix a structural dominance.

## Repo audit workflow

Inelegance leaves marks in code. Given a repo:

1. **Special-case density.** Grep gameplay systems for entity- or level-specific branches (`if (enemyType == ...)`, `if (levelId == ...)`, hardcoded IDs, per-item switch statements). A mechanic implemented mostly as exceptions is telling you it does not generalise. Report the worst files by branch count.
2. **One-consumer systems.** Find modules referenced from exactly one call site or one content file. These often implement single-use mechanics; each is a design cut candidate, not just a refactor candidate.
3. **Duplicate-role systems.** Look for parallel implementations of the same job (two damage pipelines, two currency systems, two status-effect frameworks). Players experience these as two things to learn that do one thing.
4. **Config sprawl as a symptom.** Hundreds of tuning knobs with near-identical values usually mean the design is compensating numerically for missing interaction. Note clusters of parameters that only ever move together.
5. **Exploit surfaces.** Check for unclamped stacking (multipliers applied multiplicatively without caps), timers or cooldowns resettable by cheap actions, and economy loops where a sequence of actions returns more than it costs. These are the code-level roots of degenerate strategies; report each with the sequence a player would use.
6. Cross-reference with the design inventory: a mechanic that is both a sparse row in the interaction matrix and a special-case hotspot in code is the strongest possible cut signal.

## Output format

**Mechanic inventory and interaction matrix** (table) · **Cut list** ranked by complexity saved versus play lost · **Degenerate strategy findings** with the exact player line and the structural fix · **Repo findings** with file paths: special-case hotspots, one-consumer systems, duplicate roles, exploit surfaces · **Balance goal statement and tuning recommendations** last, since structure beats numbers.

Recommend cuts plainly. The most common failure mode in review is softening a cut into "consider revisiting", which the dev reads as permission to keep it.
