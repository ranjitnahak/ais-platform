/**
 * Dev utility: generate PWA icons and iOS splash screens from public/icons/icon.svg.
 * Run: node scripts/generate-icons.js
 */
import sharp from 'sharp'
import { mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const iconSvg = join(root, 'public/icons/icon.svg')
const iconsDir = join(root, 'public/icons')
const splashDir = join(root, 'public/splash')

const ICON_SIZES = [72, 96, 128, 144, 152, 167, 180, 192, 384, 512]

const SPLASH_SCREENS = [
  { width: 640, height: 1136, name: 'launch-640x1136.png' },
  { width: 750, height: 1334, name: 'launch-750x1334.png' },
  { width: 1125, height: 2436, name: 'launch-1125x2436.png' },
  { width: 1179, height: 2556, name: 'launch-1179x2556.png' },
  { width: 1290, height: 2796, name: 'launch-1290x2796.png' },
  { width: 1668, height: 2388, name: 'launch-1668x2388.png' },
  { width: 2048, height: 2732, name: 'launch-2048x2732.png' },
]

const SPLASH_BG = '#1C1C1E'
const SPLASH_ICON_SIZE = 192

async function generateIcons() {
  await mkdir(iconsDir, { recursive: true })

  for (const size of ICON_SIZES) {
    const out = join(iconsDir, `icon-${size}x${size}.png`)
    await sharp(iconSvg).resize(size, size).png().toFile(out)
    console.log(`  ${out}`)
  }
}

async function generateSplashes() {
  await mkdir(splashDir, { recursive: true })

  const iconBuffer = await sharp(iconSvg)
    .resize(SPLASH_ICON_SIZE, SPLASH_ICON_SIZE)
    .png()
    .toBuffer()

  for (const { width, height, name } of SPLASH_SCREENS) {
    const left = Math.floor((width - SPLASH_ICON_SIZE) / 2)
    const top = Math.floor((height - SPLASH_ICON_SIZE) / 2)
    const out = join(splashDir, name)

    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: SPLASH_BG,
      },
    })
      .composite([{ input: iconBuffer, left, top }])
      .png()
      .toFile(out)

    console.log(`  ${out}`)
  }
}

async function main() {
  console.log('Generating icons…')
  await generateIcons()
  console.log('Generating splash screens…')
  await generateSplashes()
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
