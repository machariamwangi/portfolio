---
title: 'Plan the rollback before the traffic switch'
slug: blue-green-deployment-rollback
date: '2025-06-12'
updated: '2026-11-18'
description: 'A practical blue-green release recipe using Azure App Service slots, CircleCI serialization, readiness checks and a rehearsed rollback.'
category: 'Delivery & CI'
tags: ['Deployment', 'Azure', 'CircleCI', 'Reliability']
draft: false
featured: false
cover: /images/blog/blue-green-deployment-rollback-photo.webp
coverSmall: /images/blog/blue-green-deployment-rollback-photo-768.webp
coverAlt: "A forest trail divides into two paths beneath green trees."
coverFocus: 50
coverCredit: {"author":"Jens Lelie","source":"https://unsplash.com/photos/two-roads-between-trees-u0vgcIOQG08","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}
order: 14
diagram:
  kind: flow
  title: 'A traffic switch with a return path'
  steps: ['Prepare green', 'Verify readiness', 'Switch traffic', 'Observe service', 'Keep or revert']
  caption: 'The old production version remains available during observation. Revert only after confirming slot identities and data compatibility; failed preflight checks leave traffic unchanged.'
---

Zero-downtime deployment is a goal supported by several mechanisms, not a property that appears when a pipeline contains a command named `deploy`. The new application must be ready, requests must reach healthy instances, shared data must remain compatible, and the previous version must still be usable when the new one disappoints.

Blue-green deployment makes that final requirement visible. One version serves production while another is prepared separately. A traffic switch changes which version is active. This walkthrough uses Azure App Service deployment slots, with CircleCI coordinating the release. It assumes an existing application, an eligible App Service plan, an authenticated deployer and a candidate artifact that has already passed CI.

## Decide what the two environments share

Slots are live applications with separate hostnames. App Service supports them on Standard, Premium and Isolated plans. A swap can move the staged application into production while retaining the previous production application in the other slot. Microsoft's [deployment slot guide](https://learn.microsoft.com/en-us/azure/app-service/deploy-staging-slots) explains which configuration settings swap and which remain attached to a slot.

Create a small configuration inventory before automating anything. Mark production credentials and environment-specific connections deliberately. Decide whether staging uses synthetic data, a separate database or a controlled production-compatible view. Prevent an inactive slot from sending real notification emails or consuming the same scheduled work twice.

The word “inactive” describes traffic, not process execution. A staged application can still run background workers. Use explicit worker enablement or an external ownership mechanism so a release does not accidentally double invoice processing, scheduled exports or queue consumption.

## Make readiness meaningful

Implement a `/health/ready` endpoint that becomes successful only after required initialization and essential dependencies are available. Keep it cheap and side-effect free. Do not return success just because the HTTP server has bound a port.

Configure slot-swap warm-up to use that path and accept only the intended status, for example `WEBSITE_SWAP_WARMUP_PING_PATH=/health/ready` and `WEBSITE_SWAP_WARMUP_PING_STATUSES=200`. Treat warm-up and ongoing instance health monitoring as separate controls. App Service's [Health check documentation](https://learn.microsoft.com/en-us/azure/app-service/monitor-instances-health-check) describes instance removal, response requirements and replica considerations.

Readiness is still narrower than correctness. Add a synthetic user journey that exercises authentication, a representative read and a reversible write. The check should identify the release it exercised. Otherwise, a warm old instance can make a new deployment appear healthier than it is.

![A green application is prepared and verified before traffic switches, with an explicit observe-and-revert decision.](/images/diagrams/blue-green-deployment-rollback.svg)

## Serialize the entire change window

Two pipelines swapping the same pair of slots can undo each other's assumptions. Protect preparation, final verification, switching and observation as one release operation. This workflow fragment assumes `verify` and `release-slot` jobs are defined elsewhere:

```yaml
workflows:
  release:
    jobs:
      - verify
      - approve-production:
          type: approval
          requires: [verify]
          filters:
            branches:
              only: main
      - release-slot:
          requires: [approve-production]
          context: production-deploy
          serial-group: portfolio-api/production
          filters:
            branches:
              only: main
```

The `release-slot` job owns the complete window, including deployment to staging. The same serial-group name must be used by every pipeline that writes these slots. CircleCI's [serial execution guide](https://circleci.com/docs/guides/orchestrate/controlling-serial-execution-across-your-organization/) explains ordering and lock release. A failed job releases its lock, so an unresolved incident needs a separate release freeze rather than an assumption that the queue remains blocked.

An approval records a release decision; it is not a substitute for cloud authorization. Give the job permission for this application and its slots. Keep unrelated resource administration outside the deployer.

## Verify identity, then perform the swap

The following Bash fragment assumes Azure CLI and `curl` are installed and authenticated. Required environment inputs are `APP_NAME`, `RESOURCE_GROUP`, `STAGING_URL` and `EXPECTED_RELEASE`. The example application exposes `/version` as a plain-text release identifier. Replace that check if your application uses a different contract.

```bash
set -euo pipefail
: "${APP_NAME:?}" "${RESOURCE_GROUP:?}"
: "${STAGING_URL:?}" "${EXPECTED_RELEASE:?}"

ready_code=$(curl --silent --show-error --output /dev/null \
  --write-out '%{http_code}' --max-time 15 \
  "$STAGING_URL/health/ready")
test "$ready_code" = 200

actual_release=$(curl --fail --silent --show-error \
  --max-time 15 "$STAGING_URL/version")
test "$actual_release" = "$EXPECTED_RELEASE"

az webapp deployment slot swap \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --slot staging --target-slot production \
  --only-show-errors
```

The [Azure slot command reference](https://learn.microsoft.com/en-us/cli/azure/webapp/deployment/slot?view=azure-cli-latest) defines the swap operation. Record both slot identities before invoking it. After completion, query production again and compare it with the candidate identifier. Keep the old version in staging throughout the observation window; deploying the next candidate immediately would erase the convenient rollback target.

Do not put a blind second swap in a generic shell error trap. A timeout can mean that the client lost the response while the platform completed the operation. First inspect the current slot identities and operation status, then decide whether reversing the swap is appropriate.

## Choose a canary when exposure needs to be gradual

Blue-green changes the active version at a clear boundary. A canary exposes a smaller audience first. App Service can route a percentage of production traffic to a slot:

```bash
az webapp traffic-routing set \
  --resource-group "$RESOURCE_GROUP" --name "$APP_NAME" \
  --distribution staging=5

# Remove the percentage-routing rule when the experiment ends.
az webapp traffic-routing clear \
  --resource-group "$RESOURCE_GROUP" --name "$APP_NAME"
```

These are alternative release controls, not extra commands to paste unconditionally after a swap. The [traffic-routing reference](https://learn.microsoft.com/en-us/cli/azure/webapp/traffic-routing?view=azure-cli-latest) defines the distribution syntax. Session affinity can keep a client associated with a slot, so five percent is not a promise that exactly five of every hundred requests execute the new version. Include existing sessions in rollback testing.

Choose an observation window and measurable stop conditions before exposure. Compare error rates, tail latency and a relevant business operation with the baseline. A low-volume service may need more time to produce useful evidence; a dashboard that shows no errors after three requests has told you very little.

## Rehearse the return path with compatible data

A rollback should restore a known application version without requiring a database reversal. Prefer an expand-and-contract schema change: add a compatible field first, deploy code that understands both representations, backfill carefully, and remove the old representation in a later release after the rollback window closes.

In a test environment, intentionally reject a candidate before the switch, fail a synthetic check after the switch, and interrupt the client during a swap. Verify that the runbook distinguishes all three states. Confirm which release serves production, whether background jobs duplicated work, and whether existing sessions still function.

When a post-swap defect requires reversal, confirm that staging still contains the recorded previous version and that its data assumptions remain valid. Then perform the reverse swap, observe production again, and retain the failed candidate's evidence. The release is complete only when the serving version and the system's behaviour are understood.
