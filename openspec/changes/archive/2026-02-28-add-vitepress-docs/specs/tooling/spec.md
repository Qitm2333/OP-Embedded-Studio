## MODIFIED Requirements

### Requirement: Vite 7 build system
The project SHALL use Vite 7 as the build tool with dev server at port 1420 and HMR support. VitePress SHALL be installed as a devDependency for the documentation site. The `docs:dev`, `docs:build`, and `docs:preview` scripts SHALL be added to package.json.

#### Scenario: Dev server
- **WHEN** `bun run dev` is executed
- **THEN** Vite dev server starts at http://localhost:1420 with hot module replacement

#### Scenario: Docs scripts available
- **WHEN** `bun run docs:dev` is executed
- **THEN** VitePress dev server starts for the documentation site

#### Scenario: Docs build
- **WHEN** `bun run docs:build` is executed
- **THEN** VitePress builds the documentation site to `docs/.vitepress/dist/`

#### Scenario: Docs preview
- **WHEN** `bun run docs:preview` is executed
- **THEN** a static server previews the built documentation site
