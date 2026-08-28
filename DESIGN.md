# Threebyrd Visual Design Specification

Status: implementation-ready design direction  
Reference audit date: August 27, 2026  
Primary reference: [eatbuffs.co](https://eatbuffs.co/)  
Companion content specification: [`docs/SPEC.md`](docs/SPEC.md)

## 1. Objective

Redesign the Threebyrd landing page so it has the same visual confidence, product focus, pacing, and playful editorial energy as the current Buffs homepage while remaining unmistakably Threebyrd.

The finished site should feel like a bold consumer food brand, not a SaaS landing page, restaurant template, collegiate club page, or direct copy of Buffs. It should use Threebyrd's actual wordmark, meal photography, macros, plans, founders, and community work with the exact Buffs core color palette requested on August 28, 2026.

This document supersedes the older visual-direction notes in `docs/SPEC.md` where they conflict. The business-state, content-verification, accessibility, and no-fabrication requirements in `docs/SPEC.md` still apply.

## 2. What Makes the Reference Work

The Buffs homepage uses a small set of visual rules with unusually high consistency:

1. A warm cream background acts as the neutral canvas.
2. Saturated coral and mustard sections interrupt that canvas at regular intervals.
3. Nearly every meaningful edge is defined with a dark 2px line.
4. Buttons use hard 2–4px offset shadows instead of soft elevation.
5. A very heavy condensed display face makes headings behave like graphics.
6. Real product photography is oversized and often breaks its nominal column.
7. Small stickers, numbered labels, icons, and marquees add humor without replacing the product.
8. The page alternates dense commerce sections with simpler editorial sections.
9. Conversion actions recur after major persuasion blocks.
10. Mobile is recomposed into a single narrative column rather than merely scaled down.

Threebyrd should adopt these rules as a system. It should not copy Buffs' logo, mascots, proprietary illustrations, package artwork, influencer content, testimonials, wording, or exact section compositions.

## 3. Reference Measurements

The following values were measured from the live Buffs page and should guide proportion, not be copied blindly.

| Element | Buffs desktop | Buffs mobile | Threebyrd target |
| --- | ---: | ---: | ---: |
| Announcement bar | about 42px high | about 51px high | 38–42px / 44–48px |
| Main header | about 90px high | about 75px high | 78–84px / 68–74px |
| Hero display text | 70/70px | 31/41px | 68/66px / 36/38px |
| Major section heading | 48–64px | 28px | 56–64px / 30–34px |
| Card heading | 40/40px | 28/32px | 30–36px / 26–30px |
| Body text | 18/22px | 15–16/20px | 17–18/24px / 15–16/22px |
| Primary hero CTA | 300 × 64px | 258 × 54px | up to 300 × 60px / full-width up to 300px |
| Primary outline | 2px | 2px | 2px; 3px only for major framing |
| Hard shadow | 4px | 2–4px | 4px / 3px |
| Desktop content width | about 1,350–1,388px | full width minus 16–28px | max 1,360px |
| Large section padding | 60–149px vertical | 44–72px vertical | 88–112px / 56–72px |

Buffs uses a custom display font called BN Cinder, Inter for functional/body text, and Source Serif 4 for selected CTA text. Threebyrd must not assume the custom Buffs font is licensed for reuse.

## 4. Threebyrd Design Thesis

The concise design thesis is:

> A high-energy food editorial built from cream paper, near-black ink, vivid coral and mustard blocks, oversized meal photography, hard outlines, and direct nutrition data.

Every section must satisfy at least two of these traits:

- oversized real food photography;
- bold condensed display typography;
- a saturated brand-color field;
- hard outlined controls or cards;
- a compact nutrition/data treatment;
- a playful but truthful sticker or label;
- a clear conversion action.

If a section consists only of a centered heading, a paragraph, and three generic icon cards, it is off-direction.

## 5. Brand Boundaries

### Keep from Threebyrd

- The Threebyrd wordmark.
- The existing Threebyrd wordmark, including its embedded red treatment.
- Buffs' measured cream, coral, mustard, header yellow, peach, white, and near-black as the site UI palette.
- Hard near-black outlines and shadows that keep the brighter fields controlled.
- Actual meal photography and founder photography.
- Direct language about chicken, beef, rice, broccoli, plans, macros, Ithaca, and opening updates.
- Exact, approved nutrition values.
- Community-work and press evidence as the primary social proof.

### Borrow as principles from Buffs

- Full-bleed color-block pacing.
- Heavy condensed headline typography.
- Product imagery that occupies 40–55% of a composition.
- Thin dark outlines and hard offset shadows.
- Marquees as section separators.
- Pill-shaped primary CTAs paired with square utility controls.
- Numbered editorial cards.
- Alternating cream, tomato, gold, and dark sections.
- Mobile layouts that intentionally reorder content.

### Do not borrow

- BUFFS branding or letterforms.
- Its custom mascot or spot illustrations.
- Its bag silhouettes or package layouts.
- Its review, influencer, certification, shipping, discount, or guarantee claims.
- Its exact copy or comparison claims.
- Its large promotional pop-up.
- Its scroll-jacked 3,000px brand-story block.
- Its mobile omission of substantive ingredient content.
- Its unusually large blank vertical spaces when media has not loaded.

## 6. Color System

Use the exact measured Buffs palette consistently. Do not introduce per-component hex colors unless the token is added here first.

```css
:root {
  --tb-paper: #fef9d9;
  --tb-surface: #ffffff;
  --tb-ink: #282828;
  --tb-line: #282828;
  --tb-muted: rgba(40, 40, 40, 0.75);

  --tb-red: #ff5332;
  --tb-red-action: #ff5332;
  --tb-tomato: #ff5332;

  --tb-gold: #ffc232;
  --tb-gold-soft: #ffcf5c;
  --tb-gold-pale: #ffe5a6;

  --tb-green: #282828;
  --tb-green-pale: #ffba92;
  --tb-pink: #ffba92;
  --tb-night: #282828;
}
```

### Color usage rules

- `--tb-paper` is the default page canvas.
- `--tb-surface` is for cards placed on colored fields.
- `--tb-ink` is the default text color.
- `--tb-line` is used for all borders and hard shadows.
- `--tb-red` is the vivid coral used for headlines, word highlights, and primary actions.
- `--tb-red-action` is reserved for primary CTAs and selected states.
- `--tb-tomato` aliases the exact coral for full-width editorial sections.
- `--tb-gold` is the exact mustard used for comparison, process, and marquee sections.
- `--tb-gold-soft` is for the header, badges, secondary buttons, and marquee backgrounds.
- `--tb-green` aliases the near-black field for legacy component compatibility; it is not a separate hue.
- `--tb-pink` and `--tb-green-pale` both alias the measured peach supporting field.
- Never place muted body copy on coral or near-black backgrounds.
- Never use gold text on cream unless contrast is verified; use red or ink instead.
- Limit each section to one neutral, one saturated field, and one accent color.

## 7. Typography

### Recommended type stack

Use legally available, self-hosted files.

```css
--font-display: "Anton", "Arial Narrow", "Arial Black", sans-serif;
--font-body: "Inter", Arial, Helvetica, sans-serif;
--font-accent: "Source Serif 4", Georgia, serif;
```

- `Anton` is the recommended open-source substitute for the reference site's condensed display face.
- `Inter` handles navigation, body copy, plan controls, macros, and form labels.
- `Source Serif 4` is used sparingly for the human, food-editorial accent in primary pill CTAs and selected short pull quotes.
- Self-host WOFF2 assets. Load only the weights used: Anton 400; Inter 400, 600, 800; Source Serif 4 700.
- If font files are not yet added, retain current fallbacks rather than loading remote Google Fonts in production.

### Type scale

```css
--text-display-xl: clamp(3.6rem, 5.1vw, 4.25rem);
--text-display-lg: clamp(3rem, 4.4vw, 4rem);
--text-display-md: clamp(2.1rem, 3.2vw, 3rem);
--text-card-title: clamp(1.65rem, 2.2vw, 2.25rem);
--text-body-lg: 1.125rem;
--text-body: 1rem;
--text-small: 0.8125rem;
--text-label: 0.6875rem;
```

Mobile overrides:

- Hero: 36–40px with 0.98–1.04 line-height.
- Major section headings: 30–34px with 1.05 line-height.
- Card headings: 26–30px with 1.05 line-height.
- Body: 15–16px with 1.4–1.5 line-height.
- Labels: never below 11px.

### Typography behavior

- Display headings are uppercase and use weight through shape, not synthetic bolding.
- Keep desktop display lines under 15 characters when possible and force intentional line breaks.
- Highlight no more than one short phrase per heading in red, tomato, gold, or cream.
- Body text uses sentence case and a maximum readable width of 62ch.
- Functional labels are uppercase, 700–800 weight, with 0.02–0.06em tracking.
- Do not center every section. Alternate centered display sections with left-aligned editorial and commerce sections.
- Use the serif accent only on short CTA labels or a genuine pull quote; never for paragraphs.

## 8. Geometry, Borders, and Shadows

```css
--border-ui: 2px solid var(--tb-line);
--border-major: 3px solid var(--tb-line);
--radius-control: 2px;
--radius-card: 4px;
--radius-pill: 999px;
--shadow-hard: 4px 4px 0 var(--tb-line);
--shadow-hard-mobile: 3px 3px 0 var(--tb-line);
```

- Cards are square or nearly square. Avoid soft 16–24px SaaS radii.
- Primary CTAs are pills; utility buttons and selectable options are rectangular.
- Cards use hard shadows only when interactive or featured.
- Static editorial panels can use outlines without shadows.
- Main `h1` and section `h2` headings use a compact colored plate with a 3px near-black border and 7px hard offset shadow, reduced to 2px/4px on mobile. This repeats the dimensional button language without making the headings interactive.
- Hovering an interactive control moves it 1–2px toward its shadow and reduces the shadow by the same amount.
- Selected cards invert their field color and use an offset red or gold shadow.
- Do not combine blurred shadows with hard shadows.
- Dividers should be full-bleed 2px rules, not faint gray hairlines.

## 9. Grid and Spacing

### Global layout

```css
--page-max: 1360px;
--gutter-desktop: 40px;
--gutter-tablet: 24px;
--gutter-mobile: 16px;
--section-y-desktop: 96px;
--section-y-mobile: 64px;
```

- Background colors always run edge-to-edge.
- Content sits inside a centered max-width wrapper only when needed.
- Hero, split editorial blocks, comparison bands, and image grids may exceed the standard wrapper.
- Desktop grids use 12 conceptual columns with 20–24px gaps.
- Tablet grids use 8 columns with 16–20px gaps.
- Mobile is one content column. Small data groups may use two equal columns.
- Vertical rhythm should alternate between dense commerce areas and more open editorial areas.
- Avoid stacking more than two cream sections without a colored divider or marquee between them.

### Breakpoints

- Mobile: `0–640px`.
- Tablet: `641–1024px`.
- Desktop: `1025px+`.
- Wide layout stops growing at 1,360px.

These breakpoints mirror the reference site's actual re-composition points and align with Threebyrd's existing CSS.

## 10. Image Direction

### Food photography

- Use actual Threebyrd meals as the dominant visual material.
- Favor warm directional light, visible texture, and slightly off-center crops.
- Hero imagery should be isolated or clean enough to sit on cream without a rectangular stock-photo feel.
- Product-card images should share a consistent crop ratio and color temperature.
- Use deliberate image overflow on desktop: up to 8% beyond a grid column, never beyond the viewport.
- Keep food recognizable and uncropped at the key protein/rice/broccoli areas.
- Do not apply dark overlays to food images.

### People and community photography

- Founder photos may use tight cutouts or outlined rectangular frames.
- Giving-back images should feel documentary, not over-retouched.
- Press cards may use publisher labels and article metadata, but no invented excerpts.

### Decorative graphics

- Create Threebyrd-specific sticker shapes: irregular circles, jagged stamps, outlined stars, simple ingredient doodles, and small numbered labels.
- Sticker copy must be factual: examples include `OPENING SOON`, `3–20 / WEEK`, `69G PROTEIN`, or `ITHACA, NY`.
- Decorative icons should be one-color line art using `--tb-line`, `--tb-red`, or cream.
- Do not reuse Buffs' mascots, meat-puff drawings, or bag artwork.

## 11. Page Architecture

Recommended final order:

1. Announcement bar
2. Main navigation
3. Hero
4. Animated fact marquee
5. Four-cell information rail
6. Weekly plan selector
7. Four-item meal menu
8. Two-step "choose meal / choose week" editorial section
9. Ingredient and macro story
10. Giving Back and press proof
11. Brand story
12. Founder strip
13. Launch-update CTA/form
14. FAQ only when approved answers exist
15. Footer

The plan selector and menu should appear in the first half of the page because they explain the purchasable product. Community and founder content support trust later in the journey.

## 12. Section Specifications

### 12.1 Announcement bar

Purpose: communicate current availability in one line.

- Height: 40px desktop; 46px mobile.
- Background: `--tb-red-action`.
- Text: cream, Inter 700, 14–16px desktop and 12–13px mobile.
- Use a repeated line only when it remains readable; otherwise center a single statement.
- Current-safe content direction: online ordering opens soon plus launch-alert CTA.
- Entire bar may link to `#join`.
- Add a 2px dark bottom rule.
- Do not publish a restock, discount, or launch-date claim that is not confirmed.

### 12.2 Header

- Cream or gold-soft field with a 2px dark bottom border.
- Desktop height: 80–84px.
- Logo left, anchor navigation center, utility CTA right.
- CTA: rectangular gold-soft or red control, 2px border, 4px hard shadow, 2px radius.
- Header stays sticky, but the announcement bar scrolls away.
- Desktop nav order: Plans, Menu, Story, Giving Back, Team.
- Mobile: wordmark left; one `GET UPDATES` button and menu control right.
- Hide nonessential desktop links on mobile rather than wrapping them into two rows.
- No cart icon until ordering/cart functionality exists.

### 12.3 Hero

Composition:

- Cream background.
- Desktop split: 56% copy / 44% food image.
- Minimum height: 700px below the header.
- Copy block max width: 740px.
- Left padding follows the 40px desktop gutter.
- Right imagery uses a large isolated meal stack, meal tray, or branded food photograph.
- Add one jagged sticker near the image with factual launch or plan information.

Content hierarchy:

1. Small eyebrow: `THREEBYRD MEAL PREP` or `FORMERLY SBX CHICKEN`.
2. Large product-first headline, maximum three lines.
3. One two-line explanation of chicken/beef, sizes, rice, and broccoli.
4. Primary pill CTA to `#plans` or `#join`.
5. Compact proof row using real macro or community facts.

Visual rules:

- Hero heading uses display type at about 68/66px.
- Highlight one phrase in red-action or tomato.
- Primary CTA is red-action with cream serif text, dark border, and 4px shadow.
- Image occupies at least 42% of the desktop hero.
- Do not restore the chicken cube or animated chickens.
- Do not leave the right half visually empty.

Mobile hero:

- One column with centered copy followed by the image.
- 16–24px side gutters.
- Heading 36–40px and no more than four lines.
- CTA width 258–300px, centered.
- Proof items may wrap into two rows.
- Hero image remains fully recognizable and may extend to the bottom edge.

### 12.4 Fact marquee

- Height: 42px desktop; 36px mobile.
- Background: `--tb-gold` or `--tb-gold-soft`.
- 2px rules above and below.
- Use Inter 800 or display font at 13–16px.
- Repeat verified facts such as sizes, proteins, plans, and included sides.
- Separate phrases with a small Threebyrd bird mark, star, or red dot.
- Animation duration: 24–32 seconds for a full loop.
- Pause on hover and focus.
- Under reduced motion, render one centered static row with overflow hidden.

### 12.5 Four-cell information rail

Keep the current content:

- Sizes / Small + Big
- Weekly Plans / 3–20 Meals
- Proteins / Chicken + Beef
- Every Box / Rice + Broccoli

Design:

- Four equal desktop columns, two tablet columns, one mobile column.
- 2px internal borders and no gutters between cells.
- Minimum height: 104–112px desktop; 84–92px mobile.
- Labels: 11px uppercase Inter 800.
- Values: 22–26px display type.
- Alternate surface, gold-pale, pink, and light green backgrounds.
- Maintain vertical centering across all cells.

### 12.6 Weekly plans

This is the primary commerce-style module and should visually echo the reference site's product selector without copying it.

Desktop composition:

- Cream or pink background.
- Split layout: 44% real meal photography / 56% configuration content.
- Photography may be a 2×2 collage or one large image with small numbered stickers.
- Right column begins with `WEEKLY PLANS`, a large heading, and a one-sentence explanation.
- Four plan cards remain individually selectable.

Plan cards:

- Desktop: 2×2 within the right column, or four across if the section remains full width.
- Mobile: single column; do not use a carousel.
- 2px border, 4px radius, 4px hard shadow.
- Number of meals is the dominant element.
- Reserve fixed rows for weekly price, price per meal, and savings to prevent jumping when pricing is added.
- Primary select control occupies the full card width.
- Selected state uses night or red background, cream text, and gold/red offset shadow.
- Selected state must update the button label and `aria-pressed`; do not rely on color alone.
- Do not assign `MOST POPULAR` or `BEST VALUE` until the business selects those plans.
- When approved, badges sit partly outside the top border as small dark sticker labels.

### 12.7 Menu cards

- Keep all four meals visible simultaneously on desktop.
- Grid: four columns desktop, two tablet, one mobile.
- Equal heights per row.
- Image takes 50–58% of the card height.
- Card outline: 3px dark line; 4px radius.
- Product name uses 28–34px display type.
- Price placeholder stays visibly secondary until finalized.
- Macro panel is always visible, never hidden behind an accordion.
- Protein cell receives the gold highlight.
- Ingredient and allergen status remains visible beneath macros.
- CTA is a full-width outlined or red button, not a bare text link.
- Hover: translate up 3px and add a 5px hard shadow.

Approved nutrition values:

| Meal | Calories | Protein | Carbs | Fat |
| --- | ---: | ---: | ---: | ---: |
| Small Chicken | 660 | 46.5g | 77.5g | 17g |
| Big Chicken | 970 | 69g | 114g | 26g |
| Beef | 960 | 66.5g | 77.5g | 41g |

Until separate small/big beef macros are supplied, the interface must state the scope of the single beef macro set or avoid implying two different verified beef servings.

### 12.8 Two-step editorial section

Adapt the reference site's large two-card contrast composition into a truthful Threebyrd process section.

- Full tomato background.
- Cream display heading centered at the top.
- Two large outlined cards labeled `01` and `02`.
- Card 01 explains choosing Chicken/Beef and Small/Big.
- Card 02 explains choosing 3/5/10/20 meals per week.
- Use real cutout food imagery around card corners instead of stock icons.
- Cards may use cream and honey-gold fields.
- Keep all copy short enough to read without scrolling inside cards.
- Do not disparage competitors or invent customer pain claims.

### 12.9 Ingredient and macro story

The reference uses an editorial split view with ingredient tabs and large ingredient photography. Threebyrd should adapt this into a simpler, accurate food composition.

- Heading direction: every box is built from protein, rice, and broccoli.
- Desktop: 50/50 split between copy/data and close-up food photography.
- Use three or four tab-like controls for Chicken, Beef, Rice, and Broccoli.
- Active item uses red-action background and cream text.
- Description card overlays the photo near the bottom edge.
- Macro language must come from the verified product data, not generalized health claims.
- Mobile stacks copy, controls, image, and description. Do not hide the section.
- If ingredient or allergen facts are not approved, label them as pending rather than inferring them.

### 12.10 Giving Back and press proof

This replaces the reference site's influencer and review carousels as Threebyrd's authentic proof section.

- Full tomato or green background.
- Use a left-aligned display heading and compact source/filter chips at the top.
- Show impact stats in a dark-outlined strip: 300+ boxes, $3,000+ in meals, two large giveaways.
- Press items appear as horizontal editorial cards with publisher, date, short verified summary, and external-link CTA.
- If event photos are available, use a horizontal snap gallery with cards about 280–340px wide.
- Do not add testimonials, star ratings, purchaser badges, or influencer faces without real source material and approval.

### 12.11 Brand story

- Use a gold field and a three-panel sequence inspired by the reference's process storytelling.
- Do not use scroll-jacking or a multi-thousand-pixel sticky spacer.
- Each panel uses one image, one short heading, one paragraph, and one factual label.
- Suggested sequence: started as SBX Chicken; grew around convenient meal prep; becoming Threebyrd.
- On desktop, panels may use horizontal scroll snap with visible next/previous controls.
- On mobile, stack panels vertically so all content is available without gestures.

### 12.12 Team

- Treat founder cards like editorial cutouts, not corporate biography cards.
- Three columns desktop, one mobile.
- Use thick image crops with dark outlines and small rotated name labels.
- Limit rotation to ±1 degree.
- Use only confirmed name and title.
- Avoid long bios until approved.

### 12.13 Launch updates

- This is the final major CTA and should be visually unmissable.
- Full red or night background with cream text.
- Display heading plus a short factual line about online ordering opening soon.
- Email and phone inputs use cream fields, 2px outlines, square corners, and 48–52px height.
- Submit control uses honey gold, hard shadow, and visible loading/success/error states.
- Repeat the privacy/consent copy required by the selected provider.
- Keep form integration isolated from the presentational component.

### 12.14 FAQ

- Add only after approved answers exist.
- Cream field, two-column desktop layout: heading/illustration left, accordion right.
- One-column mobile layout.
- Accordion rows use 1–2px bottom borders, 48px minimum height, and large plus/minus indicators.
- Questions must cover real ordering, pickup/delivery, plan changes, allergens, and launch timing only when answers are confirmed.
- Avoid joke answers that reduce trust around food safety or delivery.

### 12.15 Footer

- Cream field with 2px top rule.
- Newsletter mini-form or launch CTA on the left; navigation and legal links on the right.
- Oversized Threebyrd wordmark may anchor the bottom edge.
- No public email, phone, fake social handles, or cart links until approved.
- Keep the footer compact; do not reproduce the reference site's excessive pre-footer blank space.

## 13. Component States

### Buttons

Default:

- 2px dark border.
- 3–4px hard shadow.
- 2px radius for utility controls or pill radius for primary CTA.

Hover:

- Translate `2px 2px`.
- Reduce shadow to `1px 1px`.
- Preserve text contrast.

Focus-visible:

- 3px cream or gold outline plus 2px offset when on dark fields.
- 3px red outline plus 2px offset when on light fields.

Pressed/selected:

- No shadow or 1px shadow.
- Background inversion.
- Text/action label changes where stateful.

Disabled:

- 55% opacity.
- No hover translation.
- `cursor: not-allowed`.
- Retain visible border and readable label.

### Cards

- Interactive cards receive hover/focus treatment.
- Static cards do not move on hover.
- Selected plan or product options use both background inversion and a textual confirmation.
- Do not make featured plans more than 4px taller than neighboring cards.

### Inputs

- Minimum height 48px.
- Visible text label; placeholder is not the label.
- 2px border and 2px radius.
- Error state uses red border, icon, and explanatory text.
- Success state uses green border and confirmation text.

## 14. Motion

- Default interaction duration: 180–300ms.
- Use `cubic-bezier(0.4, 0, 0.2, 1)` for buttons and cards.
- Marquee duration: 24–32 seconds linear infinite.
- Horizontal galleries use native scroll snap and restrained arrow controls.
- Small stickers may drift or rotate by at most 2–3 degrees.
- Product images may move 4–8px on hover; never spin.
- No 3D models or WebGL in the current direction.
- Avoid scroll-jacking, cursor replacements, and continuous parallax.

Reduced motion:

- Stop marquees and render a static centered fact row.
- Remove decorative drift and hover rotation.
- Keep opacity changes under 150ms or remove them.
- Preserve all content and interaction state.

## 15. Responsive Behavior

### Desktop: 1025px+

- 12-column composition.
- Use split layouts and image overflow.
- Keep all menu cards visible in one row when space permits.
- Use full-size display typography and 40px gutters.
- Show complete navigation.

### Tablet: 641–1024px

- Switch four-column grids to two columns.
- Keep split hero only if each column remains at least 360px; otherwise stack.
- Use 24px gutters.
- Reduce display type about 20–25%.
- Keep plan cards and macro panels fully visible.

### Mobile: 0–640px

- 16px gutters.
- One-column narrative flow.
- Center the hero and selected display sections; keep product/FAQ copy left aligned.
- Place images after their explanatory copy unless the image establishes context.
- Use full-width buttons with a 300px maximum where centered.
- Preserve all substantive content; hide only decoration.
- Never require horizontal scrolling for plan selection, menu cards, macros, forms, or FAQ.
- Horizontal scroll snap is acceptable only for optional photo/press galleries with a visible partial next card.
- Ensure every tap target is at least 44 × 44px.
- Avoid the reference site's mobile defects: hidden ingredient content, image-load gaps, and excessive vertical blank space.

## 16. Accessibility

- Maintain WCAG 2.2 AA contrast for text and interactive elements.
- Use one `h1`, then sequential `h2`/`h3` levels.
- Do not use all-caps display type for paragraphs or form instructions.
- Every image needs meaningful alt text or an empty alt when decorative.
- Plan selection uses buttons with `aria-pressed` and a live textual confirmation.
- Marquees are `aria-hidden` when duplicated; expose one static equivalent to screen readers.
- Galleries and carousels need named controls, keyboard support, and no forced autoplay.
- Accordions use native buttons and `aria-expanded`.
- Focus states cannot depend on browser defaults against saturated backgrounds.
- Color is never the only indicator of selected, error, success, or unavailable states.

## 17. Performance

Threebyrd should achieve the visual richness of the reference without inheriting its third-party page-builder weight.

- No Replo, Shopify theme bundle, WebGL, or unnecessary carousel dependency.
- Hero image: AVIF/WebP, responsive sources, target 180–260KB at the largest served size.
- Below-fold photos: target 100–180KB each and lazy-load.
- Decorative SVG: under 20KB each where possible.
- Self-host at most four font files initially.
- Preload only the display font and hero image.
- Avoid video backgrounds until compressed assets and poster frames are approved.
- Keep cumulative layout shift below 0.1 by reserving image dimensions.
- Keep Largest Contentful Paint below 2.5 seconds on a representative mobile connection.
- Keep interaction animations on `transform` and `opacity`.
- The page must remain useful with JavaScript disabled; only plan selection and optional galleries may lose enhancement.

## 18. Content Integrity

- Do not invent pricing, savings, testimonials, certifications, shipping coverage, pickup rules, launch dates, ingredient claims, or allergen claims.
- Use `Coming soon` only in fields explicitly awaiting business decisions.
- Do not show strike-through prices until there is a real comparison price.
- Do not show a popularity/value badge until Threebyrd chooses the plan and pricing supports the claim.
- Use exact macros supplied by the founders.
- Community numbers and press summaries must remain tied to their sources.
- The site can be playful, but food safety, nutrition, and ordering copy must stay literal and credible.

## 19. Current Repository Mapping

Implementation should be concentrated in these files:

- `app/globals.css`: tokens, typography, section fields, grids, responsive behavior, states, and motion.
- `app/page.tsx`: page order, hero, menu data, community, story, team, and final CTA.
- `app/components/WeeklyPlans.tsx`: plan selection and selected-state accessibility.
- `app/layout.tsx`: font loading and metadata.
- `public/assets/`: optimized food, people, sticker, and editorial assets.
- `tests/rendered-html.test.mjs`: required copy, plan options, macros, hierarchy, and regression checks.

Recommended component extraction during implementation:

```text
app/components/
├── AnnouncementBar.tsx
├── BrandMarquee.tsx
├── Hero.tsx
├── InfoRail.tsx
├── WeeklyPlans.tsx
├── MealCard.tsx
├── IngredientStory.tsx
├── PressRail.tsx
├── FounderCard.tsx
├── LaunchForm.tsx
└── FAQ.tsx                 # only after approved content
```

Keep menu and plan data separate from JSX once live prices and Shopify IDs are introduced.

## 20. Implementation Sequence

### Phase 1: Foundation

1. Add licensed/self-hosted display, body, and accent fonts.
2. Replace global tokens with the documented `--tb-*` system or map existing tokens exactly.
3. Normalize borders, radii, shadows, focus states, page width, and gutters.
4. Build announcement bar, compact header, and reusable marquee.

### Phase 2: First viewport and commerce

1. Recompose hero with real food photography and factual CTA/sticker content.
2. Restyle the information rail.
3. Rebuild weekly plans as the primary commerce module.
4. Restyle meal cards with consistent imagery and macro panels.

### Phase 3: Editorial rhythm

1. Replace the current generic process treatment with the two-card editorial section.
2. Build the ingredient/macro split section.
3. Recast Giving Back and press as the authentic proof carousel/rail.
4. Restyle story and founders.

### Phase 4: Conversion and polish

1. Rebuild launch-update form.
2. Add FAQ only after approved answers exist.
3. Add restrained motion and reduced-motion fallbacks.
4. Optimize all imagery and fonts.
5. Complete desktop, tablet, and mobile visual QA.

## 21. Acceptance Criteria

The redesign is complete only when all of the following are true:

- The first viewport reads as a consumer food brand before the user reads body copy.
- A real Threebyrd meal is one of the two largest visual elements in the hero.
- Cream, red, and honey gold dominate the page; supporting colors remain subordinate.
- All major buttons use the same outline/shadow interaction system.
- All major section headings use the approved condensed display face.
- Background fields run full bleed and create clear pacing.
- No section resembles a generic rounded SaaS card grid.
- The weekly plan selector clearly confirms selection beyond a radio indicator.
- All four meal cards show accurate, meal-specific macros.
- No unverified price, savings, review, nutrition, ingredient, allergen, or delivery claim is present.
- Desktop, tablet, and mobile each have intentional compositions.
- Mobile includes all substantive content with no giant blank gaps.
- Keyboard navigation, focus treatment, reduced motion, and contrast pass review.
- `npm run lint`, `npm test`, and the GitHub Pages build pass.
- Visual checks are completed at 1440×1000, 1024×768, 390×844, and 360×800.
- No console errors, broken images, horizontal page overflow, or cumulative layout jumps remain.

## 22. Final Visual Test

Ask these questions during review:

1. If the Threebyrd logo were hidden, would the page still feel like one coherent food brand?
2. Is food more visually dominant than UI chrome?
3. Does every saturated section have a clear editorial or conversion purpose?
4. Are borders, shadows, type, and button behavior consistent from hero through footer?
5. Does the site feel playful without making unsupported claims or looking juvenile?
6. Does mobile feel designed rather than compressed?
7. Is the result recognizably inspired by Buffs' system while using only Threebyrd's identity and content?

If any answer is no, the implementation is not finished.

## 23. Research Sources

- [Buffs homepage](https://eatbuffs.co/), audited as rendered at desktop and mobile breakpoints on August 27, 2026.
- [Anton typeface source and OFL license](https://github.com/googlefonts/AntonFont), recommended as a legally reusable display alternative rather than copying Buffs' custom font.
