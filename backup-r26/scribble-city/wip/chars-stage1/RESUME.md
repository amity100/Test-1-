# Characters round, stage 1 — stopped mid-work (waiting for the user's go-ahead)

Base commit: 87864f0. Two tracks, each a patch series made with `git format-patch`:
- portrait/ — the portrait engine at scale (a shared kit, per-person slots, maps painted off the
  main thread, budgets for desktop and phone, a cross-fade instead of a pop). Unfinished and untested.
- rig/ — the head on a neck that twists and bends, a neck-top pivot, one look shared by the eyes,
  the head and the chest, a conforming neck per kind. Work in progress; bench page v5/bench/neck.html.

To resume: `git worktree add -b wip/rig /home/user/wt/rig 87864f0 && git -C /home/user/wt/rig am <this dir>/rig/*.patch`
(the same for portrait). The analysis the work follows is described in ROADMAP stage 14.
