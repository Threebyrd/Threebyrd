# Threebyrd Meal Prep Website Spec

## Purpose

Build a polished landing page for **Threebyrd Meal Prep** while online ordering is paused before launch. The page should support current marketing efforts, introduce the brand, show the sample menu, capture launch interest, and be easy to connect to Shopify ordering later.

This is a new project and should not overwrite the existing Sh*tbox Chicken/SBX Chicken website files. Treat the old website folder as reference material only.

## Current Business State

- Brand name: **Threebyrd Meal Prep**.
- Former brand context: **Threebyrd Meal Prep, formerly SBX Chicken**.
- Orders are not open yet.
- Do not show "Order now" or an exact launch date.
- Primary conversion: collect both email and phone number for launch updates.
- Secondary goals: show the sample menu, explain the founders/story, and highlight community work.
- Future goal: connect product/menu cards to Shopify once ordering opens.

## Target Audience

- Primary: college students.
- Broader appeal: busy people who want convenient, high-protein meal prep without a premium price.
- The site should not feel campus-only, frat-specific, or overly student-exclusive.

Avoid language like:

- cheap
- diet food
- gym bro
- frat
- healthy food for students

Preferred feel:

- professional
- approachable
- nutrition-forward
- convenient
- affordable without sounding low-quality
- Cornell-founded, but not Cornell-limited

## Brand Positioning

Primary hero copy:

- Headline: "Threebyrd Meal Prep"
- Supporting line: "Chicken or beef. Little or Big."
- Detail: "Rice, broccoli, and clearly listed macros in every box."

Tone:

- Colorful, playful, and food-first
- Direct and conversational, with very little slogan or startup-style language
- Professional enough for a broad audience without feeling corporate or campus-specific

The design should borrow confidence from the temporary text logo without making the whole site look like an athletics page or a technology startup.

## Visual Direction

Use the temporary wordmark as the starting brand reference:

- Dark red primary: approximate logo sample `#901818`
- Gold accent: Honey Gold `#dca62f`, with three documented alternatives on `/gold-options`
- Supporting palette may add bright yellow, tomato red, leafy green, and a warm pink alongside dark red and gold.

Design requirements:

- Hero should use one irregular 3D cube of baked chicken as the sole main product interaction. Texture it from the original high-resolution Threebyrd food photography so the food remains authentic to the product.
- The chicken should move gently on its own, support pointer and touch rotation, respect reduced-motion settings, and remain clearly framed on desktop and mobile.
- Use real food photos wherever possible.
- Avoid dark gritty texture from the old Sh*tbox site.
- Show all four meal cards at once on desktop and stack them cleanly on smaller screens; do not require clicking through a product picker.
- Make macros, ingredients, and allergen status prominent, always-visible parts of every meal card.
- Use a brighter Honey Gold family rather than neon yellow or the earlier muted antique gold.
- Use colorful full-width sections and bold borders rather than restrained startup-style feature cards.
- Make the food the main visual subject.
- Keep typography bold enough to echo the logo, but readable and friendly.
- Avoid obvious value-proposition blocks, inflated taglines, and language about product architecture or future integrations.
- Use restrained data-style nutrition readouts, crisp borders, and responsive motion to create a more high-tech feel without turning the site back into a technology-startup design.
- The interaction and pacing may take broad inspiration from playful food sites such as Buffs, but Threebyrd must keep its own red, honey-gold, nutrition-forward identity and should not add testimonial sections without real customer material.

## Site Structure

Recommendation: one polished scrolling landing page with sticky/top anchor navigation. Build the sections so they can become separate pages later if needed.

Navigation:

- Menu
- Giving Back
- Meet the Team
- Join List

Sections:

1. Hero / launch capture
2. Sample menu
3. Brand story / why Threebyrd
4. Giving Back
5. Meet the Team
6. Join list repeat CTA
7. Footer

No public phone number or public email in the footer for now.

## Hero Section

Content goals:

- Show the Threebyrd Meal Prep name/wordmark.
- Use the interactive high-definition chicken cube as the first-viewport product signal.
- Lead with the literal brand name and plainly describe the current four-box menu.
- Make it clear orders are opening soon without naming a date.
- Primary CTA should scroll to the sample menu.
- Secondary CTA should scroll to the launch list form.

CTA copy options to test:

- Join the First Drop
- Get Launch Alerts
- Be First to Know

Avoid:

- Order Now
- Shop Now
- Launches September X

## Waitlist / Launch List

For now, build the UI only and make it simple to connect later.

Fields:

- Email
- Phone number

Behavior for first version:

- Show a polished form layout.
- Include a clear disabled/mock submit state or front-end-only placeholder behavior.
- Use a visible note such as "Online ordering opens soon. Join the list for the first menu drop."
- Keep the form implementation isolated so it can later connect to Shopify Email, Klaviyo, Mailchimp, a custom endpoint, or another collection tool.

Technical implementation preference:

- Put form settings/action in one easy-to-find place.
- Do not hard-code future vendor assumptions.
- No backend required for the initial landing page unless explicitly added later.

