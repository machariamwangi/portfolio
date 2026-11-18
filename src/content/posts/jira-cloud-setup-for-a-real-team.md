---
title: Set up Jira Cloud around the way your team actually works
slug: jira-cloud-setup-for-a-real-team
date: '2026-11-09'
updated: '2026-11-18'
description: A practical Jira Cloud setup, from choosing a space and permissions to work types, workflows, boards, and a tested first automation.
category: DevOps & Jira
tags: [Jira, Team workflows, Project management, Automation]
draft: false
featured: false
cover: /images/blog/jira-cloud-setup-for-a-real-team-photo.webp
coverSmall: /images/blog/jira-cloud-setup-for-a-real-team-photo-768.webp
coverAlt: "People write and check tasks on yellow and green sticky notes attached to a flipchart."
coverFocus: 60
coverCredit: {"author":"Quaritsch Photography","source":"https://unsplash.com/photos/people-writing-on-sticky-notes-on-board-02DAiwIZ0_8","license":"Unsplash License","licenseUrl":"https://unsplash.com/license"}
order: 16
diagram:
  kind: flow
  title: Build the workflow before scaling it
  steps: [Choose a space, Set access, Model the work, Map the board, Test the flow]
  caption: Start with a small working process, then validate it with an ordinary team member.
---

A useful Jira setup lets someone answer four questions without a meeting: what matters next, who owns it, where it is waiting, and what completion means. Start with those questions. A long list of custom fields can wait.

This walkthrough uses a fictional four-person team building a customer portal. Its first goal is a reliable password-reset journey. The names and example work items are illustrative, not a description of a particular client project.

As of November 2026, Jira Cloud documentation calls **projects spaces**, **issues work items**, and **issue types work types**. Automation documentation also uses **flows** where older tutorials say rules. Your interface may still contain older labels. This guide uses the current names; it does not assume that Jira Data Center has identical screens.

![Five steps from choosing a Jira space to testing the complete workflow](/images/diagrams/jira-cloud-setup-for-a-real-team.svg)

## 1. Choose the configuration boundary

Choose **team-managed** when an autonomous team needs control over its own setup. Choose **company-managed** when several teams need shared workflows, fields, screens, or permission schemes. The second option requires coordination with Jira administrators: changing shared configuration can affect other spaces. These are governance choices, not a maturity ranking. [Atlassian explains the configuration differences](https://support.atlassian.com/jira-software-cloud/docs/what-are-team-managed-and-company-managed-spaces/).

For the example portal, use a team-managed Scrum template if the team plans around a sprint goal. Use Kanban if requests arrive continuously and the team pulls the next ready item. Scrum does not prevent urgent support work; Kanban does not remove the need for planning.

Before creation, write down the intended audience, space owner, product boundary, and delivery method. A space called “Everything” usually becomes an argument about priorities rather than a useful shared queue.

## 2. Create the space and establish ownership

In the Cloud sidebar, choose **Spaces → Create space**, select an appropriate software template, and choose the management type. Name the example **Customer Portal** and use an available key such as `PORTAL`. Confirm the key before creating work: it becomes part of identifiers such as `PORTAL-12`.

Jira administrators can create either management type. Creation of team-managed spaces by other users depends on global permissions. If an option is unavailable, ask the administrator to check permissions instead of selecting an unrelated template just to proceed. [The current creation guide lists the supported sequence](https://support.atlassian.com/jira-software-cloud/docs/create-a-new-project/).

Record who can change configuration and who decides product priority. Those responsibilities may belong to the same person in a small team, but they are different decisions. Keep an extra administrator available for absence and handover.

## 3. Set access before adding real information

For a team-managed space, open **Space settings → Access**. Review the access level and individual roles. Open, Limited, and Private have different implications for everyone on the Jira site; adding a narrow role does not necessarily remove access inherited from a more permissive space setting.

Use the narrowest audience that fits the work. Give contributors the ability to maintain their work items, viewers the access they need to follow progress, and administration rights only to people responsible for configuration. Company-managed spaces use permission schemes instead; have the administrator check the actual scheme and its other consumers.

Test with an ordinary contributor account. Can it create, assign, comment, transition, and find work? Can an intended viewer see the board without editing it? Also test an account that should have no access. Plan restrictions matter: do not assume custom roles or item restrictions are available on every subscription. [Atlassian documents team-managed access and inherited roles](https://support.atlassian.com/jira-software-cloud/docs/manage-how-people-access-your-team-managed-project/).

## 4. Model a small amount of real work

In team-managed settings, open **Work types**. Begin with the supplied types rather than creating several near-duplicates:

| Type | Example | Why it exists |
| --- | --- | --- |
| Epic | Account access | Groups related outcomes |
| Story | Request a password-reset link | Describes a user capability |
| Bug | Reset link accepts an expired token | Captures incorrect behavior |
| Task | Add email-delivery monitoring | Tracks supporting work |
| Subtask | Add an expired-token test | Divides an existing item |

An epic should contain smaller deliverable items. A subtask should not become the only place where an important product requirement is written.

Use a compact description template: problem, expected behavior, acceptance examples, dependencies, and test evidence. For the reset story, acceptance examples might include an expired link, an unknown address, and repeated requests. Keep credentials and customer records out of the example data.

Make only essential fields mandatory. Requiring an estimate, due date, release, and detailed design before anyone can report a bug discourages reporting precisely when information is incomplete.

## 5. Make statuses and columns agree

Use a simple proposed workflow: **To do → In progress → In review → Done**, with a route back from review. Define Done in words: accepted behavior, reviewed code, relevant checks, and required documentation. Decide separately whether this means deployable or already deployed.

In a team-managed space, select the work type and edit its workflow. In a company-managed space, coordinate the workflow and its scheme with the administrator. Avoid turning every temporary situation into a status. A blocked flag plus a named dependency often communicates more than a permanent Blocked column.

Then inspect the board. A status belongs to the workflow; a column is the board's presentation of statuses. For company-managed boards, check **Board settings → Layout → Columns**. Map every relevant status and put completed statuses in the rightmost column. Unmapped statuses can hide items from the board and backlog, while incorrect completion mapping affects sprint completion. [The column configuration guide explains these behaviors](https://support.atlassian.com/jira-software-cloud/docs/configure-columns/).

Create three test items and move them through the complete path, including rejection from review. Verify that nothing disappears and the final column really represents the team's completion policy.

## 6. Build a backlog and one small automation

If a team-managed space has no Backlog tab, use **Add to navigation → Backlog → Add to navigation**. Enter the next few outcomes, group related items under the epic, and rank them. Separate “worth considering” from “ready to start.” For the first sprint, pull only enough ready work to support the reset journey. For Kanban, establish a ready queue and an initial limit on simultaneous work.

Open **Space settings → Automation → Create flow → Create from scratch**. Start with an observable, reversible action: when a work item is created, check that its type is Bug and its assignee is empty, then assign the agreed triage owner. Name the flow, limit its scope to this space, and review its actor before enabling it. Test both a matching item and an item that should remain unchanged.

The flow runs using its configured actor's permissions. An administrator successfully creating a flow does not prove its actor can perform every action. Check the actor and audit log when a test fails. [Atlassian describes the flow actor and its permissions](https://support.atlassian.com/cloud-automation/docs/what-is-a-rule-actor/).

Finally, ask someone who did not configure Jira to report a bug, find their queue, complete a story, and explain what happens next. Any confusion is setup feedback. Fix that friction before adding another field or automation.
