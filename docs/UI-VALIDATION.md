# Agents first-screen validation

## Scope

Approved Figma frame `349:48909` plus supplied sidebar and selector component states.
User overrides: Search papers default; Publication year renamed Filters with Font Awesome.
The browser preview is static; backend integration remains a separate milestone.

## Checks performed

- TypeScript check passed.
- Full production Next.js build passed with the original dynamic API routes preserved.
- Existing 21 web tests passed, including authentication and database isolation tests.
- Static Next.js export passed with `/Agents` asset paths and no server API routes.
- Browser comparison at Figma's 1440 × 777 size: badge y=90, heading y=152,
  composer x=262.5/y≈278 with width 963; suggestion width 750.
- Original local Figma SVG dimensions retained; visible images loaded successfully.
- Agent and paper-source menus visually checked; keyboard ArrowDown + Enter selected a mode.
- Custom filter rejects reversed years and accepts 2021–2026; selected range appears on the control.
- Suggested prompt populates the composer and enables submit.
- Submit displays an explicit preview limitation and adds the query to current-session Recents.
- Start New resets query, attachments, source, mode, and year filter; selecting a recent query restores its settings.
- Sidebar expanded/collapsed designs inspected with logo, navigation, and account controls.
- Responsive browser check at 390 × 844: no horizontal overflow; Filters popover remains within the viewport.

Voice capture was not activated because doing so would request microphone access. PDF
analysis, remote search, login, and payments are deliberately not claimed as functional.

## Filters dialog update — 2026-10-05

- Production static export and TypeScript passed; 39 web tests passed, including 18 filter validation/summary checks.
- Desktop comparison at 1440×777: modal 587×572 centered at x=426.5/y=102.5. Local sliders, radio, toggle, close, stepper, and accordion assets loaded at exported sizes.
- All 24 field checkboxes and Q1–Q4 reachable; expanded content scrolls while Apply Filters stays visible. Scrollbar responds to Home/End and reflects scroll position.
- Combined custom year, PDF, open-access, citations, multiple subjects, and quartiles apply together and remain on reopening. Reversed years produce an error. Escape discards draft changes and restores trigger focus.
- Responsive check at 390×844: modal stays within viewport; SVG shadow overflow is clipped horizontally without resizing assets; long subject labels wrap.
- Applying filters does not claim live search integration in the static preview.