## Sample Menu

Show four separate product cards:

- Little Chicken
- Big Chicken
- Little Beef
- Big Beef

Pricing:

- Use placeholders for now.
- Make prices very easy to change later.
- Do not imply final pricing.
- Use "Starting at" language only if it does not make the placeholder prices feel final.

Card content:

- Product name
- Product photo
- Size cue
- Protein-forward macro highlight
- Calories/carbs/fat if available and cleanly presented
- Price placeholder
- Expandable or compact details for ingredients/allergens
- CTA points to launch list, not checkout

Old reference data found in the existing site:

- 1 Extra Big Chicken: `$13`, 970 cal, 70g protein, 114g carbs, 26g fat
- 3 Little Chickens: `$21`, about 800 cal, about 60g protein
- 3 Big Chickens: `$30`, about 2900 cal, about 210g protein
- 3 Beef Boxes: `$36`, about 2800 cal, about 200g protein

Important: these are placeholders from the old site and may not map directly to the new Little/Big Chicken/Beef menu. Final prices, serving sizes, macros, ingredients, and allergens must be confirmed by the founders before launch.

Known ingredient/allergen handling:

- Use old information where available.
- If exact allergen details are missing, design a consistent field and mark content as TBD in the source data.
- Do not make unverified dietary claims.

## Product Data Architecture

Make menu updates easy.

Recommended approach for the first build:

- Store menu items in one editable data structure, such as `src/data/menu.js`, `data/menu.json`, or a clearly marked object near the top of the menu script.
- Product cards render from that data rather than duplicating prices/macros all over the markup.
- Future Shopify IDs/handles can be added to the same item records.

Suggested product fields:

- `id`
- `name`
- `proteinType`
- `size`
- `price`
- `priceLabel`
- `image`
- `calories`
- `protein`
- `carbs`
- `fat`
- `ingredients`
- `allergens`
- `shopifyProductId`
- `status`

Future Shopify behavior:

- The landing page menu cards should be designed so "Notify me" can later become "Add to cart" or a Shopify Buy Button without rebuilding the whole section.
- Keep checkout/order-specific code separate from the visual card component.

## Giving Back Section

This is a separate major section reachable from the top nav.

Tone:

- Community-minded, credible, humble.
- Focus on the partners/events and impact, not fraternity branding.

Approved wording direction:

- Mention that two on-campus organizations at Cornell University helped make the major giveaway events possible.
- Do not name Alpha Delta Phi or Delta Upsilon in the primary copy for now.
- Mention Cornell lightly: founded by Cornell students and involved in local Ithaca community efforts.

Known impact:

- Two large giveaway events.
- 300+ boxes donated.
- About `$3,000+` worth of product donated.
- Worked with Friendship Donations Network.
- Worked with Ithaca Catholic Worker House.

News references:

- WBNG: "Cornell students to distribute 200 free meals Saturday"
  - https://www.wbng.com/2026/04/30/cornell-students-distribute-200-free-meals-saturday/
- 14850: Cornell student meal-prep startup offering free meals
  - https://www.14850.com/050145866-cornell-sbx-chicken-giveaway/

Use an "In the News" area at the bottom of the Giving Back section.

Approved article framing:

> Threebyrd Meal Prep, formerly SBX Chicken

Article presentation:

- Show small article cards or press links.
- Include brief excerpts/snippets.
- Link to the full articles.
- Keep excerpts short.

WBNG facts verified from the article:

- Published April 30, 2026.
- Reported that Cornell students planned to distribute 200 free meals in Ithaca.
- Identified Truman Popp and Thor Waguespack as running SBX Chicken.
- Mentioned cooperation with Ithaca Catholic Worker House and Friendship Donations Network.
- Mentioned a prior March event where 110 meals were handed out.
- Mentioned Alpha Delta Phi helped with funding, but the new site should generalize this as on-campus organizations for now.

## Meet the Team Section

Show three founders:

- Thor Waguespack
- Truman Popp
- Luc Surprenant

Display only:

- Headshot
- Name
- Position/title

No long bios for now.

Headshot assignments:

- Thor Waguespack: use the professional headshot at `/Users/thorbw/Documents/Personal Documents/CCG Headshot.jpg`
- Luc Surprenant: use the playful/tongue-out headshot at `/Users/thorbw/Library/Messages/Attachments/d0/00/64A96884-AE26-4140-96D5-B7312796674E/80938650087__CCB9D914-78ED-4F05-8720-83E6C5B4CB99.HEIC`
- Truman Popp: use the provided square headshot.

The user will still provide:

- final roles/positions

Suggested placeholder roles until confirmed:

- Co-Founder
- Co-Founder
- Co-Founder

Do not invent personal background details.

## Brand Story Section

Purpose:

- Explain that Threebyrd grew from a student-founded meal prep project into a broader nutrition/convenience brand.
- Mention Cornell in a light, credibility-building way.
- Bridge old SBX Chicken recognition into the new brand without making the page feel like a rebrand apology.

