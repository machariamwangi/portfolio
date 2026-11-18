---
title: 'Build once. Promote the digest.'
slug: build-once-promote-docker-digest
date: '2024-04-23'
updated: '2026-11-18'
description: 'Move one verified Docker image through staging and production with an explicit release record, rather than rebuilding at every environment.'
category: 'Delivery & CI'
tags: ['Docker', 'CircleCI', 'Deployment', 'Release engineering']
draft: false
featured: true
cover: /images/blog/build-once-promote-docker-digest-photo.webp
coverSmall: /images/blog/build-once-promote-docker-digest-photo-768.webp
coverAlt: "Shipping containers are stacked along a working waterfront cargo terminal."
coverFocus: 50
coverCredit: {"author":"Jerome Monta","source":"https://unsplash.com/photos/assorted-shipping-container-lot-near-body-of-water-gBHsx-bAy78","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}
order: 12
diagram:
  kind: flow
  title: 'The artifact stays fixed; the environment changes'
  steps: ['Build image', 'Capture digest', 'Verify staging', 'Approve release', 'Promote same digest']
  caption: 'Both environments consume the same registry digest. Failed verification ends promotion; rollback selects an earlier approved digest rather than rebuilding source.'
---

A staging deployment can pass every check while production receives different bytes. The source commit might be identical, yet a second build can select a changed base image, a newly resolved package or different build arguments. Rebuilding for each environment quietly adds another experiment after the tests have finished.

The alternative is a release record that identifies one image by its digest. Build it once, verify that image, and give each environment the same reference. Configuration and credentials remain environment-specific, but the application artifact does not.

## Separate a useful label from an identity

A tag such as `release-42` is a human-friendly name. A reference such as `registry.example.com/team/api@sha256:…` names registry content. Tags can move; a content digest changes when the referenced content changes. Docker's [image digest guide](https://docs.docker.com/dhi/explore/security-concepts/digests/) also explains an important wrinkle: an image index and its platform-specific manifests have different digests.

Use an index digest if a release deliberately contains multiple architectures. Verify every architecture that production will run. Testing the AMD64 variant does not establish that the ARM64 variant starts correctly. For a simpler first pipeline, choose one explicit platform and make the production platform match it.

A digest establishes identity, not trust. A malicious image has a perfectly valid digest too. Your controls still need to establish who built the image, what was tested, and who may authorize it for production.

![A single image digest moves from build through staging verification and approval into production.](/images/diagrams/build-once-promote-docker-digest.svg)

## Produce a release record beside the image

The following CircleCI job assumes a reviewed Dockerfile at the repository root. Its `runtime` target must depend on the required build and test stages; a disconnected `test` stage can be skipped by BuildKit. Configure a restricted `registry-publish` context with `REGISTRY_HOST`, `IMAGE_REPOSITORY`, `REGISTRY_USERNAME` and `REGISTRY_TOKEN`. These names are inputs, not real account identifiers.

```yaml
version: 2.1
jobs:
  package:
    docker:
      - image: cimg/base:2026.11
    steps:
      - checkout
      - setup_remote_docker
      - run:
          name: Build, push and record the image identity
          command: |
            set -euo pipefail
            : "${REGISTRY_HOST:?Set registry host}"
            : "${IMAGE_REPOSITORY:?Set repository path}"
            : "${REGISTRY_USERNAME:?Set registry user}"
            : "${REGISTRY_TOKEN:?Set registry credential}"
            set +x
            printf '%s' "$REGISTRY_TOKEN" |
              docker login "$REGISTRY_HOST" \
                --username "$REGISTRY_USERNAME" --password-stdin
            mkdir -p /tmp/release
            repository="$REGISTRY_HOST/$IMAGE_REPOSITORY"
            tag="$repository:git-$CIRCLE_SHA1-job-$CIRCLE_BUILD_NUM"
            docker buildx build --target runtime \
              --platform linux/amd64 --push --tag "$tag" \
              --metadata-file /tmp/release/build.json .
            digest=$(jq -er '."containerimage.digest" |
              select(test("^sha256:[0-9a-f]{64}$"))' \
              /tmp/release/build.json)
            jq -n --arg image "$repository@$digest" \
              --arg commit "$CIRCLE_SHA1" \
              --arg job "$CIRCLE_BUILD_NUM" \
              '{image:$image, commit:$commit, job:$job}' \
              > /tmp/release/release.json
      - persist_to_workspace:
          root: /tmp/release
          paths: [release.json]
      - store_artifacts:
          path: /tmp/release/release.json
          destination: release.json
workflows:
  candidate:
    jobs:
      - package:
          context: registry-publish
          filters:
            branches:
              only: main
```

The Docker executor needs a daemon for image builds, which is what `setup_remote_docker` supplies in this configuration. A machine executor already has a different execution model; do not blindly add that step there. CircleCI describes the distinction in its [Docker execution guide](https://circleci.com/docs/guides/execute/building-docker-images/).

Read the registry digest from Buildx's structured [metadata output](https://docs.docker.com/reference/cli/docker/buildx/build/#write-build-result-metadata-to-a-file---metadata-file), not a loose text match on the build log. A local image ID or configuration digest is not interchangeable with the pushed manifest identity. The explicit JSON validation makes missing or malformed metadata stop the job.

## Pass metadata downstream, not another build command

A staging job attaches the workspace and reads `release.json`. Use `attach_workspace` with `at: /tmp/release` before the shell fragment below, so its file path matches the producer's relative workspace contents. After staging passes, an approval and production job consume the same file. Do not reconstruct the reference from `latest`, and do not let the deploy job choose a new tag based on the current branch tip.

CircleCI [workspaces](https://circleci.com/docs/guides/orchestrate/workspaces/) transport files within a workflow. They are additive, and reruns can inherit existing contents. Keep this release file under a single writer. If you intentionally rebuild a candidate, start a fresh workflow and create a new release record rather than trying to overwrite the previous candidate's workspace layer.

For Kubernetes, the deployment portion can be as small as the following shell fragment. It assumes `kubectl`, `jq`, an authenticated context and a namespace-scoped deployment identity have already been supplied. `NAMESPACE`, `DEPLOYMENT_NAME` and `CONTAINER_NAME` are required environment inputs.

```bash
set -euo pipefail
: "${NAMESPACE:?}" "${DEPLOYMENT_NAME:?}" "${CONTAINER_NAME:?}"
image=$(jq -er '.image' /tmp/release/release.json)
[[ "$image" =~ @sha256:[0-9a-f]{64}$ ]]
kubectl -n "$NAMESPACE" set image \
  "deployment/$DEPLOYMENT_NAME" "$CONTAINER_NAME=$image"
kubectl -n "$NAMESPACE" rollout status \
  "deployment/$DEPLOYMENT_NAME" --timeout=180s
```

The Kubernetes [Deployment guide](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/) covers image updates and rollout status. In a GitOps environment, make the equivalent digest change in the deployment repository instead of fighting a controller with an imperative update.

## Decide what staging must prove

A successful rollout means the orchestrator accepted the workload and its configured readiness conditions. It does not prove that checkout, invoicing or a background import still works. Add a small application-specific acceptance suite against the staged URL. Include authentication, one representative read and one reversible write against synthetic data.

Make the approval show enough information for a release decision: the image reference, source revision, successful verification run and target environment. A button labelled only with a branch name leaves the approver guessing which candidate will move. Freeze the record after verification and prevent the production job from accepting an arbitrary replacement file. Otherwise, the pipeline can faithfully deploy a digest that nobody actually reviewed.

Registry access also deserves separation. A packaging identity needs to push new content; a runtime normally needs only to pull the approved repository. The deployment identity changes the workload reference. Keeping these responsibilities distinct makes the release path easier to audit and reduces the chance that one compromised runtime can replace a future candidate. Apply the controls to the actual registry and platform rather than assuming a naming convention enforces them.

Verify the deployed release identity through a protected diagnostic endpoint or deployment metadata. Compare it with the record that the job received. This catches a surprisingly ordinary failure: the test job exercising an older deployment while the new rollout is still in progress.

Keep database URLs, service credentials and environment-specific hostnames out of the image. Inject them through the deployment platform. Frontend builds need special care: if an API URL is compiled into JavaScript, changing that URL changes the artifact. Prefer a runtime configuration document when the application needs one frontend bundle across environments, and validate that document separately.

## Make rollback a selection, not a reconstruction

Store approved release records somewhere durable before the workflow workspace expires. Keep the associated registry content and evidence for the rollback window. A digest is not useful if retention rules have deleted its manifest or layers.

To roll back, select the previous approved image reference and run the same deployment procedure. Do not rebuild its commit. Confirm that the old application remains compatible with the current database schema and message formats; an immutable image cannot reverse a destructive migration.

Exercise this sequence in a disposable environment: deploy candidate A, deploy candidate B, select A's recorded digest, and verify both identity and behaviour after the rollback. The result you want is a predictable release decision with a traceable artifact, not an unmeasured promise that every deployment will be safe.
