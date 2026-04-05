# macOS-Style Instrument Menu Bar

## What & Why
Replace the current instrument tabs bar in the Terminal component with a macOS-style glassmorphic menu bar. The screenshot shows trading instruments (MBT, Oil(WTI), MNQ, MES, MGC, MCL) as left-side menu items and SIMPLE / PRO view mode toggles on the right side. This gives the terminal a sleeker, more polished look.

## Done looks like
- The instrument selector row at the top of the Terminal is replaced with a macOS-style glassmorphic bar (dark translucent background, rounded corners, backdrop blur)
- Left side shows instrument labels (e.g. MBT, Oil(WTI), MNQ, MES, MGC, MCL) as clickable items — the active instrument is visually highlighted (bold/white text, gold underline or similar)
- Right side shows SIMPLE and PRO toggle buttons — PRO has a distinct button/badge style (matching the screenshot where PRO appears as a bordered pill/button)
- Clicking an instrument still switches the chart and trading context as before
- Clicking SIMPLE/PRO still toggles the view mode as before
- The bar uses the glassmorphic styling from the provided macOS menu bar component (semi-transparent dark bg, border with subtle white opacity, rounded corners, backdrop-blur, inset shadow)
- No dropdown menus needed — the instruments are direct-click tabs, not menus with sub-items
- The Apple logo, clock, battery, wifi icons from the macOS component are NOT included — only the bar styling is adopted

## Out of scope
- Dropdown menus or submenus for instruments
- Changes to the dashboard header (the top bar with RAW FUNDED logo, balance, etc.)
- Changes to the sidebar navigation
- Any functional changes to how instruments or view modes work

## Tasks
1. Restyle the existing instrument tabs bar (lines 891-920 of Terminal.tsx) to use the macOS glassmorphic bar appearance — dark translucent background with `rgba(40, 40, 40, 0.65)`, backdrop-blur, rounded corners, subtle border and shadow. Remove the current flat `border-b border-b1 bg-s1` styling.
2. Update instrument tab items to match the screenshot's horizontal text layout with appropriate spacing, using the existing instrument labels. The active instrument should have a clear visual indicator (bold text, possible gold accent) instead of the current bottom-border style.
3. Restyle the SIMPLE/PRO toggle on the right side — SIMPLE as plain text and PRO as a bordered pill/badge button, matching the screenshot's appearance.
4. Add the `menuFadeIn` keyframe animation to the CSS if needed for any hover/transition effects on the bar.

## Relevant files
- `client/src/components/dashboard/Terminal.tsx:34-46,269-274,880-920`
- `client/src/lib/constants.ts:1-45`
- `attached_assets/Screen_Shot_2026-03-11_at_4.13.53_PM_1773260035609.png`
- `attached_assets/Pasted-You-are-given-a-task-to-integrate-an-existing-React-com_1773260069933.txt`
