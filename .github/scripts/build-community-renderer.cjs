// Build the still-image renderer from the current app's own 3D scene.
// Usage: node .github/scripts/build-community-renderer.cjs /path/to/cardiaworld-app
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const appRoot = path.resolve(process.argv[2]);
const fromApp = createRequire(path.join(appRoot, 'package.json'));
const ts = fromApp('typescript');
const { buildSync } = fromApp('esbuild');
const filename = path.join(appRoot, 'src/components/WorldPreview.tsx');
const text = fs.readFileSync(filename, 'utf8');
const source = ts.createSourceFile(filename, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
const createWorld = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createWorldHtml');
if (!createWorld) throw Error('App scene generator could not be located');

const deps = new Set([
  'CINEMATIC_WORLD', 'ROAD_TRAFFIC', 'PRONOUNCED_CUSTOMIZATIONS', 'LOCAL_TIME_WORLD',
  'CONSTRUCTION_WORLD', 'DYNAMIC_WORLD', 'plannedStructures', 'HEADQUARTERS_WORLD',
  'normalizeHeadquarters', 'normalizePlaceNames', 'THREE_RUNTIME', 'REALISTIC_PLANET',
  'REALISTIC_WORLDS', 'REALISTIC_SITES', 'WORLD_LAYOUTS', 'WORLD_SURFACE_SETUP',
  'WORLD_WATER_VERTEX', 'WORLD_WATER_FRAGMENT', 'scriptSafeJson', 'deteriorationAppearance',
  'boundedWorldPoints', 'worldConstructionStage', 'WORLD_DETERIORATION', 'ADVENTURE_WORLD',
  'LIFE_WORLD', 'normalizeLifeVisuals',
]);
const imports = source.statements.flatMap(node => {
  if (!ts.isImportDeclaration(node)) return [];
  const bindings = node.importClause?.namedBindings;
  if (!bindings || !ts.isNamedImports(bindings)) return [];
  const used = bindings.elements.filter(item => deps.delete(item.name.text));
  return used.length ? [`import { ${used.map(item => item.getText(source)).join(', ')} } from ${node.moduleSpecifier.getText(source)};`] : [];
});
if (deps.size) throw Error('App renderer imports changed: ' + [...deps].join(', '));

buildSync({
  stdin: {
    contents: imports.join('\n') + '\n' + createWorld.getText(source) + `
      export function snapshotHtml(world) {
        const stage = worldConstructionStage(world.days, world.points);
        const damage = deteriorationAppearance(world.health);
        return createWorldHtml(
          world.id, stage, world.points, world.health, world.population, false, world.days,
          damage.environmentCap, damage.happinessCap, [], [], world.customization, damage.weather,
          false, 'world', world.damage, 0,
          { lab: world.lab, structures: world.research, mailbox: world.namingDays >= 3 },
          false, undefined, { level: world.level, unlockedLevel: world.level }, undefined,
          world.namingDays, undefined, true, 'noon', true, world.life
        );
      }
    `,
    sourcefile: filename,
    resolveDir: path.dirname(filename),
    loader: 'ts',
  },
  bundle: true,
  minify: true,
  target: 'es2020',
  format: 'esm',
  outfile: path.resolve(__dirname, '../../assets/community-world-renderer.mjs'),
  banner: { js: '// Generated from Cardia World WorldPreview.tsx. See .github/scripts/build-community-renderer.cjs.' },
});
