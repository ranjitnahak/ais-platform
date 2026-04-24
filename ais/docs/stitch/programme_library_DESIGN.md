---
name: Kinetic Precision
colors:
  surface: '#121317'
  surface-dim: '#121317'
  surface-bright: '#38393d'
  surface-container-lowest: '#0d0e12'
  surface-container-low: '#1a1b1f'
  surface-container: '#1e1f23'
  surface-container-high: '#292a2e'
  surface-container-highest: '#343539'
  on-surface: '#e3e2e7'
  on-surface-variant: '#e0c0b1'
  inverse-surface: '#e3e2e7'
  inverse-on-surface: '#2f3034'
  outline: '#a78b7d'
  outline-variant: '#584237'
  surface-tint: '#ffb690'
  primary: '#ffb690'
  on-primary: '#552100'
  primary-container: '#f97316'
  on-primary-container: '#582200'
  inverse-primary: '#9d4300'
  secondary: '#c8c6c8'
  on-secondary: '#303032'
  secondary-container: '#474649'
  on-secondary-container: '#b6b4b7'
  tertiary: '#c8c6c8'
  on-tertiary: '#303032'
  tertiary-container: '#9b9a9c'
  on-tertiary-container: '#323234'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbca'
  primary-fixed-dim: '#ffb690'
  on-primary-fixed: '#341100'
  on-primary-fixed-variant: '#783200'
  secondary-fixed: '#e4e2e4'
  secondary-fixed-dim: '#c8c6c8'
  on-secondary-fixed: '#1b1b1d'
  on-secondary-fixed-variant: '#474649'
  tertiary-fixed: '#e4e2e4'
  tertiary-fixed-dim: '#c8c6c8'
  on-tertiary-fixed: '#1b1b1d'
  on-tertiary-fixed-variant: '#474648'
  background: '#121317'
  on-background: '#e3e2e7'
  surface-variant: '#343539'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: -0.01em
  body-base:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: '0'
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-margin: 24px
  gutter: 12px
  component-padding-x: 12px
  component-padding-y: 8px
---

## Brand & Style

The design system is engineered for the high-stakes environment of professional elite athletics. It prioritizes technical rigor, rapid data interpretation, and a focused, "lights-out" atmosphere that mimics high-performance training facilities. 

The aesthetic is **Modern Minimalist** with a focus on functional density. It avoids decorative clutter to ensure that coaches and sports scientists can monitor athlete metrics and training loads without distraction. The interface should feel like a precision instrument—reliable, sharp, and authoritative. Visual weight is used strategically to highlight critical performance deltas and phase transitions, ensuring the most important data points command immediate attention.

## Colors

The palette is anchored by a deep charcoal base to reduce eye strain during long programming sessions. The primary accent, a high-visibility orange, is reserved for interactive states, primary actions, and "active" training indicators. 

The system utilizes a tiered grayscale for depth, using subtle shifts in value rather than shadows to define hierarchy. For data visualization and status badges, a specialized palette for training phases (Prep through Deload) provides instant cognitive categorization. Semantic colors for difficulty and readiness follow standard physiological conventions: green for optimal recovery, yellow for caution, and red for high fatigue/injury risk.

## Typography

This design system utilizes **Inter** for its exceptional legibility in data-heavy interfaces. To handle the density of strength programming (reps, sets, percentages, and intensities), the system leverages Inter’s "tabular numbers" feature to ensure vertical alignment in data tables.

Headlines are tight and bold to establish clear section hierarchy. Labels use uppercase styling with increased letter spacing to differentiate metadata from actionable content. Small body text (13px) is used for secondary athlete notes to maximize vertical space without sacrificing readability.

## Layout & Spacing

The layout follows a **Fluid Grid** model designed for widescreen dashboard consumption. A 12-column system is utilized for main dashboard views, while a 4-column sub-grid manages the internal layout of training cards and data modules.

The spacing rhythm is built on a 4px baseline, but defaults to a compact 12px gutter to allow for high information density. Margins are kept consistent at 24px to provide a "frame" for the data, ensuring the interface feels organized even when packed with complex training blocks. Sidebar widths are fixed at 240px to maximize the available horizontal space for multi-column data tables.

## Elevation & Depth

In this dark-themed environment, depth is communicated through **Tonal Layering** rather than traditional shadows. The background sits at the lowest level (#1C1C1E). Surface containers, such as data cards and sidebars, are elevated using a slightly lighter value (#2C2C2E).

To separate interactive elements within these containers, a 1px "ghost border" (#3A3A3C) is applied. Active states, such as a selected menu item or a focused input, utilize a subtle inner glow or a left-aligned 2px stroke in the primary orange accent. This approach maintains a flat, high-performance look while providing clear visual cues for user focus.

## Shapes

The shape language is **Soft (0.25rem)**. This slight rounding provides a professional, modern feel without appearing too consumer-oriented or "soft." 

Buttons and input fields use the standard 4px radius. Status badges (pills) for training phases use a fully rounded (pill-shaped) radius to distinguish them clearly from interactive buttons and structural cards. Data table rows are sharp, utilizing no radius to ensure that zebra-striping and hover states create a continuous, unbroken visual line across the screen.

## Components

### Sidebar & Navigation
The sidebar uses a dark-on-dark approach. Active states are indicated by a 10% opacity orange background fill and a 3px solid orange left-border "indicator." Icons are monochrome (Neutral) unless active.

### Data Tables
Tables are the core of the system. They feature a 1px bottom border for rows and a subtle hover state (#3A3A3C). Header cells use the `label-caps` typographic style. For "data-dense" views, row height is compressed to 32px.

### Status Badges (Pills)
Pills use a "Soft-Fill" style: 15% opacity of the phase color for the background with 100% opacity text of the same color. This ensures high contrast without overwhelming the charcoal background.

### Input Fields & Search
Search inputs are minimal, featuring a #2C2C2E fill and a 1px border that transitions to the primary accent on focus. Placeholder text is low-contrast (#8E8E93).

### Filter Dropdowns
Dropdown triggers use a chevron-down icon and display the current active filter count in a small orange badge. The dropdown menus use the highest elevation tone (#3A3A3C) to stand out against the background.

### Training Block Cards
Cards group exercises into logical sets. They utilize a vertical accent line on the left corresponding to the "Difficulty Level" of the specific exercise, allowing coaches to scan for high-intensity work at a glance.