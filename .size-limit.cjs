const fs = require('node:fs')

function manifestFiles(manifestPath, selectFiles) {
  if (!fs.existsSync(manifestPath)) return []
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  return Array.from(new Set(selectFiles(manifest)))
    .filter((file) => file.endsWith('.js'))
    .map((file) => `.next/${file}`)
}

function appPageFiles(route) {
  return manifestFiles('.next/app-build-manifest.json', (manifest) => manifest.pages?.[route] ?? [])
}

function constellationFiles() {
  return manifestFiles('.next/react-loadable-manifest.json', (manifest) =>
    Object.entries(manifest)
      .filter(([key]) => key.includes('app/_components/Constellation'))
      .flatMap(([, value]) => value.files ?? []),
  )
}

module.exports = [
  {
    name: 'Home first-load app chunks',
    path: appPageFiles('/page').length
      ? appPageFiles('/page')
      : ['.next/static/chunks/app/page*.js'],
    limit: '250 KB',
  },
  {
    name: 'App layout client shell',
    path: ['.next/static/chunks/app/layout*.js'],
    limit: '70 KB',
  },
  {
    name: 'Constellation lazy chunks (WebGL + SVG fallback)',
    path: constellationFiles().length
      ? constellationFiles()
      : ['.next/static/chunks/constellation*.js'],
    limit: '300 KB',
  },
]
