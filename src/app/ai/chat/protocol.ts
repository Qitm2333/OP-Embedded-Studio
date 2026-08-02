const DSML_TOOL_MARKUP = /<\s*\|\s*DSML\s*\|\s*(?:tool_calls|invoke|parameter)\b/i

export function isLeakedToolProtocol(text: string): boolean {
  return DSML_TOOL_MARKUP.test(text.normalize('NFKC'))
}
