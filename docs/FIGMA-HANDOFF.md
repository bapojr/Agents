# Agents first-screen Figma handoff

Status: inspected and approved. The user authorized implementation without another confirmation: "yeah yeah build it. no confirmation required now".

## Authoritative design

- File: https://www.figma.com/design/FgnpnRGUrLM52yxKYWJ1vP/Paperpal-Landing-Pages---Revised?node-id=349-48909
- Frame `349:48909`: Agents - Landing Page - Default, 1440 × 777, page `349:48908`.
- Inspected through Figma design context, screenshot, variable definitions, and read-only Plugin API on 2026-10-01.
- No Code Connect mappings or existing UI component package were returned/found in Agents. Figma components must be translated into reusable React components; they are not already installed code components.

## User-directed changes

- Use this Figma appearance for the left sidebar; preserve applicable PP Illustrate sidebar interactions.
- Default mode is Search papers.
- Rename Publication year to Filters and replace its calendar icon with a Font Awesome filter icon.
- Follow-up: fit the Filters button to its label and use the outlined `filter` asset from the connected Editage Design System (New) library (component key `04b65a5384e5e63a61c7825ad13c54c399a0da32`). The exported SVG is preserved in `public/figma/library-filter-regular.svg` at its original dimensions.
- Implement the supplied component states, not merely a flat picture of the landing screen.
- Publish a static UI preview through GitHub Pages. Keep the Next.js backend intact; Pages cannot execute its server endpoints.

## Named styles found

| Figma style | Value |
| --- | --- |
| Gray / 1 | #FFFFFF |
| Gray / 2 | #F8F9FD |
| Gray / 5 | #E4EAF7 |
| Gray / 6 | #D8E0EE |
| Gray / 9 | #7D8AA1 |
| Gray / 11 | #5D6A81 |
| Gray / 12 | #13161B |
| Blue / 2 | #F5F8FF |
| Blue / 3 | #EDF3FF |
| Blue / 9 | #0062FF |
| Blue / 11 | #1C4DC0 |
| Blue / 12 | #051E57 |
| Purple / 10 | #650FBA |
| New Color - US/Extended Palette/Neutrals/Brand Black - N800 | #1F2937 |

The names above normalize inconsistent whitespace in the source style names, not their values.

Named text style: Button/Button label, IBM Plex Sans Medium, 16px / 24px. The style-summary endpoint reports weight 400, but direct text inspection reports Medium with variable wght=500. Use direct font inspection as evidence rather than silently treating Medium as Regular.

Named shadow: (16px, 8px), blur 32px, spread 16px, #00000005; and (4px, 4px), blur 16px, spread 0, #00000014. Inspect the actual component's effects before implementing: generated CSS uses different drop-shadow approximations.

## Exact frame values requiring confirmation as reusable code tokens

No local variable collections or bound node variables were found. Most typography, spacing, and radii are direct component values, not named shared tokens. The user approved mapping these exact Figma values to code tokens; do not describe them as an existing published token scale.

- IBM Plex Sans Regular/Medium/SemiBold (400/500/600): 11, 12, 14, 16, 20px.
- IBM Plex Serif Medium: 38px heading.
- Line heights: auto, 20px, 24px, 28.54054069519043px, according to each text node.
- Positive local padding/gap values: 2, 4, 5, 6, 8, 10, 15, 16, 24px. Zero, -4px overlap, and 172px component layout spacing also occur; these are context-specific, not a universal spacing scale.
- Visible corner values: 0, 4, 6, 8, 10, 12px. Other hidden component states in design context include 2 and 20px; inspect those states before using them.

## Figma components to reuse as implementation sources

- Research Agent composer: set `875:87074`, current variant `875:86061`.
- Agent model selector: set `857:18949`, current variant `857:19309`.
- Paper source selector (Model): set `864:21117`, current variant `864:21805`.
- Publication year / future Filters selector (Model): set `865:23515`, current variant `865:23516`; custom-year control set `865:23287`.
- Input - voice to text: set `27:16280`.
- Sidebar Component 2: set `119:38945`, collapsed `119:38944`, expanded `119:38942`, checks hover `119:38943`.
- Menu Item: set `1:29181`, expanded/collapsed, hover and selected variants.
- Icon: set `1:29131`; Icon Hover: set `1:29214`.
- Paperpal Logo: set `1:4273`; Skyward - Icons: set `1:10771`; Sparkle Animation: set `1:40`.
- Breadcrumb, Agents badge, Upgrade to Prime CTA, suggestion rows are compositions visible in the frame; create reusable React wrappers for them using this design.

The Research Agent set contains duplicate variant names (Variant6 and Variant9), and Figma's variantProperties getter fails on an invalid component set. Identify states by stable node IDs and their content rather than variant labels. No changes were made to the Figma file.

## Illustrate behavior reference

Inspected the user-authorized reference at /Users/sushrut.baporikar/Documents/New project, app.js and index.html.

- Sidebar logo button toggles collapsed/expanded state.
- Start New returns from the prompt flow to landing, or scrolls the landing composer into view.
- Recent item selection restores a prototype conversation/template.
- The sign-in CTA only toggles a prototype signed-in class; do not mistake it for real authentication.
- Several displayed navigation/account controls have no matching functional handlers. Do not claim backend functionality for those controls when reproducing the UI.

## Implementation boundary

After design confirmation, build the first screen with reusable components and verified Figma assets, preserving the existing backend. No invented research results, working authentication claims on Pages, or additional unapproved screens. Verify default selection, dropdown/component states, sidebar behavior, keyboard interactions, and visual match before publication.
