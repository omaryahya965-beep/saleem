# SALEEM design system

Source: `frontend/src/styles.css` (tokens + Tailwind theme) and `frontend/src/components/ui/*`.
Live reference: `/styleguide` (dev builds only). Screenshots: `docs/screens/phase2/`.

## Tokens
| Token | Hex | Use | Contrast |
|---|---|---|---|
| ink | #0E2620 | text-primary, inverse surfaces | 14.1:1 on paper |
| ink-2 | #183830 | inverse secondary surface | card on ink-2 12.2:1 |
| green | #0B6E4F | primary, links, focus ring, ready | 5.5:1 on paper; white on green 6.3:1 |
| mint | #7FD1AE | accent on dark only | 8.8:1 on ink |
| paper / card | #F3F1EA / #FBFAF6 | page / surface | — |
| line | #DCD8CB | decorative dividers only | 1.3:1 (not for controls) |
| line-strong | #8A877B | form control borders (added) | 3.45:1 on card |
| muted | #4B5552 | text-secondary | 6.8:1 on paper |
| amber / amber-text / amber-bg | #A15C00 / #8A4F00 / #F7EDDC | warning marker / warning text (added) / bg | amber-text 5.7:1 on amber-bg (amber 4.47:1 fails AA for text) |
| red / red-bg | #B3261E / #F8E6E3 | violation | 5.4:1 |
| green-bg | #E2EFE8 | ready bg | green 5.3:1 |

Semantic CSS variables: `--surface, --surface-sunken, --text-primary, --text-secondary, --border,
--border-strong, --focus, --status-{violation,warning,ready}[-bg]`, mapped to Tailwind colours
`surface, sunken, fg, fg-muted, border, border-strong, focus, violation, warning, ready`.

## Type
IBM Plex Sans Arabic 400/500/700 (UI) and Noto Naskh Arabic 700 (display, Arabic headings only),
self-hosted via @fontsource. Scale 13/14/16/18/22/28/36/48/64 = `text-xs … text-5xl`.
Body line-height 1.7; no letter-spacing on `:lang(ar)`; `tabular` utility for times (`00:12`);
`prose-measure` = 70ch.

## Space, radius, elevation, motion
4px grid (`--spacing: 4px`). Radii sm 8 / md 12 / lg 20 / full. Shadows: `raised` (selected issue,
hero demo) and `overlay` (dialogs, toasts) only. Motion 150–250 ms ease-out; all animation disabled
under `prefers-reduced-motion`.

## Direction
Logical properties only (`ms/me/ps/pe/start/end`). `dir`/`lang` on `<html>` follow the language
(I18nProvider) and Radix `DirectionProvider`. Directional icons use `flip-rtl`. Exception: the
VideoTimeline is always LTR (media convention, matches the native player).

## Primitives
AppShell, PageHeader, Page, Brand, LanguageToggle, Button, IconButton, Spinner, Input, Textarea,
Select (native), Checkbox, Field, Switch, SegmentedControl, Tabs, StatusChip (icon + text), Badge,
Card, Dialog (bottom sheet on mobile), Toaster/toast, Tooltip, Skeleton, EmptyState, ErrorState,
KeyValueList, ProgressBar, Stepper, Dropzone, VideoTimeline, IssueCard, RuleRow.
Touch targets ≥ 44px for all mobile controls (buttons md, inputs, switch rows, timeline markers 32px
hit area within a 44px track row).
