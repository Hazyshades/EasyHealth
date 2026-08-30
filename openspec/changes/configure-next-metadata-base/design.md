## Context

Next root metadata is the correct ownership point for URL resolution. It currently has no `metadataBase`.

## Goals / Non-Goals

**Goals:** derive an absolute production origin from a public environment override or stable fallback.

**Non-Goals:** introduce per-request host inference or change route metadata.

## Decisions

Declare `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://easyhealth.app")` in root metadata. A focused verifier checks this expression and its fallback.

## Risks / Trade-offs

Deployments must set the public site URL when they do not serve `easyhealth.app`.