---
title: Production operations that turn incidents into better systems
slug: production-operations-that-close-the-loop
date: '2022-10-13'
updated: '2026-11-18'
description: Build an operating routine around user-facing SLOs, useful telemetry, actionable alerts, incident roles, tested runbooks, and follow-through.
category: DevOps & Jira
tags: [DevOps, SRE, Observability, Incident response, Reliability]
draft: false
featured: false
cover: /images/blog/production-operations-that-close-the-loop-photo.webp
coverSmall: /images/blog/production-operations-that-close-the-loop-photo-768.webp
coverAlt: "A lighthouse connected to the Maine coast by a footbridge in warm evening light."
coverFocus: 50
coverCredit: {"author":"Donald Giannatti","source":"https://unsplash.com/photos/lighthouse-with-bridge-near-the-ocean-during-day-h62o0qzymjg","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}
order: 18
diagram:
  kind: cycle
  title: Reliability improves through a feedback loop
  steps: [Define success, Observe, Mitigate, Verify, Improve]
  caption: Follow-up work changes the service and its operating practice before the next incident.
---

Deployment is the beginning of an operating responsibility. Someone must notice when the service stops helping users, decide what to do, and verify that the recovery actually worked. A dashboard without ownership leaves the most difficult decisions until the worst possible moment.

Use a fictional checkout service as a running example. It accepts an order, contacts a payment provider, and queues a receipt. The operating goal is not merely to keep its containers running. Customers must know whether their order succeeded, and the business must avoid losing or duplicating it.

The following routine is small enough for a compact team to start with. Larger teams can distribute the responsibilities while retaining the same evidence and decision points.

![Reliability cycle connecting success criteria, observation, mitigation, verification, and improvement](/images/diagrams/production-operations-that-close-the-loop.svg)

## Define what a successful service looks like

Choose a user journey and define its service-level indicator, or SLI. For checkout, one indicator could be the proportion of eligible order submissions that return a valid, unambiguous outcome within an agreed threshold. Write down what counts as an eligible request, a good result, a duplicate, and an expected rejection.

Then set a service-level objective, or SLO, over a stated window. An illustrative request-success target of 99.9% permits 0.1% bad eligible events. At one million eligible requests, that is a budget of one thousand bad events. This event-based calculation is not automatically equivalent to a fixed number of downtime minutes.

Start with a target informed by user needs and current behavior. Add a separate latency objective if success alone would hide an unusably slow service. Make the owner and measurement source explicit. [Google's SLO workbook explains how objectives support reliability decisions](https://sre.google/workbook/implementing-slos/).

The useful discussion is what happens when reliability deteriorates: who can delay a risky rollout, which repair work takes priority, and who communicates the tradeoff. Agree that policy while the service is healthy.

## Collect evidence that connects symptoms to causes

Track request volume, failures, latency, and resource pressure. Look at distributions and slow tails, not just averages. Separate successful and failed request latency: a fast failure can make a blended average appear healthier.

Metrics answer whether a pattern is changing. Structured logs explain individual events. Traces can reveal where a request spent its time across dependencies. Give them consistent service names, deployment identifiers, and correlation identifiers so a responder can move between those views. Do not put payment details or access tokens into diagnostic fields.

Include dependency and queue behavior. A healthy API response can conceal a growing receipt backlog, while an unavailable payment dependency can cause confusing retries. Instrument the actual completion boundary rather than counting every accepted request as a successful order. [Google's monitoring chapter describes user-visible signals and monitoring tradeoffs](https://sre.google/sre-book/monitoring-distributed-systems/).

Add deployment annotations to the main operating view. During an incident, “errors increased after this rollout” is a hypothesis to investigate, not proof of causation. It is still much more useful than trying to reconstruct release timing from several chat channels.

## Turn alerts into a clear action

Page someone when timely human action is needed. Send slower-moving capacity or maintenance concerns to a queue with an owner. Every page should identify the affected service, the user impact being measured, and the first useful investigation link.

Error-budget burn rate makes the relationship to an SLO explicit:

```text
allowed_bad_fraction = 1 - target
observed_bad_fraction = bad_events / eligible_events
burn_rate = observed_bad_fraction / allowed_bad_fraction

Example: 0.01 / 0.001 = 10 times the sustainable rate
```

Evaluate suitable long and short windows together, and define how missing or very low traffic is handled. A zero denominator is not evidence that the service is healthy. Thresholds must fit traffic and response needs; copying another service's numbers does not establish that fit. [Google's alerting chapter develops multiwindow burn-rate alerts](https://sre.google/workbook/alerting-on-slos/).

Test the notification path. A correct query that pages a former employee is an operational failure. Confirm escalation, acknowledgment, backup coverage, and the route for reporting a broken alert.

## Write a runbook around decisions

A runbook should help a tired responder choose the next safe action. Put it beside the alert and keep the first screen short. For the checkout example, use a structure such as:

```yaml
service: checkout
owner: commerce-on-call
symptom: elevated ambiguous order outcomes
first_checks:
  - compare failures by deployment and dependency
  - inspect payment latency and retry volume
  - verify whether orders are committed before retrying
mitigations:
  - pause the latest rollout if evidence points to it
  - disable the affected optional path when safe
verification:
  - confirm customer outcomes and queue recovery
  - reconcile potentially duplicated or incomplete orders
```

This is an illustrative outline, not a production-ready runbook. The real document needs exact dashboards, permissions, approved commands, expected output, escalation contacts, and stop conditions.

For each mitigation, state its limits. Rolling application code back may be unsafe after an incompatible database change. Retrying payments may duplicate an action unless idempotency is enforced. A runbook earns trust when these decisions are explicit and rehearsed.

## Organize the response before everyone investigates

Declare an incident when impact or coordination needs justify it. Name a coordinator, a technical lead, and a communications owner. In a small incident, one person may hold multiple roles, but say so. During a handover, explicitly transfer responsibility.

Create one incident record and one agreed coordination channel. Capture the impact, start time, known facts, hypotheses, actions, and next update time. Use timestamps with a stated timezone. Assign investigations so several people do not unknowingly change the same system.

Prefer a mitigation that restores acceptable service while preserving evidence. Keep speculative root-cause claims separate from observations. A useful update says, “Order submissions are failing for a subset of users; we have paused the rollout and are checking recovery,” rather than promising an unverified fix. [Google's incident-response guidance emphasizes coordination and mitigation](https://sre.google/workbook/incident-response/).

Recovery needs more than a green process-health check. Confirm real user outcomes, inspect any delayed work, and decide how to handle transactions affected during the incident. Keep monitoring through an agreed observation period before closing the response.

## Convert the incident into owned improvements

Write the postmortem while the evidence is available. Include impact, detection, timeline, contributing conditions, what helped, and what delayed recovery. Explain why the decisions made sense with the information available, then identify how the system can make the next decision easier.

Avoid an action item such as “be more careful.” Prefer a concrete change: test the rollback against the current schema, add an idempotency check, or repair an alert that missed partial failure. Give each item an owner, a priority, and a verification condition. [Google's postmortem guidance explains the purpose of a blameless review](https://sre.google/sre-book/postmortem-culture/).

Link those actions to the delivery backlog and review whether they were completed. A small monthly exercise can then rehearse the revised runbook using a safe test environment or a tabletop scenario. The exercise should reveal missing access, unclear ownership, and misleading signals before the next customer does.
