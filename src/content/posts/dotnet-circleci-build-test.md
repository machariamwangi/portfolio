---
title: 'A .NET pipeline that fails for the right reasons'
slug: dotnet-circleci-build-test
date: '2026-11-12'
updated: '2026-11-18'
description: 'Build a clear CircleCI baseline for .NET 10: locked restore, one Release build, explicit VSTest execution and useful failure evidence.'
category: 'Delivery & CI'
tags: ['.NET', 'CircleCI', 'Testing', 'Continuous integration']
draft: false
featured: false
cover: /images/blog/dotnet-circleci-build-test-photo.webp
coverSmall: /images/blog/dotnet-circleci-build-test-photo-768.webp
coverAlt: "A laptop displays source code beside a dark, softly blurred workspace."
coverFocus: 50
coverCredit: {"author":"Arnold Francisca","source":"https://unsplash.com/photos/black-laptop-computer-on-white-surface-nPhl2x4fk2s","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}
order: 11
diagram:
  kind: flow
  title: 'One build, three distinct checks'
  steps: ['Locked restore', 'Release build', 'Run tests', 'Keep evidence', 'Publish output']
  caption: 'A restore, compiler or test failure stops publication. Test reports remain available to diagnose failures; they do not turn a failed test into success.'
---

A useful continuous integration pipeline answers a small set of questions clearly. Can this checkout restore its declared dependencies? Does it compile with the agreed toolchain? Do its tests pass? Can the application produce a deployable output? When those questions are mixed into one long command, a red build becomes harder to explain.

This recipe separates those checks without introducing a complicated workflow. It deliberately uses **.NET 10 LTS**, even though .NET 11 is available, and a test project that runs through **VSTest**. The commands are a starting point for a repository containing `Portfolio.sln`, `src/Portfolio.Api/Portfolio.Api.csproj` and `tests/Portfolio.Api.Tests/Portfolio.Api.Tests.csproj`. Replace these illustrative paths with real ones before running it.

## Choose the SDK and the test runner explicitly

The SDK installed on a developer laptop is not necessarily the SDK selected by a build agent. Put the decision in the repository. For this snapshot, the following `global.json` selects SDK 10.0.404 and fails if that exact SDK is unavailable:

```json
{
  "sdk": {
    "version": "10.0.404",
    "rollForward": "disable",
    "allowPrerelease": false
  }
}
```

SDK selection and a project's target framework are separate decisions. A `net10.0` project does not, by itself, pin the compiler tooling. Microsoft documents those selection rules in the [global.json reference](https://learn.microsoft.com/en-us/dotnet/core/tools/global-json).

The matching `mcr.microsoft.com/dotnet/sdk:10.0.404-noble` tag appears in Microsoft's [SDK image catalogue](https://github.com/dotnet/dotnet-docker/blob/main/README.sdk.md). A version tag is convenient, but its operating system layers may be rebuilt. When byte-level reproducibility matters, resolve and review an image digest as well. Schedule updates for that digest; freezing a toolchain permanently is not a maintenance strategy.

Confirm which test platform the repository uses before copying the logger flags below. `--logger trx` belongs to VSTest. Microsoft.Testing.Platform has different reporting options and extension requirements. Microsoft's [VSTest command reference](https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-test-vstest) is the relevant reference for this example.

## Make dependency changes reviewable

Enable lock files in the repository's `Directory.Build.props`:

```xml
<Project>
  <PropertyGroup>
    <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
  </PropertyGroup>
</Project>
```

Run a normal restore locally and commit the resulting `packages.lock.json` files for the application and test projects. CI then uses `--locked-mode`. An intentional package update changes the project declaration and its lock file together; an accidental mismatch fails before compilation. NuGet's [dependency locking documentation](https://learn.microsoft.com/en-us/nuget/consume-packages/package-references-in-project-files#locking-dependencies) describes the distinction between generating a lock file and enforcing it.

Keep package source credentials outside committed configuration. The first version of this pipeline assumes public packages. If you introduce a private feed, make that an explicit setup step with restricted credentials instead of embedding a token in a source URL.

![A pipeline moves through locked restore, compilation, tests, evidence collection and publication.](/images/diagrams/dotnet-circleci-build-test.svg)

## Start with one understandable job

Place this in `.circleci/config.yml`:

```yaml
version: 2.1
jobs:
  verify:
    docker:
      - image: mcr.microsoft.com/dotnet/sdk:10.0.404-noble
    working_directory: ~/project
    environment:
      DOTNET_CLI_TELEMETRY_OPTOUT: '1'
      DOTNET_NOLOGO: '1'
    steps:
      - run:
          name: Prepare SSH checkout tooling
          command: |
            apt-get update
            apt-get install -y --no-install-recommends openssh-client
      - checkout
      - run:
          name: Confirm toolchain
          command: dotnet --info
      - run:
          name: Restore the committed dependency graph
          command: dotnet restore Portfolio.sln --locked-mode
      - run:
          name: Compile once in Release mode
          command: dotnet build Portfolio.sln -c Release --no-restore
      - run:
          name: Run the VSTest suite
          command: |
            mkdir -p test-results
            dotnet test tests/Portfolio.Api.Tests/Portfolio.Api.Tests.csproj \
              -c Release --no-build \
              --logger 'trx;LogFilePrefix=api-tests' \
              --results-directory "$PWD/test-results"
      - store_artifacts:
          path: test-results
          destination: test-results
      - run:
          name: Produce application output
          command: |
            dotnet publish src/Portfolio.Api/Portfolio.Api.csproj \
              -c Release --no-build -o artifacts/api
      - store_artifacts:
          path: artifacts/api
          destination: application
workflows:
  verify-change:
    jobs:
      - verify
```

The Microsoft SDK image supplies Git; the preparation step supplies the SSH client needed by CircleCI integrations that check out over SSH. It runs as the image's default root user. For repeated use, a maintained CI image can include this tooling ahead of time, avoiding package installation on every job. Review that image alongside the SDK update.

Every build-related command agrees on `Release`. Without that consistency, `dotnet test --no-build` can look for a different output directory from the one the compiler produced. Publication also uses the existing build. If you later add a runtime identifier or change self-contained settings, apply compatible settings to restore, build and publish together; do not assume the existing output still matches.

The report directory is absolute when passed to the test runner, avoiding ambiguity about paths relative to a test project. The report name uses a prefix rather than one fixed filename so a multi-targeted project does not overwrite one framework's result with another.

## Keep failure evidence without hiding failure

Do not append `|| true` to the test command to make reports appear. That changes the meaning of the job. Keep the command's failure and use the dedicated artifact step to collect the files that were produced. A cancelled executor or hard timeout can still prevent collection, so keep ordinary test timeouts shorter than the entire job timeout.

TRX is useful downloadable evidence, but it is **not JUnit XML**. CircleCI's [test result ingestion documentation](https://circleci.com/docs/guides/test/collect-test-data/) requires JUnit XML for its test summaries and timing features. This baseline therefore stores TRX as an artifact instead of pointing `store_test_results` at an incompatible format. Add a reviewed JUnit logger or conversion step when you need those features, and verify the resulting test count before relying on it.

## Prove that the gates actually work

Use a temporary branch to exercise four failures: change a package reference without updating its lock file, introduce a compiler error, fail an assertion, and remove a required publication asset. Each should fail at an understandable stage. Restore the branch afterwards. This small rehearsal tests the pipeline's decisions, not just its happy path.

Then run the same job on a clean checkout with no local caches. A successful developer build can depend on generated files, case-insensitive filenames or an untracked settings file. Linux CI is especially useful for exposing those assumptions. Database integration tests need an explicit disposable database, schema setup and cleanup; this configuration does not secretly provide one.

Keep test data as deliberate as the package graph. A test for a billing cutoff should control its clock rather than assume today's date. A formatting test should select the culture whose behaviour it promises. An integration test should create its own records instead of relying on a shared account left by an earlier run. These choices make a failed assertion useful evidence about the change under review. They also make local reproduction possible: document the necessary environment inputs beside the tests, and keep production data out of that setup.

Record the command output and duration before adding caching or parallel jobs. A single-job baseline is easy to compare against future changes. When an optimization makes test selection or artifact identity harder to explain, remove it until its benefit is measurable.

This pipeline verifies and packages code; it does not release to production. Rolling back a bad pipeline edit means restoring the previous reviewed configuration and SDK selection. Rolling back an application release is a separate operation that should select a previously verified artifact, rather than rebuild an old commit and hope its dependencies resolve the same way.
