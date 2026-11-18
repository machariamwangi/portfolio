---
title: 'C# 15: model business outcomes before shortening the syntax'
slug: csharp-15-modeling-business-outcomes
date: '2026-11-18'
updated: '2026-11-18'
description: 'Use stable C# 15 unions, closed hierarchies, and collection arguments to make application states explicit while keeping null behavior visible.'
category: 'C# & .NET'
tags: ['C# 15', '.NET 11', 'Domain modeling']
draft: false
featured: true
cover: /images/blog/csharp-15-modeling-business-outcomes-photo.webp
coverSmall: /images/blog/csharp-15-modeling-business-outcomes-photo-768.webp
coverAlt: "A vintage digital camera taken apart into its casing, lens mechanism, and circuit assemblies"
coverFocus: 50
coverCredit: {"author":"Barrett Ward","source":"https://unsplash.com/photos/three-assorted-electronic-components-ehbfBJAGnW8","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}
order: 2
diagram:
  kind: flow
  title: 'A lookup becomes an explicit outcome'
  steps: ['Lookup request', 'Evaluate rules', 'Found or Missing', 'Match each case', 'Client response']
  caption: 'Found and Missing are alternative cases. Handle null contents separately so a catch-all does not hide future cases.'
---

The most useful language improvement is often the one that makes an incorrect assumption harder to express. A shorter constructor is pleasant; a return type that tells every caller about a missing record can change the quality of a codebase.

C# 15 is the default language version for projects targeting `net11.0` with the .NET 11 SDK. Its released features include union types, closed hierarchies, and collection expression arguments. The memory-safety work is still a preview feature and is outside this article. Those distinctions come from [Microsoft's C# 15 overview](https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/csharp-15). The examples below target the stable language and do not require `LangVersion=preview`.

## Begin with a return value that tells the truth

Imagine a product lookup returning `Product?`. Null tells the caller that no product is available, but it does not carry the requested identifier or distinguish absence from other expected outcomes. A method returning `object` would allow richer values, at the cost of losing a useful contract.

A union groups a known set of existing case types. Here is a complete `Program.cs` for a .NET 11 console project with implicit usings enabled:

```csharp
LookupOutcome outcome = Lookup(17);
Console.WriteLine(Describe(outcome));

static LookupOutcome Lookup(int id)
{
    if (id == 17)
        return new ProductFound(id, "Workshop lamp");

    return new ProductMissing(id);
}

static string Describe(LookupOutcome outcome) => outcome switch
{
    ProductFound found => $"{found.Id}: {found.Name}",
    ProductMissing missing => $"No product with ID {missing.Id}",
    null => throw new InvalidOperationException("Uninitialized lookup outcome.")
};

public sealed record ProductFound(int Id, string Name);
public sealed record ProductMissing(int Id);
public union LookupOutcome(ProductFound, ProductMissing);
```

The domain choices are deliberate. Missing inventory is an expected outcome, so it has a case. An unavailable database is not represented as a fictional missing product. The lookup would surface that infrastructure failure through the application's error policy instead. Conflating those events can make a temporary outage look like a permanent business fact.

[The union reference](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/union) describes implicit conversions from cases and exhaustiveness checking. Apply that mechanism to a narrow boundary first. A lookup, a parsing result, or a command decision makes a better starting point than replacing every exception throughout an application.

## Leave room for the default-value trap

The explicit null arm is intentional. A generated union is represented by a struct, and default-initialized instances can contain null even when the declared cases are nonnullable. An array of unions is one way those values can enter a program without passing through a meaningful case constructor.

The [switch-expression reference](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/switch-expression) explains why a compiler may not warn about that default state. Handle it at boundaries where it can occur. Prefer a null arm over a discard arm: a general catch-all could silently consume a new business case added later.

Treat an uninitialized union as a programming error in this example, rather than inventing a default successful result. The distinction matters in diagnostics. A missing product should be a normal response; a malformed internal state should be visible to the team responsible for the code.

![Product lookup flowing into an explicit case and an exhaustive response mapping](/images/diagrams/csharp-15-modeling-business-outcomes.svg)

## Use a closed hierarchy when the relationship is inheritance

Unions are not the only way to describe a finite set. If related states belong to a model you own, a closed hierarchy can be more natural. For a local import workflow, the state types may share a common identity in the domain:

```csharp
public closed record class ImportState;
public sealed record Waiting : ImportState;
public sealed record Running(int CompletedRows) : ImportState;
public sealed record Finished(int ImportedRows) : ImportState;
public sealed record Rejected(string Reason) : ImportState;

public static class ImportLabels
{
    public static string Describe(ImportState state) => state switch
    {
        Waiting => "Waiting for a worker",
        Running run => $"Processed {run.CompletedRows} rows",
        Finished done => $"Imported {done.ImportedRows} rows",
        Rejected rejected => $"Rejected: {rejected.Reason}",
        null => throw new ArgumentNullException(nameof(state))
    };
}
```

A `closed` base restricts direct descendants to its declaring assembly. It does not automatically close every descendant. The leaves above are sealed so extension through another assembly cannot quietly broaden those leaf types. The [closed modifier documentation](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/closed) details that boundary.

This still does not enforce a state machine. Nothing in the declarations prevents application code from constructing `Finished` before any rows were imported. Transition rules belong in a service or aggregate that owns the workflow. The type hierarchy describes which states exist; domain operations determine which transitions are valid.

That separation is useful during review. Ask two different questions: can every state be represented clearly, and can every permitted transition preserve the business rules? A sophisticated type declaration should not distract from a missing rule in the operation that changes it.

## Preserve collection semantics during a refactor

C# 15 collection expression arguments make constructor choices visible alongside the collection's contents. Consider a set of import field names that should compare without case differences:

```csharp
HashSet<string> acceptedFields =
    [with(StringComparer.OrdinalIgnoreCase), "sku", "quantity", "warehouse"];

Console.WriteLine(acceptedFields.Contains("SKU")); // True
```

The comparer is the important part. Rewriting an existing case-insensitive set to a plain collection expression without preserving its comparer could change behavior while making the code look cleaner. [The collection-expression reference](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/collection-expressions) documents the new arguments syntax.

Choose ordinal comparison here because these are machine-defined field names. Do not extend that choice to every human-facing search or sorting requirement. A person's name, a localized label, and an API identifier can require different semantics even though all three are represented by strings.

## Refactor one boundary and make the compiler useful

Start with tests for the existing externally visible behavior. Replace the internal outcome representation, then update its consumers. Introduce a temporary additional case during development to see whether the compiler identifies the places you expect to change. Remove that experiment before merging; it is a check on the design, not a permanent test fixture.

Keep serialized API contracts explicit. An internal union does not automatically define the JSON shape that existing clients expect. Map internal outcomes to response DTOs and status codes unless you have intentionally designed and versioned a polymorphic wire contract.

Finally, agree on the team's warning policy. Exhaustiveness warnings are most valuable when they are visible in CI and addressed during review. Use these features to expose decisions the program already has to make. The resulting code should help a future reader understand the business outcome without reconstructing it from null checks, magic strings, or unrelated exception types.
