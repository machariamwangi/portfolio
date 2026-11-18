---
title: 'Minimal APIs with validation errors clients can actually use'
slug: minimal-api-validation-problem-details
date: '2026-08-04'
updated: '2026-11-18'
description: 'Build ASP.NET Core Minimal APIs that separate binding, validation, business conflicts, and unexpected failures using predictable problem details.'
category: 'C# & .NET'
tags: ['ASP.NET Core', 'APIs', 'Validation']
draft: false
featured: false
cover: /images/blog/minimal-api-validation-problem-details-photo.webp
coverSmall: /images/blog/minimal-api-validation-problem-details-photo-768.webp
coverAlt: "A row of glass and stainless steel ticket gates inside an orange-walled station"
coverFocus: 55
coverCredit: {"author":"Max Titov","source":"https://unsplash.com/photos/stainless-steel-french-refrigerator-in-room-ZRRvF1t1zPE","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}
order: 4
diagram:
  kind: flow
  title: 'Reject an invalid request at the right boundary'
  steps: ['Bind JSON', 'Validate shape', 'Apply business rule', 'Return result']
  caption: 'Binding and validation failures leave before business work; conflicts and unexpected exceptions have distinct response semantics.'
---

A useful API error gives the caller a next step. A form needs to know which field to correct. A background integration needs to know whether a conflict requires a fresh read. An operator needs a trace identifier that connects the public response to internal diagnostics.

Returning a different anonymous object from every failure branch makes those tasks harder. The solution is a small, consistent response contract and a clear separation between request shape, business rules, and unexpected failures. The examples target ASP.NET Core 10 on .NET 10 LTS; the same fundamental approach applies to ASP.NET Core 11.

## Name the boundary that rejected the request

Binding converts HTTP input into application parameters. Invalid JSON, a missing required body, or an unparseable value can prevent the endpoint handler from running. Validation happens after a model can be constructed and asks whether its values satisfy the declared rules. The [Minimal API binding guide](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis/parameter-binding?view=aspnetcore-11.0) documents how binding sources are selected.

A business conflict is different again. An order with a valid positive quantity can still exceed current stock. Calling that a malformed JSON request obscures what the client should do next. Choose status codes and stable error titles based on the actual failure, rather than mapping every unsuccessful operation to 500.

Unexpected exceptions belong in a central error path. A database outage should not expose a connection string or a stack trace to the browser. Internal logs can contain the necessary diagnostic context under the application's data-handling policy; the public response should remain deliberately limited.

## Register validation and problem details

Create an empty ASP.NET Core web project targeting `net10.0`. The validation APIs are supplied by `Microsoft.Extensions.Validation`; if your framework already supplies them, an explicit package reference is unnecessary. Otherwise, reference a current stable 10.0.x package and commit the resolved version. The following `Program.cs` uses data annotations and the built-in problem-details service. It is a small quote-checking demonstration, not an inventory reservation system.

```csharp
using System.ComponentModel.DataAnnotations;
using System.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddValidation();
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        context.ProblemDetails.Extensions["traceId"] =
            Activity.Current?.Id ?? context.HttpContext.TraceIdentifier;
    };
});

var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();

app.MapPost("/quote-checks", (QuoteRequest request) =>
{
    const int demonstrationStock = 40;
    if (request.Quantity > demonstrationStock)
    {
        return Results.Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: "Requested quantity is unavailable",
            detail: "Refresh availability before requesting another quote.");
    }

    return Results.Ok(new
    {
        request.Sku,
        request.Quantity,
        Message = "Quantity is within the demonstration stock limit."
    });
});

app.Run();

public sealed class QuoteRequest
{
    [Required, StringLength(64, MinimumLength = 1)]
    public string Sku { get; init; } = "";

    [Range(1, 1000)]
    public int Quantity { get; init; }
}
```

`AddValidation` enables automatic validation for supported Minimal API parameters. The generator must discover the relevant types; models defined in another assembly need the documented registration approach. Attributes on a model are not sufficient evidence that validation is actually running. [The validation documentation](https://learn.microsoft.com/en-us/aspnet/core/validation/overview) explains discovery, supported scenarios, and limitations.

The stock number is deliberately fixed so the example isolates response behavior. In a real ordering service, reading availability and creating a reservation require concurrency control. Validation cannot make two separate database operations atomic.

![Request binding followed by validation and a business decision before the response is created](/images/diagrams/minimal-api-validation-problem-details.svg)

## Keep an error contract small and stable

Problem details provides a common structure for failures. Use its status, title, detail, and extensions intentionally. A trace identifier is useful because support can locate internal evidence without asking the caller to reproduce an intermittent failure. Treat it as a correlation value, not an authorization token.

Clients should not branch on the exact wording of a human-readable sentence. If a workflow needs machine-readable distinctions, define a documented type URI or stable extension code. Keep that code separate from translated display text. An application may change wording to improve clarity without changing the meaning of the failure.

The framework's [API error-handling guidance](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/error-handling-api) covers the problem-details service and middleware. Middleware does not magically normalize every custom response you have already written. Review explicit `BadRequest` or `Json` results elsewhere in the application so they do not undermine the contract.

The default writer also participates in content negotiation. Test the media types your actual clients send. An API consumed by a browser, mobile app, and batch process can receive different `Accept` headers even when all three use the same URL.

## Test rejected input through HTTP

Exercise at least four paths: malformed JSON, a valid model with invalid values, a valid request that conflicts with a business rule, and a valid successful request. Confirm the expected status and content type. For validation errors, assert the relevant field is identified; avoid snapshotting every incidental formatting detail.

For the demonstration, an empty SKU and quantity zero should fail before the handler's stock check. Quantity fifty should pass the shape checks and produce the business conflict. Quantity two should succeed. Those cases prove different boundaries, even though a superficial test might describe all of them as input validation.

Add a deliberate exception in a test-only dependency and run the host with production-style error handling. Check that the response does not contain stack traces or infrastructure secrets. The [general error-handling guide](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/error-handling) explains why developer exception pages belong only in development.

## Keep validation separate from authorization

A request can be perfectly shaped and still unauthorized. Do not infer permission from a supplied tenant ID, account ID, or hidden form field. Resolve the caller's identity and apply resource authorization where the operation is performed. Validation answers whether data meets a rule; authorization answers whether this caller may use it here.

Similarly, decide whether unknown JSON properties should be ignored or rejected. Automatic validation does not automatically enforce that policy. Strict rejection can catch misspellings, while tolerant readers can make some client evolutions easier. Choose based on the API's compatibility contract and test the decision.

The final result should be boring in the best sense: every failure has a predictable shape, every status communicates a meaningful category, and clients can recover without parsing prose. Minimal endpoints remain small because the surrounding contract does the repetitive work consistently.