Possible copy direction:

> Threebyrd started with a simple problem: busy weeks make it hard to eat well consistently. What began as cooking high-protein boxes for friends has grown into a meal prep brand focused on convenience, value, and meals people actually look forward to eating.

## Footer

Include:

- Threebyrd Meal Prep name
- Simple navigation links
- Social placeholders only if handles are confirmed
- Copyright

Do not include:

- public phone number
- public email address
- fake social handles

Social handle candidates to confirm later:

- `threebyrd`
- `eatthreebyrd`

## Assets

Current reference assets:

- Temporary text logo:
  - `/Users/thorbw/Library/Messages/Attachments/ba/10/9FBD8412-48E8-47F1-B310-7861FFE3BF74/2c3dabd6-4671-402d-92a8-c12d43efdc46.png`
- Old website/project reference folder:
  - `/Users/thorbw/Documents/ai_projects/website`
- Old food photos:
  - `/Users/thorbw/Documents/ai_projects/website/Sh_tbox Chicken_files/IMG_7372(1).jpg`
  - `/Users/thorbw/Documents/ai_projects/website/Sh_tbox Chicken_files/shitbox_chicken_1.jpg`
  - `/Users/thorbw/Documents/ai_projects/website/Sh_tbox Chicken_files/3Little.heic`
  - `/Users/thorbw/Documents/ai_projects/website/Sh_tbox Chicken_files/3Big.heic`
  - `/Users/thorbw/Documents/ai_projects/website/Sh_tbox Chicken_files/3Beef.heic`
- Newly provided food photos:
  - `/Users/thorbw/Library/Messages/Attachments/32/02/C8C7898A-1401-452F-AB0E-E30EED695846/3:2CB.heic`
  - `/Users/thorbw/Library/Messages/Attachments/43/03/708C853F-3EDC-451D-9D62-B9DE24534A64/3Beef.heic`
  - `/Users/thorbw/Library/Messages/Attachments/65/05/C83E824F-5ADA-4B97-A607-306F19CC9438/3Big.heic`
  - `/Users/thorbw/Library/Messages/Attachments/95/05/049F910B-883B-472F-AE5E-CFE561FAF66C/3Little.heic`
  - `/Users/thorbw/Library/Messages/Attachments/56/06/C05317A2-A3C7-43D5-8901-A5EE5F7E0881/5Beef.heic`
  - `/Users/thorbw/Library/Messages/Attachments/ce/14/0B9A81D2-1996-4ADC-A122-F0C13014B4E3/5Big.heic`
  - `/Users/thorbw/Library/Messages/Attachments/77/07/36C6A166-3CAE-4011-89E2-08F852BCF80E/5Little.heic`

Asset notes:

- Some old product images use `.heic` extensions. Convert or export final web assets to `.jpg`, `.webp`, or `.png` before launch.
- New food photos are also `.heic`; create web-friendly copies in the new project's asset folder during implementation.
- Use the provided headshots for Thor Waguespack, Truman Popp, and Luc Surprenant.
- Final logo is still in progress.
- Use temporary wordmark until final logo is provided.

## Accessibility And Responsive Requirements

- Mobile and desktop both matter.
- Header/nav must work cleanly on mobile.
- Text must not overlap food imagery.
- Buttons and fields must have clear labels.
- Food images need descriptive alt text when meaningful.
- Press/article links must be readable and keyboard-accessible.
- Color contrast must be checked for red/gold combinations.
- Product card details should be accessible if expandable.

## SEO / Metadata

Initial title:

> Threebyrd Meal Prep - High-Protein Meal Prep

Initial description:

> Convenient, high-protein meal prep without the premium price. Founded by Cornell students and opening soon.

Open graph:

- Use brand name.
- Use a strong food or logo image once final assets are available.

Avoid outdated SBX/Sh*tbox metadata on the new site.

## Technical Direction

The first build can be a simple static site unless a framework is chosen for deployment convenience.

Acceptable approaches:

- Vanilla HTML/CSS/JS
- Vite/React if a richer component structure is useful
- Next.js only if deployment/Shopify integration later justifies it

Recommendation:

- Build a clean static/Vite site with component-like structure and a single menu data source.
- Keep future Shopify integration isolated.
- Avoid unnecessary backend work until the launch list provider is selected.

Deployment:

- Host TBD.
- Design should be easy to deploy to Vercel, Netlify, GitHub Pages, or Shopify later.

## Out Of Scope For First Landing Page

- Live ordering
- Shopify checkout
- user accounts
- subscription/long-term plan pricing
- exact launch date
- public contact info
- final social handles
- final pricing
- final allergen claims if not confirmed

## Open Decisions / TODO

- Final product pricing.
- Final product macro mapping for Little Chicken, Big Chicken, Little Beef, Big Beef.
- Final ingredients and allergen text per product.
- Final form provider for email/SMS collection.
- Final social handles.
- Final founder positions.
- Final logo.
- Final domain/hosting choice.
