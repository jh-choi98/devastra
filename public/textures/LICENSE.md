# Milky Way texture attribution

The Milky Way background texture used by the constellation renderer is derived from a Pexels photograph.

## Source

- **Photograph:** *Starry night sky capturing the Milky Way*
- **Photographer:** Giona Mason
- **URL:** https://www.pexels.com/photo/starry-night-sky-capturing-the-milky-way-29746501/
- **License:** [Pexels License](https://www.pexels.com/license/) — free to use, attribution recommended but not required, not for resale of unaltered copies.

The raw source is stored at `public/textures/source/milky-way-pexels-29746501.jpg` for reproducibility.

## Modifications (Phase 5)

Phase 5 of `tasks/2-stellarium-redesign/` will process the raw source into the final WebP assets used by the renderer:

- Crop to ~10:7 aspect (matching the constellation viewBox)
- Warm color grade toward sepia / ochre tones
- Light Gaussian blur (radius ≈ 0.3 px) to soften pixel-level noise
- Encode 4K WebP (`public/textures/milky-way.webp`) and high-DPR WebP (`public/textures/milky-way@2x.webp`)
- Encode JPG fallback for the OG image renderer (`public/textures/milky-way-fallback.jpg`)

The exact processing parameters used will be recorded in `tasks/2-stellarium-redesign/phase5-output.json`.

## Attribution policy

The Pexels License does not require in-product attribution. This file constitutes our public record of the source and license. If product UI is added later that surfaces credit (e.g. an "About" page), photographer name should be listed there as well.
