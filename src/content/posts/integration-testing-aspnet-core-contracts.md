---
title: 'Integration tests that protect an ASP.NET Core API contract'
slug: integration-testing-aspnet-core-contracts
date: '2026-03-10'
updated: '2026-11-18'
description: 'Use WebApplicationFactory to test binding, validation, response contracts, and error boundaries while keeping test runners and infrastructure choices explicit.'
category: 'C# & .NET'
tags: ['Testing', 'ASP.NET Core', 'Quality']
draft: false
featured: false
cover: /images/blog/integration-testing-aspnet-core-contracts-photo.webp
coverSmall: /images/blog/integration-testing-aspnet-core-contracts-photo-768.webp
coverAlt: "An oscilloscope with connected probes and controls on an electronics workbench"
coverFocus: 40
coverCredit: {"author":"Blaz Erzetic","source":"https://unsplash.com/photos/white-audio-mixer-uf4luctGaXI","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}
order: 10
diagram:
  kind: flow
  title: 'Test through the same boundary as the client'
  steps: ['HTTP test client', 'Real middleware', 'Binding and validation', 'Application handler', 'Contract assertions']
  caption: 'Replace dependencies only where the test boundary requires it; database semantics need separate tests against the actual provider.'
---

A unit test can prove that multiplying quantity by price returns the correct number. It cannot prove that an HTTP request reaches that function with the intended values, that invalid input is rejected, or that the response uses the JSON shape a client expects. Those behaviors exist between components.

Integration tests are valuable when they protect those boundaries. This article targets ASP.NET Core 10 on .NET 10 LTS with xUnit and `WebApplicationFactory`. The same test architecture is useful on .NET 11, but the test platform and package versions should be selected explicitly rather than inferred from the runtime number.

## Define the contract before the assertion

For a small quote endpoint, decide that quantities one through one thousand are accepted, invalid quantities produce validation problem details, and successful JSON contains `quantity` and `total`. Those are externally visible behaviors. The name of an internal helper or the exact sequence of private method calls is not part of that contract.

Start with an empty web project named `QuoteApi` targeting `net10.0`. Use the `Microsoft.Extensions.Validation` APIs supplied by the framework, or add a stable 10.0.x package reference if your project requires one. This complete `Program.cs` exposes a deliberately simple calculation:

```csharp
using System.ComponentModel.DataAnnotations;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddValidation();
builder.Services.AddProblemDetails();

var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.MapPost("/quotes", (QuoteRequest request) =>
    Results.Ok(new QuoteResponse(request.Quantity, request.Quantity * 125m)));
app.Run();

public sealed class QuoteRequest
{
    [Range(1, 1000)]
    public int Quantity { get; init; }
}

public sealed record QuoteResponse(int Quantity, decimal Total);
public partial class Program { }
```

The public partial `Program` provides the entry-point type used by the test host. The example has no persistence or external dependencies, so the first tests can exercise the entire HTTP application without inventing mocks.

## Host the real application in the test

Create a separate xUnit project targeting `net10.0`, reference `QuoteApi.csproj`, and add `Microsoft.AspNetCore.Mvc.Testing` from the matching stable 10.0.x line. The normal xUnit template supplies its framework and test SDK packages; retain the versions resolved by the template in source control.

```bash
dotnet new xunit --name QuoteApi.Tests --framework net10.0
dotnet add QuoteApi.Tests/QuoteApi.Tests.csproj reference QuoteApi/QuoteApi.csproj
```

[Microsoft's xUnit tutorial](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-csharp-with-xunit) documents the test-project setup. Add the testing package before compiling the following test class:

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

public sealed class QuoteContractTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task Valid_quantity_returns_the_public_quote_shape()
    {
        using var client = factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/quotes", new { quantity = 3 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(3, body.RootElement.GetProperty("quantity").GetInt32());
        Assert.Equal(375m, body.RootElement.GetProperty("total").GetDecimal());
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(0)]
    [InlineData(1001)]
    public async Task Invalid_quantity_returns_validation_problem_details(int quantity)
    {
        using var client = factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/quotes", new { quantity });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Contains(body.RootElement.GetProperty("errors").EnumerateObject(),
            error => error.Name.EndsWith("Quantity", StringComparison.OrdinalIgnoreCase));
    }
}
```

The test crosses routing, JSON binding, validation registration, and response serialization. A test that directly called a calculation method would miss several of those failure modes. [The ASP.NET Core integration-testing guide](https://learn.microsoft.com/en-us/aspnet/core/test/integration-tests) explains the test host and customization points.

![An HTTP test request crossing real application middleware and validation before contract assertions](/images/diagrams/integration-testing-aspnet-core-contracts.svg)

## Assert meaning without freezing incidental details

The tests inspect important fields rather than comparing a complete serialized document byte for byte. Property order and diagnostic trace identifiers can change without breaking the consumer contract. Snapshot every detail only when those details are genuinely part of the interface you intend to support.

Add separate cases for malformed JSON, missing input, and unsupported content types when those requests are realistic for your clients. Test authentication and resource authorization through the HTTP boundary as well. A fake authenticated identity can be useful, but a test that bypasses authorization entirely cannot prove the endpoint enforces access.

For exception behavior, replace a dependency with one that throws and run the host in a production-like environment. Assert the public status and safe error shape. Keep the internal exception available in test output so failures are diagnosable without leaking it into the API response.

## Be precise about what a replacement dependency proves

A fake payment gateway can prove that the application handles a gateway refusal. It cannot prove the real provider accepts your signature format or endpoint URL. Give each test a clear boundary and name it accordingly.

Database behavior deserves particular care. A substitute provider may differ in string comparison, SQL translation, transactions, and concurrency tokens. Use isolated instances of the actual database provider for tests that depend on those semantics. [EF Core's testing-strategy guide](https://learn.microsoft.com/en-us/ef/core/testing/choosing-a-testing-strategy) explains why passing tests against a double are not proof of production database behavior.

Keep test data isolated. Unique records, separate databases, or a reliable reset strategy can prevent parallel tests from contaminating each other. Avoid relying on execution order. A test should explain its own setup rather than depending on a previous test leaving behind a convenient row.

Control time and nondeterministic inputs through narrow dependencies when they affect the result. A test for an expiring quote should choose its clock rather than wait several seconds and hope the scheduler cooperates. Use cancellation-aware synchronization for asynchronous behavior. Long arbitrary sleeps make failures slow to reproduce and still do not prove that the intended event occurred before the assertion.

## Keep the runner configuration visible

`dotnet test` can operate with VSTest or Microsoft.Testing.Platform. The latter became a separate mode in the .NET 10 SDK; it is not selected simply because an application targets a newer framework. Their command-line options and reporting extensions differ. [The dotnet test guidance](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-with-dotnet-test) describes these modes.

Use one deliberate configuration across local development and CI. If you move to MTP, review the framework integration, report extension, and coverage setup as a single change. Do not silently mix runner assumptions across projects and then interpret a successful command as proof that every expected test executed.

Microsoft's [MTP overview](https://learn.microsoft.com/en-us/dotnet/core/testing/microsoft-testing-platform-intro) is the starting point for that decision. For the conventional xUnit template above, run its configured test project and verify the discovered test count before adding more pipeline switches.

## Reserve a final check for the deployed artifact

The test server is an excellent application-boundary tool, but it does not exercise the real reverse proxy, container filesystem, certificate chain, or native publish output. Add a small smoke test against the actual deployable artifact where those details matter.

The result is a layered argument for correctness: focused unit tests cover domain calculations, HTTP integration tests cover the API contract, provider tests cover database semantics, and artifact checks cover deployment assumptions. Each layer earns its place by catching a different class of failure.
