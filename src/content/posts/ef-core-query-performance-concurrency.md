---
title: 'EF Core: make reads smaller and writes harder to lose'
slug: ef-core-query-performance-concurrency
date: '2025-11-25'
updated: '2026-11-18'
description: 'Combine EF Core projections and keyset pagination with explicit optimistic concurrency so a fast inventory screen also preserves user edits.'
category: 'C# & .NET'
tags: ['EF Core', 'Databases', 'Performance']
draft: false
featured: false
cover: /images/blog/ef-core-query-performance-concurrency-photo.webp
coverSmall: /images/blog/ef-core-query-performance-concurrency-photo-768.webp
coverAlt: "An open filing cabinet drawer containing rows of paper index cards"
coverFocus: 50
coverCredit: {"author":"Maksym Kaharlytskyi","source":"https://unsplash.com/photos/file-cabinet-Q9y3LRuuxmg","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}
order: 5
diagram:
  kind: flow
  title: 'A read token protects the later write'
  steps: ['Read row and version', 'User edits', 'Conditional update', 'Save or conflict']
  caption: 'The update compares the original version. A conflict returns to a fresh read and an explicit user or domain decision.'
---

A database screen has two responsibilities that are easy to optimize separately: load quickly and save correctly. A lean query improves the first experience. A concurrency token protects the second when two people edit the same record. Neither replaces the other.

This walkthrough targets EF Core 10 with the SQL Server provider on .NET 10 LTS. The patterns also apply to EF Core 11, but provider-specific details still matter. In particular, the `rowversion` behavior used below is a SQL Server feature; do not assume another database generates the same token automatically.

## Start with the screen's actual data contract

Suppose an inventory table displays a product identifier, SKU, available quantity, and an edit action. Fetching a full product aggregate with descriptions, images, supplier records, and historical movements is unnecessary for that view. Define a row DTO that describes what the screen needs.

The following model and query can live in a class library with `Microsoft.EntityFrameworkCore.SqlServer` on the stable 10.0.x line. Supply `StockDb` through normal application configuration; connection credentials do not belong in source code.

```csharp
using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

public sealed class StockItem
{
    public int Id { get; set; }
    public Guid TenantId { get; set; }
    public string Sku { get; set; } = "";
    public int Available { get; set; }
    [Timestamp] public byte[] Version { get; set; } = [];
}

public sealed class StockDb(DbContextOptions<StockDb> options)
    : DbContext(options)
{
    public DbSet<StockItem> Items => Set<StockItem>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<StockItem>()
            .HasIndex(item => new { item.TenantId, item.Id });
    }
}

public sealed record StockRow(int Id, string Sku, int Available, byte[] Version);

public static class StockQueries
{
    public static Task<List<StockRow>> NextPageAsync(
        StockDb db, Guid tenantId, int afterId, CancellationToken token) =>
        db.Items.AsNoTracking()
            .Where(item => item.TenantId == tenantId && item.Id > afterId)
            .OrderBy(item => item.Id)
            .Select(item => new StockRow(
                item.Id, item.Sku, item.Available, item.Version))
            .Take(50)
            .ToListAsync(token);
}
```

The projection expresses a small result shape. The fixed page limit bounds the response. The tenant predicate belongs to the query itself, rather than being applied after records are loaded. In a real endpoint, obtain the tenant from an authorized application context, not blindly from a client-supplied value.

[EF Core's efficient-querying guide](https://learn.microsoft.com/en-us/ef/core/performance/efficient-querying) explains projection, indexing, and related-data pitfalls. Use database query plans to decide whether an index helps. An index is a maintained structure with write and storage costs, so adding one to every property is not a performance strategy.

## Choose pagination for the interaction

The example uses the last seen identifier as a cursor. That fits a next-page interaction and avoids asking the database to skip an ever-growing number of earlier rows. It does not provide direct navigation to arbitrary page numbers.

Order by a unique sequence. If a screen sorts by creation date, include a unique tie-breaker such as the identifier, and carry both values in the cursor. Otherwise, records with identical timestamps can move unpredictably between pages. [The pagination documentation](https://learn.microsoft.com/en-us/ef/core/querying/pagination) covers this distinction and its query shapes.

Pagination does not create a snapshot across all page requests. Rows may be inserted, removed, or edited between requests. Decide what consistency the product needs. A browsing interface may accept a changing catalogue; an export used for reconciliation may require a separately defined snapshot or cutoff.

## Send the original version back with an edit

Reading the version is only half the contract. The edit request must return the token associated with what the user actually saw. If the server reloads the newest token and then saves the client's stale values, it can accidentally defeat the protection.

Add this command implementation alongside the earlier types. The expected version comes from the edit request, usually encoded as Base64 in JSON or represented through an HTTP precondition design. Validate that input before calling the method.

```csharp
using Microsoft.EntityFrameworkCore;

public enum StockUpdate { Updated, Missing, Conflict }

public static class StockCommands
{
    public static async Task<StockUpdate> SetAvailableAsync(
        StockDb db, Guid tenantId, int id, int available,
        byte[] expectedVersion, CancellationToken token)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(available);
        var item = await db.Items.SingleOrDefaultAsync(
            row => row.TenantId == tenantId && row.Id == id, token);
        if (item is null) return StockUpdate.Missing;

        db.Entry(item).Property(row => row.Version).OriginalValue = expectedVersion;
        item.Available = available;
        db.Entry(item).Property(row => row.Available).IsModified = true;

        try
        {
            await db.SaveChangesAsync(token);
            return StockUpdate.Updated;
        }
        catch (DbUpdateConcurrencyException)
        {
            return StockUpdate.Conflict;
        }
    }
}
```

With a configured concurrency token, EF includes the original version in the update condition and reports a conflict when the expected row is no longer matched. [The concurrency guide](https://learn.microsoft.com/en-us/ef/core/saving/concurrency) explains this behavior and resolution options. After the conflict in this request, dispose the request's context; do not keep reusing its stale tracked state without an explicit recovery policy.

Marking the quantity as modified forces a conditional update even when the submitted number happens to equal the freshly loaded value. Without that line, change tracking could see no changed property and skip the update entirely, so the stale token would never be checked. This method promises to evaluate the supplied version, not merely to write a different number. That small distinction is worth a dedicated test with an unchanged quantity and an outdated version.

![A version token travelling from the initial inventory read into a conditional update](/images/diagrams/ef-core-query-performance-concurrency.svg)

## Decide what a conflict means to the person editing

Returning a conflict is the beginning of a product decision. Show the newly stored value and let the user reapply an intended change, or define a domain-specific merge. Silently retrying an absolute stock count can overwrite someone else's valid correction.

Some operations deserve a different model. “Set stock to twelve” and “receive twelve units” are different commands. The latter may be better represented as a durable movement with an idempotent operation identifier. A concurrency token does not remove the need to model that distinction.

Keep each `DbContext` short-lived and confined to one unit of work. Do not run parallel queries on the same instance to make a screen seem faster. [The context lifetime guidance](https://learn.microsoft.com/en-us/ef/core/dbcontext-configuration/) explicitly documents its lack of thread safety.

## Verify performance and correctness together

Measure query duration, rows read, transferred columns, and command count using representative data. Look for accidental lazy-loading loops before introducing compiled queries or caches. A cache can conceal an expensive query during a demonstration while adding invalidation problems in production.

Test concurrency with two separate contexts reading the same row. Save one edit, then attempt the second with its original token and assert a conflict. Run that test against SQL Server because an in-memory substitute does not reproduce the database-generated rowversion behavior.

Finally, test tenant boundaries and pagination ties as deliberately as the happy path. A fast query that crosses an authorization boundary or a successful save that loses another user's work is not an optimization. The useful target is a screen that moves only the required data and treats competing edits as an explicit, recoverable event.
