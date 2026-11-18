---
title: 'Bound background work before it becomes an invisible backlog'
slug: bounded-background-jobs-dotnet-channels
date: '2024-10-08'
updated: '2026-11-18'
description: 'Use bounded .NET channels and scoped hosted services to control local background work, handle overload, and recognize when a durable queue is needed.'
category: 'C# & .NET'
tags: ['Background jobs', 'Channels', '.NET']
draft: false
featured: false
cover: /images/blog/bounded-background-jobs-dotnet-channels-photo.webp
coverSmall: /images/blog/bounded-background-jobs-dotnet-channels-photo-768.webp
coverAlt: "Workers assembling products at repeated workstations along a factory production line"
coverFocus: 70
coverCredit: {"author":"Remy Gieling","source":"https://unsplash.com/photos/people-working-at-factory-assembly-line-KP6XQIEjjPA","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}
order: 7
diagram:
  kind: flow
  title: 'Admission is a separate step from execution'
  steps: ['Job request', 'Capacity check', 'Bounded channel', 'Scoped worker', 'Write result']
  caption: 'A full channel rejects new work. Accepted in-memory jobs can still be lost if the process terminates before completion.'
---

Moving work out of an HTTP handler changes when the user waits; it does not remove the work. Without an explicit limit, a background queue can turn a short traffic spike into hours of delayed processing and growing memory use. The application still needs an admission policy, a worker lifetime, and a definition of what acceptance means.

This article targets ASP.NET Core on .NET 10 LTS using APIs also available in .NET 11. It builds an in-process queue for demonstration report files. That queue is deliberately not durable: it is appropriate only when losing pending work on restart is acceptable or another system can reconstruct it.

## Choose the queue's promise first

There are three distinct events: a request arrives, the queue accepts it, and the worker finishes it. Returning 202 after acceptance does not mean the report exists. A caller that needs completion tracking requires a separate status model with states such as queued, running, completed, and failed.

Before writing code, decide what happens when the queue is full. Waiting applies backpressure to producers, but an HTTP request cannot wait indefinitely. Rejecting promptly lets the caller decide when to try again. Dropping an item can suit some telemetry or cache-refresh scenarios, but it is a poor default for user-requested work.

The [channels documentation](https://learn.microsoft.com/en-us/dotnet/core/extensions/channels) describes bounded capacity and full-mode behavior. The example uses a bounded channel with wait semantics internally, then `TryWrite` for immediate admission decisions. This prevents the HTTP layer from accumulating a second queue of requests waiting for capacity.

## A small worker with explicit ownership

Create an empty web project targeting `net10.0`. No additional package is required for channels or hosting in this web project. Replace `Program.cs` with the following. Set `Reports__Directory` if you want a writable output directory other than the local `reports` folder.

```csharp
using System.Threading.Channels;

var builder = WebApplication.CreateBuilder(args);
string directory = Path.GetFullPath(
    builder.Configuration["Reports:Directory"] ?? "reports");

builder.Services.AddSingleton<ReportQueue>();
builder.Services.AddScoped(_ => new ReportWriter(directory));
builder.Services.AddHostedService<ReportWorker>();

var app = builder.Build();
app.MapPost("/reports", (ReportQueue queue) =>
{
    var job = new ReportJob(Guid.NewGuid());
    return queue.TryAdd(job)
        ? Results.Accepted(value: new { job.Id })
        : Results.Problem(statusCode: 503, title: "Report queue is full");
});
app.Run();

public sealed record ReportJob(Guid Id);

public sealed class ReportQueue
{
    private readonly Channel<ReportJob> channel =
        Channel.CreateBounded<ReportJob>(new BoundedChannelOptions(50)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = true,
            SingleWriter = false
        });

    public bool TryAdd(ReportJob job) => channel.Writer.TryWrite(job);
    public IAsyncEnumerable<ReportJob> ReadAsync(CancellationToken token) =>
        channel.Reader.ReadAllAsync(token);
}

public sealed class ReportWriter(string directory)
{
    public async Task WriteAsync(ReportJob job, CancellationToken token)
    {
        Directory.CreateDirectory(directory);
        string file = Path.Combine(directory, $"{job.Id:N}.txt");
        string header = $"Report {job.Id}\nGenerated {DateTimeOffset.UtcNow:O}\n";
        await File.WriteAllTextAsync(file, header, token);
    }
}

public sealed class ReportWorker(
    ReportQueue queue,
    IServiceScopeFactory scopes,
    ILogger<ReportWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var job in queue.ReadAsync(stoppingToken))
            {
                try
                {
                    await using var scope = scopes.CreateAsyncScope();
                    var writer = scope.ServiceProvider
                        .GetRequiredService<ReportWriter>();
                    await writer.WriteAsync(job, stoppingToken);
                    logger.LogInformation("Report {JobId} completed", job.Id);
                }
                catch (OperationCanceledException)
                    when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception error)
                {
                    logger.LogError(error, "Report {JobId} failed", job.Id);
                }
            }
        }
        catch (OperationCanceledException)
            when (stoppingToken.IsCancellationRequested) { }
    }
}
```

The file contains only a report header; a real report query and rendering step would replace that small writer implementation. Authentication, authorization, a completion-status endpoint, and result download handling are intentionally outside this local demonstration. Do not expose the endpoint publicly without those application policies.

## Scope dependencies to one job

The hosted worker lives for the application's lifetime, while an EF Core context or another scoped dependency should generally belong to one job. The worker creates and asynchronously disposes a scope for each accepted item. This keeps resources from one report from leaking into the next.

[Microsoft's scoped-worker guidance](https://learn.microsoft.com/en-us/dotnet/core/extensions/scoped-service) describes why a hosted service needs that explicit scope. Do not capture a request's scoped service inside a queued delegate. The request can finish and dispose the service long before the worker uses it.

Queue data instead: an identifier, a validated command payload, or a reference to a durable record. The worker should obtain fresh dependencies and load the state it needs at execution time. Also record any authorization decision that must survive the delay, and decide whether execution must revalidate it.

The per-job exception handler logs a failure and moves on; it does not retry or retain the failed item. That is an explicit limitation of this example. Adding retries requires a maximum attempt count, a delay policy, and a decision about whether later jobs can overtake the failed one. An immediate retry loop can monopolize the only consumer while every other request waits.

Use the job identifier to make repeated execution detectable. For file output, define whether an existing completed file means success, replacement, or a conflict. For a report that also sends an email, the file operation and the email have different side effects: retrying both together can send duplicate messages. Write down the completion boundary before adding automatic recovery, and keep failure information somewhere an operator or caller can actually inspect.

![A job passing through admission control into a bounded queue and a scoped worker](/images/diagrams/bounded-background-jobs-dotnet-channels.svg)

## Shutdown is a policy decision

This worker stops when the host's stopping token is cancelled. It does not drain every queued report before exiting. Its current file write can also be interrupted, leaving an incomplete output file. For a production artifact workflow, write to a temporary file and publish the completed artifact atomically where the storage system supports that operation.

The [hosted-services lifecycle documentation](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/host/hosted-services) explains startup and shutdown behavior. Graceful shutdown is an opportunity, not a guarantee: a machine failure or process kill can bypass your cleanup logic.

If acceptance must survive those failures, store the job durably before acknowledging it. A database job table or a message broker changes the design: workers need claims or leases, retries, idempotent processing, and a place for permanently failed work. An in-memory channel cannot provide those guarantees merely by increasing its capacity.

## Measure delay, not just throughput

Track queue depth, rejection count, processing duration, and the age of the oldest waiting item. A worker can complete many tiny reports while one expensive report delays everyone behind it. Queue age exposes the experience that raw throughput can hide.

Start with one consumer when ordering matters. Add parallel consumers only after deciding whether jobs can safely overlap and which resource limits should bound them. Database connections, upstream quotas, and CPU capacity remain constraints even when the queue itself is thread-safe.

Test full-capacity rejection, per-job failure isolation, and shutdown cancellation. A single failed report should not silently stop the worker, while a shutdown should not be logged as a mysterious application failure. The essential design is explicit admission, bounded work, and an honest promise to the caller about what happens after acceptance.
