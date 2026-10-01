# Agents project instructions

## Planning and scope
- Read `docs/PRD.md` before implementation. The repository is named Agents; the supplied PRD uses the working product title Scholarly. Do not assume a product rename has been approved.
- The user authorized backend implementation first and will supply the UI. Build backend foundations now; keep the Paperpal UI approval gate below in place.
- Once implementation is authorized, follow the PRD milestones and acceptance criteria in order. Ask before architectural decisions that contradict the PRD.

## Paperpal design system — required before any screen
- Use the Paperpal design system for all UI.
- Source priority: (1) user-provided tokens/theme file or repository, (2) user-provided Figma file, Storybook, or component library package, (3) user-provided token and component summary.
- The user supplied Figma file `FgnpnRGUrLM52yxKYWJ1vP`, frame `349:48909`, as the first-screen source. See `docs/FIGMA-HANDOFF.md` for inspected styles, components, user-directed changes, and the pending confirmation. The original PRD source fields remain placeholders; do not mistake that for a missing Figma source.
- Locate the authoritative source and present the available colors, type scale, spacing, radii, and reusable components to the user before building any screen.
- If the source cannot be found, stop and ask the user. Never approximate or invent tokens, or treat another project's styles as authoritative without confirmation.
- The user approved the inspected Figma values and explicitly authorized building the first screen: "yeah yeah build it. no confirmation required now". Proceed within this approved design without another confirmation. Preserve the source-based design rules below.
- Use only design-system tokens. Do not hard-code colors, font sizes, or spacing values.
- Reuse existing components before creating new ones; flag every proposed new component.
- The suggested Tailwind/shadcn stack in the PRD does not authorize default styling that bypasses Paperpal tokens or components.
