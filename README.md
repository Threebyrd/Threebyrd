# Threebyrd Meal Prep Website

Marketing website for Threebyrd Meal Prep, formerly SBX Chicken. The current site introduces the four-box menu, shows macros and ingredients, covers the founders and giving-back work, and includes a placeholder launch-list form.

## Quick Start

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in a browser.

## Useful Commands

```bash
npm run dev
npm run build
npm test
npm run lint
```

## Main Files

- `app/page.tsx`: page sections, menu products, macros, ingredients, founders, and press links.
- `app/globals.css`: all layout, color, responsive, and interaction styling.
- `app/components/MealScene.tsx`: interactive 3D chicken-cube hero, textured from original Threebyrd photography.
- `app/gold-options/page.tsx`: private design comparison route for the four gold palette options.
- `public/assets/`: food photography, founder headshots, wordmark, social preview, and hero chicken asset.
- `docs/SPEC.md`: product, brand, content, and design decisions gathered during planning.
- `.openai/hosting.json`: existing OpenAI Sites project connection.

## Current Status

- Online ordering is not connected yet.
- The email and phone form is visual only and intentionally disabled.
- Prices are placeholders.
- Some beef macros and allergen statements still need confirmation.
- The four product records are grouped near the top of `app/page.tsx` for easy updates.
- Shopify product IDs and checkout behavior can be added later without rebuilding the page design.
- The live site currently uses Honey Gold; compare the other prepared palettes at `/gold-options`.

## Handoff Notes

Run `npm install` after receiving the project. The `node_modules`, build output, and local cache folders are intentionally not included in shared archives because they are regenerated from `package-lock.json`.

Do not add proprietary recipe or seasoning ratios to public page copy or committed source files.
