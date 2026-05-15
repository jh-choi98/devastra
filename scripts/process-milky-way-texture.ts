/**
 * Processes the raw Pexels Milky Way photograph into:
 *   - public/textures/milky-way.webp        (4096×2867, q≈0.85)
 *   - public/textures/milky-way@2x.webp     (8192×5734, q≈0.80) — for high-DPR
 *   - public/textures/milky-way-fallback.jpg (1200×840, q≈0.80) — for the OG SVG embed
 *
 * Processing steps:
 *   1. Read source from public/textures/source/milky-way-pexels-29746501.jpg
 *   2. Crop to 10:7 aspect (matches viewBox 1000x700). Bias the crop so the
 *      galactic core falls on the right ~30% of the frame.
 *   3. Apply warm color grade — gentle channel mixer:
 *        R *= 1.06, G *= 1.00, B *= 0.92, then mild saturation reduction (~0.85x)
 *   4. Light Gaussian blur (radius 0.3 px) to soften pixel noise.
 *   5. Encode the three outputs at the listed resolutions / quality.
 *
 * Use `sharp` for image processing (add it as a devDependency if missing).
 */

import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const SRC = `${ROOT}/public/textures/source/milky-way-pexels-29746501.jpg`
const OUT = `${ROOT}/public/textures`

// Source: 7008×4672. Target aspect: 10:7 → height = width * 0.7
// Max crop width at full height: floor(4672 / 0.7) = 6674
// Horizontal slack: 7008 - 6674 = 334px
// Bias toward the right side so the galactic core lands in the right ~30% of the crop.
const CROP = {
  left: 334, // start from right end of the slack
  top: 0,
  width: 6674,
  height: 4672,
}

async function run() {
  console.log('Source:', SRC)
  console.log('Crop:', JSON.stringify(CROP))

  const meta = await sharp(SRC).metadata()
  console.log(`Source dimensions: ${meta.width}×${meta.height}`)

  // Base pipeline: crop + color grade + blur
  // recomb matrix: R_out = 1.06*R, G_out = 1.00*G, B_out = 0.92*B
  const base = () =>
    sharp(SRC)
      .extract(CROP)
      .recomb([
        [1.06, 0, 0],
        [0, 1.0, 0],
        [0, 0, 0.92],
      ])
      .modulate({ saturation: 0.85 })
      .blur(0.3)

  // 1x WebP (4096×2867)
  await base()
    .resize(4096, 2867, { fit: 'fill' })
    .webp({ quality: 85 })
    .toFile(`${OUT}/milky-way.webp`)
  console.log('Written: milky-way.webp')

  // 2x WebP (8192×5734)
  await base()
    .resize(8192, 5734, { fit: 'fill' })
    .webp({ quality: 80 })
    .toFile(`${OUT}/milky-way@2x.webp`)
  console.log('Written: milky-way@2x.webp')

  // Fallback JPEG (1200×840)
  await base()
    .resize(1200, 840, { fit: 'fill' })
    .jpeg({ quality: 80 })
    .toFile(`${OUT}/milky-way-fallback.jpg`)
  console.log('Written: milky-way-fallback.jpg')

  const output = {
    source: 'public/textures/source/milky-way-pexels-29746501.jpg',
    sourceDimensions: { width: meta.width, height: meta.height },
    crop: CROP,
    outputs: [
      { file: 'public/textures/milky-way.webp', width: 4096, height: 2867, quality: 85 },
      { file: 'public/textures/milky-way@2x.webp', width: 8192, height: 5734, quality: 80 },
      { file: 'public/textures/milky-way-fallback.jpg', width: 1200, height: 840, quality: 80 },
    ],
  }

  const outputPath = `${ROOT}/tasks/2-stellarium-redesign/phase5-output.json`
  writeFileSync(outputPath, JSON.stringify(output, null, 2))
  console.log('phase5-output.json written')
  console.log(JSON.stringify(output))
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
