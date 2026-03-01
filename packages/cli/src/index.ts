#!/usr/bin/env bun
import { defineCommand, runMain } from 'citty'

import analyze from './commands/analyze'
import exportCmd from './commands/export'
import find from './commands/find'
import info from './commands/info'
import node from './commands/node'
import pages from './commands/pages'
import tree from './commands/tree'
import variables from './commands/variables'

const main = defineCommand({
  meta: {
    name: 'open-pencil',
    description: 'OpenPencil CLI — inspect, export, and lint .fig design files',
    version: '0.1.0'
  },
  subCommands: {
    analyze,
    export: exportCmd,
    find,
    info,
    node,
    pages,
    tree,
    variables
  }
})

runMain(main)
