---
title: 'A faster pipeline should still prove the same thing'
slug: faster-circleci-without-skipping-tests
date: '2026-11-17'
updated: '2026-11-18'
description: 'Use dependency caches, workflow workspaces and test splitting for their distinct jobs, then verify that speed has not come from missing coverage.'
category: 'Delivery & CI'
tags: ['CircleCI', 'Performance', 'Testing', 'Developer experience']
draft: false
featured: false
cover: /images/blog/faster-circleci-without-skipping-tests-photo.webp
coverSmall: /images/blog/faster-circleci-without-skipping-tests-photo-768.webp
coverAlt: "Parallel railway tracks and platforms stretch through Hamburg Central Station in black and white."
coverFocus: 15
coverCredit: {"author":"C D-X","source":"https://unsplash.com/photos/grayscale-photo-of-railway-YSncr5jLx3M","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}
order: 15
diagram:
  kind: flow
  title: 'Optimize around a measured test contract'
  steps: ['Measure baseline', 'Reuse downloads', 'Partition tests', 'Collect JUnit', 'Compare coverage']
  caption: 'Historical timing feeds the next partition. Compare the union of shard results with the full suite before accepting a speed improvement; a cache miss must still produce a correct run.'
---

A green job that finishes quickly is not necessarily an improved job. A broken discovery pattern can omit half the tests. A stale build cache can make the pipeline validate yesterday's output. More parallel workers can finish the test command sooner while increasing total time through repeated setup and queueing.

Treat pipeline optimization as a controlled change to an existing contract: the same relevant code is checked, failures still fail, and the resulting evidence remains understandable. Start by measuring queue time, executor startup, dependency installation, compilation, tests and upload time separately. Optimize the dominant part rather than the command that looks easiest to edit.

## Give each storage mechanism one responsibility

A dependency cache saves reusable downloads across runs. A workspace transfers this workflow's output to later jobs. Artifacts retain reports or files for inspection. These are different lifetimes and different promises.

For example, `~/.npm` can accelerate package retrieval. A generated web bundle belongs in a workflow workspace when a downstream job needs to verify or package that exact bundle. A screenshot explaining a browser-test failure belongs among the job's artifacts. Putting everything into one giant archive increases transfer time and makes ownership unclear.

CircleCI's [caching guide](https://circleci.com/docs/guides/optimize/caching/) documents immutable cache keys. Once a key exists, another job cannot replace its contents. That makes the key design part of correctness: include a schema prefix, the relevant toolchain or platform boundary, and dependency lock-file checksums. Bump the prefix when the cache layout changes or a bad cache needs to be abandoned.

## Cache downloads while keeping installation deterministic

The following fragment belongs in a **single cache-producing job** using an approved Node executor. For this example, `cimg/node:26.13.1` is a documented image tag; use the Node version your application actually supports and change the key with it. The repository must already contain `package-lock.json`.

```yaml
steps:
  - checkout
  - restore_cache:
      keys:
        - npm-v3-node26-{{ arch }}-{{ checksum "package-lock.json" }}
  - run:
      name: Install the locked dependency graph
      command: npm ci --cache ~/.npm --prefer-offline
  - save_cache:
      key: npm-v3-node26-{{ arch }}-{{ checksum "package-lock.json" }}
      paths:
        - ~/.npm
```

Use this same restore key in consumers, but do not make every parallel test node upload the same cache. Repeated uploads race for a key that only one writer can populate. A separate cache-producing job also has startup cost, so measure whether that extra serial step is worthwhile. An existing build job can be a better owner.

The installation command still runs after a cache hit. The cache is a shortcut for obtaining inputs, not permission to skip lock-file validation. Run an occasional cold-cache build to ensure the repository does not depend on something left behind by a previous execution.

Avoid a broad fallback key until you understand the package manager's validation behaviour. Never cache a directory containing cloud tokens, private credentials or environment-specific runtime configuration. Cache contents should be safe to reuse by every job that can retrieve that key.

![Baseline measurement leads through download reuse, test partitioning, JUnit collection and coverage comparison.](/images/diagrams/faster-circleci-without-skipping-tests.svg)

## Make test discovery observable before parallelizing

The concrete example below uses a repository with Vitest already pinned in its development dependencies. It targets **CircleCI Cloud's `circleci testsuite` workflow**, which the current [Smarter Testing setup guide](https://circleci.com/docs/guides/test/getting-started-with-smarter-testing/) recommends. Existing `circleci tests` integrations can migrate incrementally; CircleCI Server requires a separate compatible approach.

Create `.circleci/test-suites.yml`:

```yaml
---
name: frontend-unit
discover: ./node_modules/.bin/vitest list --filesOnly
run: >-
  ./node_modules/.bin/vitest run
  --reporter=junit
  --outputFile="<< outputs.junit >>"
  --maxWorkers=1
  --no-file-parallelism
  << test.atoms >>
outputs:
  junit: test-reports/frontend.xml
```

The discovery command should emit test file paths and nothing else. A banner or debugging message on standard output can be mistaken for a test item. The runner then receives the selected paths. These examples assume ordinary repository paths without spaces; use a deliberately tested wrapper if your naming conventions need more careful argument handling.

The [testsuite configuration reference](https://circleci.com/docs/reference/testsuite-configuration-reference/) defines the placeholders and output contract. Vitest's [CLI reference](https://vitest.dev/guide/cli) describes file listing, one-shot execution and worker controls. Limiting workers inside each shard avoids multiplying machine-level parallelism by an unexpectedly large runner pool.

Before increasing parallelism, run:

```bash
circleci testsuite doctor frontend-unit
circleci testsuite run frontend-unit
```

Compare the reported test identities and counts with a normal full Vitest run. A matching exit code alone is insufficient. Check disabled tests, generated cases and suites that depend on a shared setup file. Keep an independent inventory so a discovery change cannot quietly redefine what “all tests” means.

## Add a small amount of parallelism

This job consumes an existing cache when available and remains correct when the cache is empty. Add it to a workflow after your chosen cache producer, or run it directly if the extra producer job would cost more than it saves:

```yaml
jobs:
  frontend-tests:
    docker:
      - image: cimg/node:26.13.1
    parallelism: 3
    steps:
      - checkout
      - restore_cache:
          keys:
            - npm-v3-node26-{{ arch }}-{{ checksum "package-lock.json" }}
      - run: npm ci --cache ~/.npm --prefer-offline
      - run: mkdir -p test-reports
      - run: circleci testsuite run frontend-unit
      - store_test_results:
          path: test-reports
      - store_artifacts:
          path: test-reports
```

Each executor has its own filesystem, so using the same report filename across nodes is fine here. A later aggregation step that copies files into one directory must give them unique names. Do not let one shard overwrite another's evidence.

Historical JUnit timing allows more informed partitioning. Inspect the slowest shard, not just the average. One large test file can dominate a static split, while repeated database setup can erase the benefit of adding workers. Split oversized test groups when their fixtures allow it, and give each shard isolated data namespaces rather than sharing mutable records.

## Keep workspaces small and attributable

Use a workspace for a built bundle or release manifest that downstream jobs must consume exactly. Assign each producer a unique directory. CircleCI's [workspace guide](https://circleci.com/docs/guides/orchestrate/workspaces/) explains that concurrent writes to the same filename can cause attachment errors and that reruns may inherit prior workspace data.

Do not persist the whole checkout merely to avoid another `checkout` step. Measure archive creation, upload, download and extraction. Sending a very large dependency directory can be slower than restoring a download cache and reinstalling, especially across several nodes.

## Accept or revert the optimization with evidence

Compare a cold run, a warm run and a run after a dependency change. Check total workflow duration, compute use, test identities and failure visibility. Deliberately fail a test on a nonzero shard and confirm that the whole required workflow fails. An empty shard should not accidentally invoke the entire suite because a wrapper dropped its selected arguments.

Keep the previous configuration easy to restore. If missing results, unexplained flakiness or storage overhead appear, reduce parallelism and revert the relevant optimization while investigating. A modest, repeatable improvement is more useful than an impressive duration that no longer proves the same application behaviour.
