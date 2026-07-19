export type LayerTreeDisplayOrder = 'document' | 'front-first'

export function orderedLayerChildIds(
  childIds: readonly string[],
  displayOrder: LayerTreeDisplayOrder
): readonly string[] {
  return displayOrder === 'front-first' ? [...childIds].reverse() : childIds
}

export function layerDropInsertIndex(
  childIds: readonly string[],
  sourceId: string,
  targetId: string,
  position: 'above' | 'below',
  displayOrder: LayerTreeDisplayOrder
): number | null {
  if (displayOrder === 'document') {
    const targetIndex = childIds.indexOf(targetId)
    if (targetIndex === -1) return null
    return position === 'above' ? targetIndex : targetIndex + 1
  }

  const siblings = childIds.filter((id) => id !== sourceId)
  const targetIndex = siblings.indexOf(targetId)
  if (targetIndex === -1) return null
  return position === 'above' ? targetIndex + 1 : targetIndex
}
