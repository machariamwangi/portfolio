---
title: Git worktrees, bisect, and reflog make interruptions less expensive
slug: git-worktrees-bisect-reflog
date: '2022-05-19'
updated: '2026-11-18'
description: Preserve unfinished work, investigate a regression in isolation, and recover a lost commit with a practical workflow built from three underrated Git tools.
category: Git & Teams
tags: [Git, Worktrees, Debugging, Developer workflow]
draft: false
featured: false
cover: /images/blog/git-worktrees-bisect-reflog-photo.webp
coverSmall: /images/blog/git-worktrees-bisect-reflog-photo-768.webp
coverAlt: "A railway switch divides into separate tracks beside an old station building in Isili, Italy."
coverFocus: 50
coverCredit: {"author":"Davide Baraldi","source":"https://unsplash.com/photos/train-track-near-grey-concrete-building-during-daytime-TZY1I8XSSI0","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}
order: 19
diagram:
  kind: flow
  title: Investigate without dismantling your current work
  steps: [Preserve context, Isolate, Reproduce, Bisect, Recover]
  caption: Separate working directories preserve context while Git history supplies evidence and recovery points.
---

An urgent regression arrives while your working directory contains half a feature, a useful debugging change, and an unfinished test. The expensive part is not necessarily fixing the regression. It is preserving enough context to return to the original work without reconstructing your thinking.

Three Git tools fit together particularly well here. A **worktree** gives the investigation a separate working directory. **Bisect** narrows the history using a repeatable check. The **reflog** helps locate commits after a branch or HEAD has moved unexpectedly.

The examples assume an existing repository, a remote called `origin`, and a primary branch called `main`. Adapt those names and the test commands to your project. All investigation work is local until you explicitly publish a branch.

![A regression investigation moving from preserved context to isolation, reproduction, bisection, and recovery](/images/diagrams/git-worktrees-bisect-reflog.svg)

## First, record the state you are leaving

Before changing anything, inspect the current branch and modifications:

```sh
git status --short --branch
git diff --stat
git diff --cached --stat
```

Distinguish staged changes from unstaged ones and untracked files. They are different kinds of unfinished work. Write a brief note about the next intended step, especially if the feature depends on a temporary experiment. [The status manual explains how Git reports these states](https://git-scm.com/docs/git-status).

Do not make a meaningless commit solely to escape the directory if a separate checkout solves the problem. Equally, a worktree does not back up unsaved editor buffers. Save files you want preserved and keep your normal repository backup habits.

For a larger team, add the incident or bug identifier to the investigation notes. That creates a useful connection between the operational symptom and the code investigation without forcing every diagnostic detail into a commit message.

## Give the fix a separate worktree

Fetch current references, then create a new local branch in a sibling directory:

```sh
git fetch origin
git worktree add -b fix/export-regression ../portal-fix origin/main
git worktree list
```

The original directory stays on its existing branch with its unfinished files. The linked worktree shares repository history and objects, but has its own working files and index. Git normally prevents checking out the same branch in multiple worktrees; use a distinct branch rather than overriding that protection. [The worktree documentation describes this model](https://git-scm.com/docs/git-worktree).

Open `../portal-fix` in a separate editor window. Install the dependencies required by that revision. Check application ports, local database names, and environment files: separate source directories do not automatically isolate external resources.

A useful convention is to give each active worktree a clear purpose. One might hold the feature, another the fix, and another a clean review of a release. Too many anonymous directories recreate the context problem under different names.

## Reproduce one symptom before searching history

Suppose CSV exports omit the final row for a certain input. Create the smallest representative input and a check that distinguishes correct output from the regression. Record the environment, command, expected result, and actual result.

Keep the regression test independent of live customer data and unstable external services. A network timeout should not label a source revision “bad” when the behavior being investigated is CSV serialization.

Inspect likely changes, but do not let an attractive commit message substitute for evidence:

```sh
git log --oneline -12
git show --stat HEAD
git show HEAD -- src/export.ts
```

`git show` can display a commit's metadata and patch, with a path restriction when needed. Use it to understand a candidate change and its context, not to assign blame. [See the official show reference](https://git-scm.com/docs/git-show).

Before bisection, establish two tested endpoints: a revision with the symptom and an earlier revision without it. A release tag is useful only after confirming the same test works there.

## Let bisect narrow the candidate set

Use another clean, detached worktree for history traversal so the fix branch stays undisturbed:

```sh
git worktree add --detach ../portal-bisect origin/main
cd ../portal-bisect
git bisect start
git bisect bad
git bisect good KNOWN_GOOD_COMMIT
```

Replace `KNOWN_GOOD_COMMIT` with the verified hash or tag. Run the same check at each selected revision, then use `git bisect good` or `git bisect bad`. If a revision cannot be evaluated, use `git bisect skip` rather than guessing.

For a stable automated check, `git bisect run` interprets exit code `0` as good and `125` as untestable; ordinary nonzero codes in its documented range mark bad revisions. Keep the harness outside the traversed checkout when historical revisions do not contain it. Preserve the log before ending:

```sh
git bisect log
git bisect reset
```

The result identifies a boundary for the chosen test, not a complete explanation of the defect. Confirm it and inspect the patch. [The bisect manual explains its classifications and exit codes](https://git-scm.com/docs/git-bisect).

Skipped revisions can leave several candidates. Changing dependencies, configuration, or test data can also invalidate the apparent boundary. If the result seems impossible, verify the experiment before proposing a patch.

## Use the reflog to recover a reference, not erase history

If an experiment leaves a useful commit hard to find, stop and inspect local reference movements:

```sh
git reflog show HEAD --date=iso
git show CANDIDATE_COMMIT
git branch rescue/export-investigation CANDIDATE_COMMIT
```

Replace `CANDIDATE_COMMIT` with the inspected hash. Creating a rescue branch gives that commit a durable name without resetting the current branch or discarding working files.

Reflogs record movements in this local repository. They are not normally transferred by push and are not a permanent backup. Retention and garbage collection affect what remains recoverable. They also cannot promise recovery of arbitrary uncommitted file contents. [The reflog reference describes local history and expiry](https://git-scm.com/docs/git-reflog).

For a shared branch, coordinate the corrective change through the team's review process. A local recovery discovery does not justify rewriting everyone else's history. Often the useful next action is a new fix commit or a reviewed revert.

## Finish with evidence and deliberate cleanup

Return to the fix worktree, add the regression test, implement the smallest appropriate change, and run the relevant checks. In the pull request, describe the failing behavior, the reproduced boundary, and how the fix was verified. Include remaining uncertainty if the investigation depended on skipped revisions.

After the work is committed and preserved where intended, leave the temporary directory and remove its worktree using `git worktree remove`. Do not add a force flag merely because Git reports remaining changes. Inspect and preserve them first; the worktree command does not imply that a local branch has been safely published.

This workflow scales without much ceremony. A solo developer keeps feature context intact. A larger team gains reproducible evidence, independent review directories, and a recovery habit that begins with inspection rather than a destructive reset.
