## Why

Main application routes can lack a visible page heading, weakening navigation and heading semantics.

## What Changes

- Require `PageHeader` titles and render them as `h1` elements.
- Supply navigation-consistent titles at every application callsite.

## Capabilities

### New Capabilities
- `page-heading-semantics`: Visible main-content page identity.

### Modified Capabilities
- None.

## Impact

- Shared PageHeader and its application callsites.