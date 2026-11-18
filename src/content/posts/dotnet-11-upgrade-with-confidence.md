---
title: 'Moving to .NET 11 without turning the upgrade into a rewrite'
slug: dotnet-11-upgrade-with-confidence
date: '2026-11-11'
updated: '2026-11-18'
description: 'A practical .NET 11 migration plan covering SDK selection, dependency changes, compatibility checks, deployment evidence, and rollback.'
category: 'C# & .NET'
tags: ['.NET 11', 'Architecture', 'Deployment']
draft: false
featured: false
cover: /images/blog/dotnet-11-upgrade-with-confidence-photo.webp
coverSmall: /images/blog/dotnet-11-upgrade-with-confidence-photo-768.webp
coverAlt: "A suspension bridge crossing dense green forest at Capilano in Canada"
coverFocus: 58
coverCredit: {"author":"Cayetano Gil","source":"https://unsplash.com/photos/trees-between-bridge-during-daytime-IIN1k30xGBw","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}
order: 1
diagram:
  kind: flow
  title: 'An upgrade earns its way into production'
  steps: ['Inventory', 'Retarget', 'Verify contracts', 'Canary release', 'Observe']
  caption: 'A failed contract or unhealthy canary returns the change to investigation; keep the previous deployable artifact available.'
---

.NET 11 is a released product, not a preview: Microsoft released it on November 10, 2026. As of this article's publication, the support table lists .NET 11 as an STS release and .NET 10 as an LTS release, both ending support on November 14, 2028. That makes the decision more interesting than simply choosing the highest version number. A team can adopt the new release for concrete benefits while another keeps a healthy application on the supported LTS line. [Microsoft's support policy](https://dotnet.microsoft.com/en-us/platform/support/policy) is the source of truth for those dates.

The practical question is whether the application, its dependencies, and its operating environment are ready together. An upgrade should produce evidence about that question. It should not depend on someone remembering which settings they changed on a laptop.

## Start with an inventory you can repeat

Record the current SDK, installed runtimes, target frameworks, deployment operating systems, and package graph. Run the same checks locally and in CI. A container build can use a different SDK from the host running the command, so inspect both when containers are involved.

```bash
dotnet --info
dotnet --list-sdks
dotnet --list-runtimes
dotnet package list --include-transitive
```

Keep the inventory small enough to review. The useful output is a table of deployable applications and their dependencies, not an enormous attachment that nobody reads. Include scheduled workers and migration tools: a forgotten command-line utility can block a release even when the main API builds successfully.

Capture baseline behavior before changing targets. For a catalogue service, that could mean a representative product response, a rejected request, a database migration rehearsal, and latency under an existing test workload. Record the workload and machine settings beside measurements. Without those details, a faster result may reflect a different environment rather than the runtime upgrade.

## Select the SDK and runtime deliberately

The SDK builds the application; the target framework describes the platform it targets. These are separate choices. A repository-level `global.json` can make SDK selection reproducible. The following example requires the initial .NET 11 SDK exactly; replace that version as part of normal servicing rather than leaving it frozen indefinitely.

```json
{
  "sdk": {
    "version": "11.0.100",
    "rollForward": "disable",
    "allowPrerelease": false
  }
}
```

An exact pin is useful when CI images and developer setup are controlled together. A team that intentionally permits newer servicing builds can choose a suitable roll-forward policy instead. Make that a repository policy, not an accidental consequence of whichever SDK is installed. [The global.json reference](https://learn.microsoft.com/en-us/dotnet/core/tools/global-json) explains the resolver's policies and search behavior.

For a web application, the target change looks like this:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net11.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>
```

Keep the first migration branch focused on building and running the existing application. Converting every endpoint to new language features at the same time increases the number of possible explanations for a regression. New syntax can follow in smaller changes after the platform move is established.

## Treat dependencies as part of the application

Review framework-adjacent packages together, especially ASP.NET Core extensions and EF Core providers. Updating EF Core while retaining an incompatible database provider is not a complete upgrade. Check packages supplied by other vendors separately; matching their major version to the runtime is not a universal compatibility rule.

The [ASP.NET Core 10-to-11 migration guide](https://learn.microsoft.com/en-us/aspnet/core/migration/100-to-110) covers SDK, target framework, package references, and framework-specific changes. Use it as an inventory aid, then inspect the resulting dependency diff. Remove an explicit package reference only when the framework actually supplies the required functionality and your application's supported targets allow it.

Review [the .NET 11 compatibility catalogue](https://learn.microsoft.com/en-us/dotnet/core/compatibility/11) by the areas your system uses. A successful compilation cannot detect every behavioral change. Configuration, cryptography, globalization, filesystem access, and networking deserve attention when they form part of a contract with another system.

One concrete deployment concern is the updated hardware baseline. Microsoft's [hardware compatibility note](https://learn.microsoft.com/en-us/dotnet/core/compatibility/jit/11/minimum-hardware-requirements) documents the x86/x64 move to x86-64-v2. Inventory actual production machines or virtual CPU capabilities. A successful container build does not prove that its runtime will start on every machine in an older cluster.

![Upgrade gates from inventory through retargeting and contract verification to a monitored canary](/images/diagrams/dotnet-11-upgrade-with-confidence.svg)

## Verify contracts, then exercise the artifact

Run the existing suite before deciding which new tests to add. Add focused checks where the migration touches a meaningful boundary: JSON shapes, authentication challenges, database queries, scheduled-job shutdown, or generated OpenAPI consumed by clients. Avoid tests that merely assert that the target framework string changed.

```bash
dotnet restore
dotnet build --configuration Release --no-restore
dotnet test --configuration Release --no-build
dotnet publish src/Catalog.Api/Catalog.Api.csproj \
  --configuration Release --no-restore \
  --output artifacts/catalog-api
```

The path is illustrative; use the deployable project's actual path. Run those commands from the same repository directory that resolves `global.json`. Test the published output too. A web-host integration test is valuable, but it does not exercise every deployment detail, such as native libraries, filesystem permissions, reverse-proxy headers, or the process supervisor's shutdown timeout.

Keep schema evolution independent from application rollback. If the new build requires a destructive database migration, retaining the old binary is insufficient. Prefer changes that allow old and new application versions to coexist during rollout, and rehearse any unavoidable data transition with representative data.

## Make the release observable and reversible

Deploy a small amount of traffic first when the hosting model supports it. Compare error rate, latency, resource use, and business outcomes with the baseline. A healthy HTTP status page does not prove that customers can complete a workflow. Include one or two low-risk end-to-end checks that reflect the service's purpose.

Define the rollback trigger before deployment. Decide who can stop the rollout, which previous artifact will be restored, and whether configuration changed with the release. Preserve logs and traces from the unsuccessful version so the rollback does not erase the evidence needed to fix it.

Finish by updating developer setup, CI images, runtime servicing, and the deployment runbook. The migration is complete when the whole delivery path consistently produces and operates the new artifact. The reward is a supported platform with understood behavior, plus a repeatable process that makes the next upgrade less surprising.
