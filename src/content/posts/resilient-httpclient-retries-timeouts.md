---
title: 'HttpClient retries need a budget and a reason'
slug: resilient-httpclient-retries-timeouts
date: '2026-04-28'
updated: '2026-11-18'
description: 'Configure .NET HTTP resilience with bounded retries, separate attempt and total timeouts, safe method policies, and useful failure tests.'
category: 'C# & .NET'
tags: ['HttpClient', 'Resilience', 'Distributed systems']
draft: false
featured: false
cover: /images/blog/resilient-httpclient-retries-timeouts-photo.webp
coverSmall: /images/blog/resilient-httpclient-retries-timeouts-photo-768.webp
coverAlt: "Black cables connected across the back of a rack of server equipment"
coverFocus: 50
coverCredit: {"author":"Kvistholt Photography","source":"https://unsplash.com/photos/photo-of-computer-cables-oZPwn40zCK4","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}
order: 6
diagram:
  kind: flow
  title: 'Retries spend one shared request budget'
  steps: ['Caller deadline', 'Total budget', 'HTTP attempt', 'Retry decision', 'Result or failure']
  caption: 'A transient read failure can return to another attempt after backoff; unsafe methods do not retry under this configuration.'
---

A retry can rescue a request interrupted by a temporary network problem. It can also duplicate an action, multiply traffic to an overloaded service, and keep a caller waiting long after the result is useful. Reliability comes from defining which failures are safe to repeat and how much time the whole interaction may consume.

This example targets .NET 10 LTS with `Microsoft.Extensions.Http.Resilience` on the stable 10.0.x line. The APIs are also available in .NET 11. The client reads catalogue information; it is intentionally not a payment or order-creation client.

## Keep connection management separate from retry policy

An `HttpClient` is more than a convenient wrapper around a socket. Its handler manages connection pools, and connection reuse affects DNS refresh and resource consumption. Creating a new manually owned client and handler for every application request can produce unnecessary connections.

Microsoft recommends either appropriately configured long-lived clients or short-lived clients created through `IHttpClientFactory`. [The HttpClient guidelines](https://learn.microsoft.com/en-us/dotnet/fundamentals/networking/http/httpclient-guidelines) explain the lifetime tradeoffs. This article uses a typed factory client because it gives a named dependency a clear configuration boundary.

That boundary should represent one logical upstream service. Avoid a universal client with mutable base addresses, authentication headers, and unrelated retry rules. It becomes difficult to tell which policy a request will actually use, especially when different upstreams have different latency or security expectations.

## Define both attempt and operation timeouts

Use an empty ASP.NET Core project targeting `net10.0`, add `Microsoft.Extensions.Http.Resilience`, and place the following in `Program.cs`. Set `Catalog__BaseUrl` through application configuration to the trusted catalogue service. The example requires that service to expose `GET /products/{id}` with the shown JSON shape.

```csharp
using System.Net.Http.Json;
using Microsoft.Extensions.Http.Resilience;

var builder = WebApplication.CreateBuilder(args);
var catalogUrl = new Uri(builder.Configuration["Catalog:BaseUrl"]
    ?? throw new InvalidOperationException("Configure Catalog:BaseUrl."));

builder.Services.AddHttpClient<CatalogClient>(client =>
{
    client.BaseAddress = catalogUrl;
    client.Timeout = Timeout.InfiniteTimeSpan;
}).AddStandardResilienceHandler(options =>
{
    options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(8);
    options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(2);
    options.Retry.MaxRetryAttempts = 2;
    options.Retry.Delay = TimeSpan.FromMilliseconds(200);
    options.Retry.UseJitter = true;
    options.Retry.DisableForUnsafeHttpMethods();
});

var app = builder.Build();
app.MapGet("/catalog/{id:int}", async (
    int id, CatalogClient catalog, CancellationToken token) =>
    Results.Ok(await catalog.GetAsync(id, token)));
app.Run();

public sealed class CatalogClient(HttpClient http)
{
    public async Task<ProductDto> GetAsync(int id, CancellationToken token)
    {
        using var operation = CancellationTokenSource.CreateLinkedTokenSource(token);
        operation.CancelAfter(TimeSpan.FromSeconds(10));
        using var response = await http.GetAsync($"products/{id}", operation.Token);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<ProductDto>(operation.Token)
            ?? throw new InvalidDataException("The catalogue returned an empty body.");
    }
}

public sealed record ProductDto(int Id, string Name);
```

The eight-second total budget and two-second attempt limit are illustrative. Choose them from the caller's latency budget and measured upstream behavior. Two retries permit up to three attempts, but the total budget can end the operation earlier. Disabling `HttpClient.Timeout` here avoids a second, independent timeout racing the resilience pipeline; the caller token still provides an outer cancellation boundary.

The [HTTP resilience documentation](https://learn.microsoft.com/en-us/dotnet/core/resilience/http-resilience) describes the standard pipeline, retry conditions, and method exclusions. Do not stack several standard handlers and assume their effects add cleanly. Layered retries can multiply attempts in ways that are difficult to recognize from a single service's logs.

![A request spending its total budget across attempts and retry decisions](/images/diagrams/resilient-httpclient-retries-timeouts.svg)

## Repetition must be safe for the operation

The sample disables retries for unsafe HTTP methods. That is a conservative starting point, not a proof that every GET endpoint is harmless or every PUT must never retry. Actual operation semantics matter. A badly designed GET that triggers a side effect remains dangerous even though its method name suggests a read.

For a state-changing operation, an idempotency contract can make repetition safer. The caller supplies a stable operation identifier, and the server durably associates it with the original result. A repeated request must agree with the original payload and return the appropriate existing outcome. Merely adding an `Idempotency-Key` header does nothing unless the receiving service implements that contract.

Distinguish “the server rejected the request” from “the client did not receive the response.” A timeout after a committed transaction leaves the outcome uncertain. Retrying immediately without an operation identifier can create a second transaction. The right recovery may be a status lookup rather than another write.

## Know what the handler does not protect

The resilience handler operates around the HTTP send pipeline. With this default `GetAsync` completion mode, response-body buffering and subsequent JSON parsing happen outside that handler's budget. A server could send headers quickly and then stall the body. The [HttpClient implementation](https://raw.githubusercontent.com/dotnet/runtime/v10.0.15/src/libraries/System.Net.Http/src/System/Net/Http/HttpClient.cs) shows buffering after the handler chain returns.

The linked ten-second deadline in `GetAsync` covers sending, buffering, and parsing, while the caller can still cancel sooner. The two-second difference from the handler budget is illustrative headroom, not a universal formula. Apply a response size limit appropriate to the upstream contract. An endpoint returning unbounded data can consume memory even when every network attempt completes quickly.

Do not keep a typed client captured indefinitely in a singleton and expect the factory's intended client lifecycle to remain effective. [The factory documentation](https://learn.microsoft.com/en-us/dotnet/core/extensions/httpclient-factory) explains lifetimes and handler pooling. Cookie-dependent workflows also need special consideration because pooled handlers can share cookie containers.

## Observe attempts without confusing them with requests

Measure both logical operations and individual upstream attempts. A customer may experience one failed lookup while the dependency received three requests. Looking only at the application's request count hides the extra pressure generated by retries.

Record outcome categories such as success, exhausted retries, timeout, cancellation, and an open circuit. Avoid logging authorization headers or entire upstream response bodies. Keep dimensions bounded; a metric label containing a unique product URL can create an expensive time series for every item.

Test with a controlled HTTP handler or local test server. Make it return a transient error followed by success, then assert the expected attempt count. Verify that a POST is not repeated, that cancellation ends a delayed request, and that permanent failures are surfaced. Tests should not call a real production dependency or depend on random network failures.

Finally, decide how your API maps exhausted upstream failures into its own public contract. The demonstration leaves that application policy out so the client configuration remains visible. A production service should return a consistent error response and preserve internal diagnostics. A retry policy succeeds when it recovers temporary failures within a known budget and stops promptly when repetition no longer helps.
