## Context

PageHeader permits title-less headers and renders titles as h2 elements.

## Goals / Non-Goals

**Goals:** give every main route one visible, navigation-consistent h1.

**Non-Goals:** change route metadata or sidebar labels.

## Decisions

Make PageHeader's title required and render it with h1. Add concise existing navigation labels to all current callsites.

## Risks / Trade-offs

Callsite compilation identifies any future title omission.