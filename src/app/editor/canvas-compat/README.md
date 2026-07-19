# Canvas Compatibility Layer

This app-only module isolates temporary canvas behavior fixes from the OpenPencil workspace packages.

## Scope

- Preserve world placement when pasting nodes between Frames.
- Remove recursive paste offsets applied to descendants.
- Preserve world geometry when reparenting through rotated containers.
- Provide Ctrl/Cmd + resize-handle image cropping without changing the Vue canvas SDK.

## Integration points

- `src/app/editor/session/create.ts` installs editor and SceneGraph instance wrappers.
- `src/components/EditorCanvas.vue` attaches the crop interaction before the standard canvas input handlers.

## Removal

When upstream behavior covers these cases, remove the two integration calls and delete this directory. No changes to `packages/core`, `packages/scene-graph`, or `packages/vue` are required by this layer.
