# Cave map and navigation assets

Generated with built-in image_gen; reference images supplied by the user.

## Saved assets

- `dist/assets/ui/cave-world-map.png` — full cave map background.
- `dist/assets/ui/map-prev.png` and `dist/assets/ui/map-next.png` — left/right wooden arrow icons.
- `dist/assets/ui/level-markers/banner-blank.png` — pennant with live stage numbers overlaid by the UI.
- `art/level-select-cave/navigation-source.png` — original transparent sprite sheet.
- Repack icons with `node tools/pack-map-navigation.cjs` (requires `sharp`).

## Integration and verification

The level selector slides between forest stops 1–5 and cave stops 6–10. Cave stops are inspectable previews, with no battle URL or progress mutation. Existing saves and playable stages are preserved. Page Up / Page Down switch maps when a stage is focused; Home / End and arrow keys navigate the current page. Reduced-motion settings disable the slide animation.

Run `node tools/check-map-pages.cjs` with the local server on port 4173 and Playwright/Edge installed. Browser screenshots in this folder cover the forest page, cavern page, slide transition and mobile layout.

## Map prompt

Use case: precise-object-edit. Asset type: 2:1 landscape pixel-art level selection map background for a fantasy tower defense game. Edit the provided reference, retaining its composition, pixel art texture, dark cavern, turquoise waterfalls, rope bridges, orange torches, bones, red skull banners, and throne in upper right. Remove ONLY the five numbered level marker flags 6,7,8,9,10, their round stone pedestals and all fifteen gold rating stars, seamlessly replace them with bare walkable ochre path. Keep the open road areas centered near (11.6%,34%), (31.6%,36%), (47.8%,72%), (67.3%,49%), (87.5%,46%) of the image; the app will overlay live UI there. Keep winding connected routes through these five areas, the bridges and decorative skull flags. No numbers, no lettering, no UI icons, no rating stars, no level marker pedestals. Full bleed wide 2:1 map, crisp richly detailed pixel art, no border, no watermark.

## UI sprite prompt

Use case: background-extraction. Asset type: transparent game UI sprite sheet. Inputs: image 1 is reference for two wooden navigation buttons, image 2 is reference for a hanging level flag. Create THREE separate crisp pixel-art sprites arranged left to right in three equal cells on one wide transparent canvas. Left cell: square wooden left arrow button exactly matching first reference, amber arrow, dark outline, four silver rivets. Center cell: corresponding square wooden right arrow button. Right cell: hanging brown-orange pennant matching second reference, BUT blank with no digit or lettering, no pedestal or stars. Large clear empty transparent margins between sprites, all three fully inside their own cells, no overlap. Maintain original warm wood pixel textures and proportions; buttons same size, flag similar height. No labels, no text, no numbers. Output genuine transparent alpha background, no white or checkerboard.
