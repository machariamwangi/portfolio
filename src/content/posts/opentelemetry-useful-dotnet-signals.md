---
title: 'OpenTelemetry in .NET: instrument the questions you need answered'
slug: opentelemetry-useful-dotnet-signals
date: '2026-09-17'
updated: '2026-11-18'
description: 'Build useful .NET telemetry with traces, bounded metric dimensions, business operations, and an export path you can verify end to end.'
category: 'C# & .NET'
tags: ['OpenTelemetry', 'Observability', '.NET']
draft: false
featured: false
cover: /images/blog/opentelemetry-useful-dotnet-signals-photo.webp
coverSmall: /images/blog/opentelemetry-useful-dotnet-signals-photo-768.webp
coverAlt: "A metal public viewfinder overlooking Los Angeles from Griffith Observatory"
coverFocus: 73
coverCredit: {"author":"Thomas Aeschleman","source":"https://unsplash.com/photos/grey-telescope-photography-0okKTkm66zY","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}
order: 8
diagram:
  kind: flow
  title: 'Instrumentation and collection are separate responsibilities'
  steps: ['Business operation', 'Activity and meter', 'OTel provider', 'OTLP collector', 'Query and alert']
  caption: 'Creating an activity is insufficient: the provider must subscribe to its source and an exporter must deliver retained telemetry.'
---

“The API is slow” is an observation, not yet a diagnosis. You need to know which requests are affected, where their time goes, and whether the delay changes a business outcome. Telemetry is useful when it can answer those questions without requiring a new deployment every time an incident begins.

This walkthrough targets ASP.NET Core on .NET 10 LTS and uses stable OpenTelemetry .NET APIs also usable with .NET 11. It focuses on a small set of signals around a quote calculation. The aim is an understandable diagnostic path rather than the largest possible number of dashboards.

## Give each signal a job

Metrics summarize behavior over time: request rate, failure ratio, queue age, or a distribution of durations. Traces describe the path of an individual operation through components. Logs record events that need contextual detail. [Microsoft's observability overview](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/observability-with-otel) explains how these signals fit together.

Start with a question and choose the signal that can answer it. “Did latency rise after the release?” is a metric question. “Which dependency delayed this request?” is a trace question. “Why did this specific import reject a row?” may need a structured log linked to the trace.

Avoid treating every log line as a metric or every method call as a span. Extra data has collection, storage, and attention costs. A diagnostic system that produces more noise than explanations becomes difficult to use precisely when people are under pressure.

## Connect instrumentation to a provider and an exporter

Create an empty `net10.0` web project. Add current stable versions of `OpenTelemetry.Extensions.Hosting`, `OpenTelemetry.Instrumentation.AspNetCore`, `OpenTelemetry.Instrumentation.Http`, and `OpenTelemetry.Exporter.OpenTelemetryProtocol`, then commit their resolved versions. The configuration below exports traces and metrics through OTLP. Configure `OTEL_EXPORTER_OTLP_ENDPOINT` for your collector.

```csharp
using System.Diagnostics;
using System.Diagnostics.Metrics;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<QuoteTelemetry>();
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService("quote-api"))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddSource(QuoteTelemetry.Name)
        .AddOtlpExporter())
    .WithMetrics(metrics => metrics
        .AddAspNetCoreInstrumentation()
        .AddMeter(QuoteTelemetry.Name)
        .AddOtlpExporter());

var app = builder.Build();
app.MapGet("/quotes/{quantity:int}", (
    int quantity, QuoteTelemetry telemetry) =>
{
    using var activity = telemetry.Activities.StartActivity("quote.calculate");
    var watch = Stopwatch.StartNew();
    string outcome = "rejected";
    try
    {
        if (quantity is < 1 or > 1000)
            return Results.BadRequest(new { Error = "Quantity must be 1 to 1000." });

        decimal total = quantity * 125m;
        outcome = "success";
        activity?.SetTag("quote.outcome", outcome);
        return Results.Ok(new { Quantity = quantity, Total = total });
    }
    finally
    {
        telemetry.Duration.Record(watch.Elapsed.TotalSeconds,
            new KeyValuePair<string, object?>("outcome", outcome));
    }
});
app.Run();

public sealed class QuoteTelemetry : IDisposable
{
    public const string Name = "Portfolio.Quotes";
    public ActivitySource Activities { get; } = new(Name);
    private readonly Meter meter = new(Name);
    public Histogram<double> Duration { get; }

    public QuoteTelemetry() => Duration = meter.CreateHistogram<double>(
        "quote.calculation.duration", unit: "s");

    public void Dispose()
    {
        Activities.Dispose();
        meter.Dispose();
    }
}
```

The calculation is intentionally trivial so the instrumentation boundaries are visible. It does not represent a real pricing model or claim a performance result. Move the custom activity around the meaningful business operation when adapting it to a service that reads prices, checks stock, or calls another dependency.

## Name the source once and subscribe to it

The activity source name in `AddSource` matches the source that creates the activity. Without a listener, `StartActivity` can return null; the null-conditional tag assignment is therefore intentional. An activity source should be reused rather than constructed for every request.

[The tracing walkthrough](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/distributed-tracing-instrumentation-walkthroughs) describes these APIs. Keeping instrumentation on .NET's `ActivitySource` boundary also lets application code remain separate from the eventual telemetry backend. The host chooses collection and export; the operation describes what happened.

Choose stable operation names such as `quote.calculate`. Do not include a customer identifier in the span name. If an identifier is genuinely necessary for diagnostics, apply an explicit data policy and place it in an appropriate attribute or log field rather than turning every operation into a unique name.

![A business activity and metric flowing through an OpenTelemetry provider to a collector and query interface](/images/diagrams/opentelemetry-useful-dotnet-signals.svg)

## Keep metric dimensions deliberately small

The histogram uses a single outcome dimension with two values. A request ID, email address, or full URL as a metric dimension could create a new time series for each unique value. The result may be expensive and difficult to aggregate.

[The metrics instrumentation guide](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/metrics-instrumentation) explains instruments, measurements, and tags. Select histogram boundaries and aggregation in the collection configuration according to the question being asked. A calculation measured in milliseconds and a multi-minute export should not automatically share the same useful buckets.

Use metrics for rates and distributions, then traces to investigate examples. Sampling can mean a particular request has no retained trace. Design operational decisions around that reality: the absence of a trace does not prove that a request never occurred, and sampled traces are not a complete financial audit trail.

## Verify the entire path with one known request

Start the collector, send a request, and find the service name, incoming HTTP span, and custom quote activity in the backend. Check that the custom histogram appears and that an invalid quantity contributes to the rejected outcome. Then stop or misconfigure the exporter temporarily in a nonproduction environment and observe how the application behaves.

The sample exports traces and metrics, not an OpenTelemetry log pipeline. If logs are part of your diagnostic workflow, configure their provider and correlation deliberately. Do not assume installing a package automatically sends every signal to the same destination.

Protect the transport and collector as you would other operational infrastructure. Configure authentication and TLS where required, and keep exporter credentials outside source control. Do not put access tokens, raw request bodies, or personal information into telemetry simply because an attribute accepts a string.

## Make alerts reflect user-visible failure

An alert should lead to an action. A short CPU spike may need no response; sustained failures in quote creation likely do. Define a relevant window, minimum traffic, and recovery condition so a quiet service does not page someone over a single expected rejection.

Document the first query an on-call engineer should run and the next dependency to inspect. A modest set of well-named signals with a verified export path is far more useful than extensive instrumentation whose meaning is unclear. Observability earns its cost when it shortens the path from a symptom to a defensible explanation.
