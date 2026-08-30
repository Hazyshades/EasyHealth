## Why

The report document selector reimplements modal behavior without focus trapping, portal rendering, or keyboard dismissal.

## What Changes

- Add a shared Radix-backed dialog primitive.
- Migrate report document selection while preserving its controls.

## Capabilities

### New Capabilities
- `accessible-dialog`: Portalled, keyboard-accessible product dialogs.

### Modified Capabilities
- None.

## Impact

- Dialog primitive, report creation surface, and dialog dependency.