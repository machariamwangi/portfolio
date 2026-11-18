---
title: Build Git commits that stay readable through review
slug: git-commits-built-for-review
date: '2023-04-20'
updated: '2026-11-18'
description: Use interactive staging, fixup commits, autosquash, rerere, and range-diff to prepare coherent changes while protecting shared history.
category: Git & Teams
tags: [Git, Code review, Rebase, Collaboration, Developer workflow]
draft: false
featured: false
cover: /images/blog/git-commits-built-for-review-photo.webp
coverSmall: /images/blog/git-commits-built-for-review-photo-768.webp
coverAlt: "A person writes notes in a notebook beside a laptop."
coverFocus: 50
coverCredit: {"author":"JESHOOTS.COM","source":"https://unsplash.com/photos/person-writing-on-white-notebook-LtNvQHdKkmw","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}
order: 20
diagram:
  kind: flow
  title: Preserve intent through each review revision
  steps: [Select changes, Create commits, Fold fixes, Rebase, Compare, Review]
  caption: Shape local history deliberately, then verify the patch series before asking others to depend on it.
---

A pull request can be small in line count and still difficult to review. Perhaps a behavior change is mixed with formatting, a correction is several commits away from the code it fixes, or a rebase makes every commit look unfamiliar. Reviewers then spend their attention reconstructing intent.

Git provides a connected set of tools for that problem. Interactive staging helps create coherent commits. Fixup commits remember where a correction belongs. Autosquash folds those corrections into a prepared series. Rerere reduces repeated conflict work, and range-diff helps explain what changed between review rounds.

Use this workflow for a local feature branch whose history you are allowed to rewrite. If others have based work on the branch, agree a different approach first. A clean-looking history is not worth disrupting someone else's work.

![Six steps for selecting changes, creating commits, folding corrections, rebasing, comparing, and reviewing](/images/diagrams/git-commits-built-for-review.svg)

## Define the review units before staging

Suppose an export change contains three ideas: fix the final-row bug, add its regression test, and rename an unrelated helper. The fix and test belong together because they explain and verify one behavior. The rename deserves its own commit or a separate pull request if it distracts from the change.

A useful commit has a reason a reviewer can state in one sentence. That does not mean every commit must be tiny. Splitting a required migration from the code that depends on it may make the intermediate history misleading or unbuildable. Let the behavior and dependency structure guide the split.

Before staging, run `git status` and inspect the diff. Look for generated files, debugging output, and incidental edits. This is easier while the context is fresh than after a reviewer asks why a configuration file changed.

## Select hunks instead of sweeping up the directory

Stage the intended parts interactively:

```sh
git add -p -- src/export.ts tests/export.test.ts
git diff --cached
git diff --cached --check
git commit -m "Preserve the final row in CSV exports"
```

The patch interface lets you accept or reject individual hunks and split them when possible. New untracked files need attention too: explicitly add a whole new test file when appropriate, or use intent-to-add before patch selection. Read the staged diff before committing. [The add manual describes patch selection and its boundaries](https://git-scm.com/docs/git-add).

One subtle trap remains: your test command usually sees the working directory, including changes you did not stage. A successful test there does not prove the commit works alone. Verify the resulting commit from a clean checkout when the distinction matters; the [worktree workflow](/writing/git-worktrees-bisect-reflog/) provides a convenient way to do that without losing other edits.

Keep unrelated unfinished work out of the rebase phase. Commit it separately where appropriate or postpone rewriting until you have a clean working directory.

## Record corrections with their intended destination

After reviewing the local series, suppose the original fix needs one more edge case. Locate the commit it corrects, stage the adjustment, and create a fixup:

```sh
git log --oneline origin/main..HEAD
git add -p -- src/export.ts tests/export.test.ts
git commit --fixup=TARGET_COMMIT
```

Replace `TARGET_COMMIT` with the actual hash shown in the log. The new commit records a correction associated with that earlier commit. It has not rewritten anything yet. Plain fixup preserves the target's message when later combined; amend and reword variants have different message behavior. [The commit reference explains those distinctions](https://git-scm.com/docs/git-commit).

This is useful during active development because you can preserve a checkpoint immediately without deciding the final history on the spot. It also avoids a sequence of ambiguous messages such as “fix again” that conceals which earlier decision changed.

Do not fold a new product requirement into an old fix just because both touch the same file. A correction and a new behavior are different review units.

## Save the old series before rebasing

Assume the feature branch is local and clean. Fetch the target branch, preserve the current tip, and identify the old series base:

```sh
git fetch origin
git branch safety/export-before
git merge-base origin/main HEAD
git branch safety/export-base BASE_COMMIT
git rebase -i --autosquash origin/main
```

Replace `BASE_COMMIT` with the hash returned by `merge-base`. Use fresh safety-branch names if those already exist. Inspect the interactive todo list: corrections should follow the intended targets. Rebase creates new commits, so their identifiers change. Use `git rebase --abort` if the operation is not proceeding as intended. [The rebase manual covers autosquash and conflict handling](https://git-scm.com/docs/git-rebase).

When conflicts arise, resolve the desired behavior, stage the resolved files, and continue. Do not choose one side solely to make the conflict disappear. The upstream change and your feature may both contain requirements that the final code must preserve.

Keep the safety references until the new series has been verified. They provide an explicit comparison point and make discussion easier than relying on memory.

## Let rerere remember repeated conflict resolutions

For a branch that repeatedly encounters the same conflict, enable recorded resolution reuse in this repository before starting the rebase:

```sh
git config --local rerere.enabled true
git config --local rerere.autoupdate false
```

Once a conflict has been resolved and recorded, a later matching conflict may reuse that resolution. Keeping automatic index updates disabled leaves a deliberate review and staging step. Inspect the working diff, use `git rerere diff` when investigating the recorded resolution, and run the relevant checks before adding files. [The rerere documentation explains resolution reuse](https://git-scm.com/docs/git-rerere).

A previously correct resolution can become wrong as surrounding requirements change. Treat reuse as a suggested edit, not evidence of correctness. This is especially valuable for recurring integration work, but it should not become a reason to keep branches diverged indefinitely.

Team members also need to understand that this is local assistance, not a shared record of approval. A successful reuse does not replace code review or make a conflict-free result semantically correct.

## Compare the two review rounds

After the rebase, compare the preserved series with the new one:

```sh
git range-diff safety/export-base..safety/export-before origin/main..HEAD
git diff --check
```

Range-diff matches commits across two ranges and highlights changes to their patches and messages. It is useful when commit identifiers changed but reviewers want to understand the actual revision. Matching is heuristic, and merge commits are ignored by default, so it is not proof that two histories are equivalent. [The range-diff reference explains its comparison model](https://git-scm.com/docs/git-range-diff).

Run the project's relevant tests on the resulting series. Inspect the final diff against the target branch as well. If the range comparison shows an unexpected dropped patch, investigate before publishing; do not assume autosquash intended it.

For an unpublished branch, push it normally and open the review. For an already shared branch, prefer additional commits or a coordinated replacement branch. Do not use a blind force push to make the remote accept the rewrite. Follow branch protection and the team's explicit agreement about history changes.

In the review description, explain what changed since the previous round, which conflicts required judgment, and what was tested. The tools prepare the evidence; that short explanation helps the next person use it.
