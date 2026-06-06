export {}

const mod = await import('../dist/index.js')

if (mod.FIG_PACKAGE_STATUS !== 'scaffold') {
  throw new Error('Expected @open-pencil/fig scaffold export')
}
