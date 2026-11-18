---
title: 'Native AOT for a small API: choose the deployment model first'
slug: native-aot-practical-dotnet-api
date: '2026-06-16'
updated: '2026-11-18'
description: 'Evaluate Native AOT with an explicit JSON contract, supported dependencies, publish-time analysis, and measurements of the actual deployed executable.'
category: 'C# & .NET'
tags: ['Native AOT', 'ASP.NET Core', 'Deployment']
draft: false
featured: false
cover: /images/blog/native-aot-practical-dotnet-api-photo.webp
coverSmall: /images/blog/native-aot-practical-dotnet-api-photo-768.webp
coverAlt: "A computer processor seated in a motherboard socket beside rows of capacitors"
coverFocus: 50
coverCredit: {"author":"Roman Spiridonov","source":"https://unsplash.com/photos/gray-and-green-computer-processor-FemeYrbdMWE","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}
order: 9
diagram:
  kind: flow
  title: 'AOT moves decisions into the publish step'
  steps: ['Known types', 'Generated metadata', 'Trim analysis', 'Native publish', 'Artifact tests']
  caption: 'Warnings return to dependency or code review. Passing managed tests alone does not exercise the native executable.'
---

Native AOT changes when an application becomes machine code and how much its runtime can discover dynamically. That can be valuable for small services with strict startup or memory constraints. It can also expose assumptions hidden inside serializers, dependency libraries, or plugin systems.

The useful first question is therefore not “How do I turn on AOT?” It is “Does this application's deployment model benefit enough to justify its constraints?” This article targets ASP.NET Core on .NET 10 LTS, with the same design principles applying to .NET 11. Use the latest serviced .NET 10 SDK and runtime/compiler packs when building; the example intentionally does not pin an old patch. It makes no benchmark claim about a particular production workload.

## Pick a workload with a clear boundary

A small API with known request and response types is a good evaluation candidate. A system that discovers arbitrary assemblies and types at runtime needs much closer analysis. List the application's framework features and libraries before changing publish settings.

[The Native AOT deployment overview](https://learn.microsoft.com/en-us/dotnet/core/deploying/native-aot/) describes a self-contained native executable targeting a particular runtime environment. It does not require an installed .NET runtime on the destination, but that does not mean the executable is independent of operating-system libraries, architecture, or deployment prerequisites.

Review [ASP.NET Core's AOT compatibility guidance](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/native-aot) for the framework version you actually target. Do not assume compatibility because one Minimal API example publishes successfully. Authentication packages, serialization, database access, and third-party middleware each contribute code to the deployed application.

## Make the JSON surface explicit

Create an empty web project targeting `net10.0`. The main project needs no additional package for the following example. Add `PublishAot` to the project file so analysis is enabled as part of ordinary development, not only by a special release command.

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <PublishAot>true</PublishAot>
  </PropertyGroup>
</Project>
```

Replace `Program.cs` with this complete small API. It uses a slim host and source-generated JSON metadata for its two response shapes.

```csharp
using System.Text.Json.Serialization;

var builder = WebApplication.CreateSlimBuilder(args);
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.TypeInfoResolverChain.Insert(
        0, ApiJsonContext.Default));

var app = builder.Build();

app.MapGet("/status", () =>
    TypedResults.Ok(new StatusDto("ready", DateTimeOffset.UtcNow)));

app.MapGet("/products", () =>
    TypedResults.Ok(new ProductDto[]
    {
        new(101, "Workshop lamp"),
        new(102, "Measuring tape")
    }));

app.Run();

public sealed record StatusDto(string State, DateTimeOffset CheckedAt);
public sealed record ProductDto(int Id, string Name);

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(StatusDto))]
[JsonSerializable(typeof(ProductDto[]))]
internal partial class ApiJsonContext : JsonSerializerContext { }
```

The products are fixed demonstration data. Replace them with a compatible data-access layer when evaluating a real service. Keep the response DTO boundary explicit even if the underlying domain model is richer; serializing an arbitrary object graph can make the set of required types difficult to reason about.

[The System.Text.Json source-generation guide](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/source-generation) explains how metadata is generated and registered. Notice that the collection response is declared as an array type in the context. When an endpoint adds another concrete shape, review the serialization context as part of that change.

## Treat publish warnings as design feedback

Trimming and AOT analysis look for code patterns that cannot be proven safe under the deployment model. A warning is information about a possible runtime failure, not a cosmetic inconvenience to suppress until the build turns green.

First identify whether the warning comes from your code or a dependency. Replace unnecessary dynamic discovery with explicit registration where that fits the design. If reflection is required over known types, use precise annotations supported by the framework. If a library fundamentally requires runtime code generation, choose another implementation or retain a managed deployment for that application.

The [trim-warning guidance](https://learn.microsoft.com/en-us/dotnet/core/deploying/trimming/fixing-warnings) explains the distinction between analyzable requirements and incompatible behavior. A suppression should have a narrow scope and a documented reason backed by tests. It cannot manufacture code that the native artifact does not contain.

![Known application types proceeding through generated metadata and analysis into a native artifact that is tested directly](/images/diagrams/native-aot-practical-dotnet-api.svg)

## Publish on a compatible build environment

The native compiler needs the platform toolchain described in the deployment documentation. For a Linux x64 target, run the publish on a suitable Linux build environment with its required native tools installed:

```bash
dotnet publish --configuration Release --runtime linux-x64
```

For Windows x64, use `win-x64` and the documented Windows C++ toolchain. Do not assume changing the runtime identifier on any host produces every other platform's native binary. Treat the build operating system, architecture, SDK, and native compiler as part of the release configuration.

Copy the published output into the intended runtime image or host and launch that executable directly. Exercise the status and products endpoints there. Also test configuration loading, certificate trust, outbound connections, globalization, and file permissions when those are part of the real application.

## Compare the dimensions that matter to the service

Measure cold startup, steady-state latency, throughput, memory, artifact size, and build duration separately. A service that starts once and handles sustained CPU-heavy traffic has different priorities from one that scales from zero frequently. A smaller artifact is not automatically a faster service for every request pattern.

Use equivalent application behavior, hardware, resource limits, and traffic for the managed and native comparisons. Run enough repetitions to see variability. Record how readiness is defined: process creation, listening socket, and successful dependency initialization are different milestones.

Include operational costs in the decision. Native builds may take longer, and debugging or profiling workflows may differ from the team's current managed process. Confirm that production diagnostics still answer the questions the team needs during an incident.

## Keep the exit criteria explicit

A successful evaluation has three forms of evidence: all required features are compatible, the published native artifact passes meaningful behavior tests, and measurements show a benefit relevant to the service. If one of those is missing, it is reasonable to continue with a conventional .NET deployment.

Native AOT is most useful when it supports a clear operating requirement. Keep the application contract small, handle analysis warnings honestly, and test the binary that will actually run. Those habits make the deployment decision more durable than a headline about startup speed.
