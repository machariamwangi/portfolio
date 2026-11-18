---
title: 'Give a deployment a short-lived identity'
slug: circleci-aws-oidc-short-lived-credentials
date: '2026-10-29'
updated: '2026-11-18'
description: 'Configure CircleCI Cloud and AWS OIDC with an explicit V3 trust policy, short sessions and negative tests for unauthorized branches.'
category: 'Delivery & CI'
tags: ['CircleCI', 'AWS', 'OIDC', 'Security']
draft: false
featured: false
cover: /images/blog/circleci-aws-oidc-short-lived-credentials-photo.webp
coverSmall: /images/blog/circleci-aws-oidc-short-lived-credentials-photo-768.webp
coverAlt: "A hand holds two metal keys on a ring beside a white door and lock."
coverFocus: 50
coverCredit: {"author":"Maria Ziegler","source":"https://unsplash.com/photos/keys-on-hand-jJnZg7vBfMs","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}
order: 13
diagram:
  kind: flow
  title: 'Identity is checked before permissions are issued'
  steps: ['CircleCI job', 'Signed V3 token', 'AWS trust policy', 'Temporary role', 'Scoped operation']
  caption: 'AWS rejects an unmatched project, repository, branch or audience before issuing a session. An accepted session is still limited by the role permission policy.'
---

A deployment job needs permission for a limited period. A permanent cloud access key gives it a much longer-lived capability, with rotation and cleanup becoming separate operational work. OpenID Connect lets the job present a signed description of its origin and exchange that evidence for a temporary cloud session.

The useful question is not simply whether authentication succeeds. It is whether **only the intended job origin can acquire the intended permissions**. This walkthrough uses CircleCI Cloud and AWS, with explicit placeholders rather than example account IDs that might be mistaken for real configuration.

## Design the boundary before writing the command

Write down the deployment boundary in plain language: one CircleCI project, code from one repository's `main` branch, configuration from that same protected branch, and a role that can change only the required environment. If a separate repository owns your pipeline configuration, substitute that exact repository deliberately.

CircleCI currently recommends `CIRCLE_OIDC_TOKEN_V3` for new Cloud setups. Its subject includes both checkout and configuration origins. V3 is not available on CircleCI Server; existing V1 and V2 policies need a deliberate migration rather than a variable-name replacement. The [CircleCI OIDC guide](https://circleci.com/docs/guides/permissions-authentication/openid-connect-tokens/) documents those formats and availability constraints.

Protect the configuration repository as carefully as application code. A trusted job can execute arbitrary commands from its configuration. Short credential lifetimes reduce exposure, but they do not make unreviewed deployment scripts safe.

## Register the issuer and constrain the role

An AWS administrator first creates an OIDC provider for `https://oidc.circleci.com/org/<CIRCLECI_ORG_ID>`, with the CircleCI organization UUID as the audience for the default token. Follow AWS's [OIDC provider setup](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html) rather than copying an old certificate thumbprint from a tutorial.

Use the following trust policy as a template. Replace every angle-bracket placeholder, including those embedded in condition keys. The repository forms have no `https://` prefix. This example intentionally permits only one repository and one branch, with a wildcard only for the initiating CircleCI user.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/oidc.circleci.com/org/<CIRCLECI_ORG_ID>"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "oidc.circleci.com/org/<CIRCLECI_ORG_ID>:aud": "<CIRCLECI_ORG_ID>",
        "oidc.circleci.com/org/<CIRCLECI_ORG_ID>:oidc.circleci.com/project-id": "<CIRCLECI_PROJECT_ID>"
      },
      "StringLike": {
        "oidc.circleci.com/org/<CIRCLECI_ORG_ID>:sub": "org:<CIRCLECI_ORG_ID>:project:<CIRCLECI_PROJECT_ID>:user:*:checkout-source:github.com/<OWNER>/<REPOSITORY>:checkout-ref:refs/heads/main:config-source:github.com/<OWNER>/<REPOSITORY>:config-ref:refs/heads/main"
      }
    }
  }]
}
```

AWS documents the dedicated CircleCI project condition in its [OIDC condition-key reference](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html#available-keys-for-aws-oidc). Do not assume that every custom token claim automatically becomes an IAM condition key. The full subject pattern supplies the repository and reference restrictions here.

A trust policy controls who can assume the role. A separate permissions policy controls what that role can do. Start with the resource and API operations required by your actual deployer. Publishing one application image should not imply permission to manage IAM users, delete unrelated repositories or administer the whole account.

![A CircleCI identity token passes a trust policy before becoming a temporary, restricted AWS session.](/images/diagrams/circleci-aws-oidc-short-lived-credentials.svg)

## Exchange the token without printing it

The next fragment runs inside an existing CircleCI deployment job whose reviewed executor includes Bash and AWS CLI v2. Put nonsecret identifiers in the job's restricted context: `AWS_ROLE_ARN`, `AWS_REGION` and `AWS_EXPECTED_ACCOUNT_ID`. Do not add permanent access keys to that context.

```yaml
- run:
    name: Obtain and verify a temporary AWS session
    command: |
      set +x
      set -euo pipefail
      : "${CIRCLE_OIDC_TOKEN_V3:?V3 token unavailable}"
      : "${AWS_ROLE_ARN:?Set the deployment role}"
      : "${AWS_REGION:?Set the target region}"
      : "${AWS_EXPECTED_ACCOUNT_ID:?Set expected account}"
      unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
      unset AWS_PROFILE AWS_DEFAULT_PROFILE
      export AWS_PAGER=''
      umask 077
      token_file=$(mktemp)
      trap 'rm -f "$token_file"' EXIT
      printf '%s' "$CIRCLE_OIDC_TOKEN_V3" > "$token_file"
      credentials=$(aws sts assume-role-with-web-identity \
        --role-arn "$AWS_ROLE_ARN" \
        --role-session-name "circleci-$CIRCLE_BUILD_NUM" \
        --web-identity-token "file://$token_file" \
        --duration-seconds 900 \
        --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' \
        --output text)
      read -r AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN \
        <<< "$credentials"
      export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
      unset credentials
      actual_account=$(aws sts get-caller-identity \
        --query Account --output text)
      test "$actual_account" = "$AWS_EXPECTED_ACCOUNT_ID"
      # Run the reviewed deployment command in this same shell.
```

The script requests fifteen minutes, the minimum supported duration for this STS operation. Choose a longer bounded session if the actual operation needs it; do not discover an undersized timeout halfway through a production change. AWS's [AssumeRoleWithWebIdentity reference](https://docs.aws.amazon.com/cli/latest/reference/sts/assume-role-with-web-identity.html) defines session limits and returned credentials.

The token goes into a private temporary file, keeping it out of command arguments. Shell tracing is disabled before handling it. The resulting credentials remain in the current process environment, not a workspace, artifact or committed file. The trap cleans up the token on normal shell exit; executor destruction provides an additional lifecycle boundary.

Keep the identity check and deployment in the same `run` shell shown here. A later CircleCI step starts a new shell, and another job has a separate environment altogether. If the workflow needs a second privileged job, let that job obtain its own session under its own restricted role. Passing credential files through a workspace defeats the short lifecycle this design is meant to establish.

Review the code that can execute after the exchange, too. A trusted repository reference does not make every dependency or downloaded deployment script trustworthy. Keep production commands in reviewed source, avoid fetching an unpinned script and executing it with the new credentials, and restrict who can change the deployment configuration. OIDC removes the need to store a permanent key; it does not replace change review or the role's permissions boundary.

## Test rejection as carefully as success

First run a read-only identity check in a nonproduction account. Then attempt the same role assumption from a feature branch, another project and a pipeline using an unapproved configuration reference. Each attempt should fail. Do not loosen the policy merely because a negative test is red: that is the expected result.

A branch filter in CircleCI is useful scheduling control, but it should not be the only authorization boundary. The cloud policy must independently reject an ineligible origin. An approval button also does not change the token's repository claims.

If an eligible job fails, compare issuer, audience, project and subject format locally without dumping the complete token into a public log. V2 slash-delimited subjects do not match V3 colon-delimited policies. A Cloud pipeline with no checkout source can have an empty V3 token, which this script rejects explicitly.

During migration, remove old static credentials after the new path is verified. AWS documents [environment variable precedence](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html); a leftover credential can make a command succeed through the wrong identity and give a misleading impression that federation works.

If deployment fails after authentication, separate identity troubleshooting from application rollback. Restore the last approved artifact using an authorized session. Do not respond by granting administrator permissions or returning to a permanent production key. Keep the role policy, trust policy and their rejection tests under review so the deployment identity stays as narrow as the job it serves.
