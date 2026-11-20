---
metadata:
  version: "1.0"
name: playtest-protocol
description: "Use this skill for game development process questions: playtesting, iteration planning, prototyping, what to build next, or interpreting test feedback. Trigger on: 'plan my playtest', 'how do I test this feature', 'my playtest feedback contradicts itself', 'should I build X or Y first', 'roadmap review', 'am I overplanning', 'graybox', 'prototype plan', 'my design doc is huge and nothing is built', 'players said they liked it but quit', or any request to design a testing process, order a backlog by dependency risk, or audit a repo's testability. Especially relevant for solo and AI-assisted devs who are their own playtest lab."
---

# Playtest Protocol

Game design knowledge comes from tests, and most design plans are wrong in ways only a test reveals. The process failures are symmetrical: overplanning builds detailed castles on unvalidated foundations, underplanning thrashes with no direction. This skill designs test protocols, orders work by dependency risk, and audits repos for testability.

 

## Core concepts

**Plan to the horizon, not past it.** The planning horizon is how far ahead design decisions stay reliable, and it is shorter than intuition says: uncertainty compounds through every dependent decision. Detailed plans beyond the horizon are fiction with formatting. Plan tightly inside the horizon, sketch beyond it, and expect the sketch to change.

**The dependency stack orders the work.** Some design decisions rest on others: the ability system rests on the combat loop, the combat loop rests on the core verb feeling good. Test foundational layers first, because a change at the bottom invalidates everything built on top. The most expensive mistake in game development is polishing content on a core loop that later changes.

**Grayboxing tests structure before art.** A graybox build uses placeholder visuals to test whether the mechanics and level structure work at all. It demands a specific evaluation skill: judging a graybox requires imagining the finished feel through the placeholder, and most people (including devs) cannot do it untrained. Adding art too early is premature production; it makes the build prettier and the test results noisier, and it welds the team to decisions that have not earned permanence.

**Testers report feelings accurately and causes badly.** Players misattribute: they blame the visible (graphics, one boss) for problems in the invisible (pacing, information starvation). Harvest the what and when of their emotions; discard their whys and their proposed fixes, or rather, treat a proposed fix as a pointer to a felt problem nearby.

**Test protocol determines data quality.** Self-testing is fast and biased; the dev knows too much. Over-the-shoulder observation of a fresh player is the workhorse: watch silently, log where they look, stall, and quit, and interview afterward with open questions ("what was going through your mind at the bridge?") rather than leading ones ("did you like the bridge fight?"). Fresh testers expire; each person's first contact happens once. Small samples per iteration beat large samples per quarter.

## Process design workflow

1. **Locate the horizon.** Ask what has actually been validated by play. Everything downstream of an untested assumption is beyond the horizon; flag detailed plans living there.
2. **Build the dependency stack.** List open design questions; draw which rest on which. The next test targets the lowest unvalidated layer, always. Produce a backlog ordered by that rule, with the user's current roadmap diffed against it.
3. **Design the next test.** Define the question, the cheapest build that answers it (usually a graybox), the tester source, the sample size (three to five fresh testers per iteration is plenty), and the observation plan. Pre-write the interview questions, open-ended only.
4. **Interpret results.** Separate the emotion log (trustworthy) from the explanations (suspect). Map each felt problem to candidate causes across the invisible systems before accepting the visible culprit.
5. **Guard against the two pathologies.** If the user's plan details systems five layers up the stack, name the overplanning and price it (work invalidated if a lower test fails). If the user is iterating with no question defined per build, name the underplanning and install step 3.

## Repo audit workflow

1. **Testability of the core loop.** Can the game boot into a specific scenario for testing (debug menu, scene launcher, seed control, save injection)? If reaching the system under test takes ten minutes of play, iteration speed is capped there. Report the gap and the cheapest harness.
2. **Graybox hygiene.** Check whether placeholder and final assets are distinguishable and swappable (naming conventions, asset flags). Repos where polish and prototype interleave in the same scenes cannot cheaply revert a failed structural test.
3. **Premature production markers.** Find high-polish content (final art, audio, VO hooks) attached to systems with active design churn in recent commits. Each is capital at risk; list the exposure.
4. **Feedback capture.** Check for a session-logging path: positions, deaths, choices, timestamps. Solo devs especially need the machine to be the second observer. Recommend the minimal log if absent.
5. **Iteration friction.** Measure build/run cycle time and count the manual steps from code change to playing the changed content. Every step is a tax on the number of tests that will actually happen.
6. **Assumption register.** From code and docs, list the load-bearing design assumptions that have never met a fresh player. This register plus the dependency stack is the real roadmap.

## Output format

**Validated versus assumed map** (the horizon) · **Dependency stack** with the single next test named · **Test design**: question, build, testers, sample, interview script · **Feedback interpretation** (when given playtest data): emotion log versus explanation log, candidate invisible causes · **Repo findings** with file paths: harness gaps, premature production exposure, missing logging, cycle-time taxes · **Ordered backlog** diffed against the user's current plan.
