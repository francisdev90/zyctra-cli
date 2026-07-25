#!/usr/bin/env node
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import path from 'path'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const dotenv = require('dotenv')
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { program } from 'commander'
import { chat } from '../src/commands/chat.js'
import { login } from '../src/commands/login.js'
import { logout } from '../src/commands/logout.js'
import { fix } from '../src/commands/fix.js'
import { explain } from '../src/commands/explain.js'
import { commit } from '../src/commands/commit.js'

program
  .name('zyctra')
  .description('Zyctra AI assistant for your terminal')
  .version('1.0.0')

program
  .command('login')
  .description('Login to your Zyctra account')
  .action(login)

program
  .command('logout')
  .description('Logout from Zyctra')
  .action(logout)

program
  .command('fix [file]')
  .description('Scan and fix bugs in a file or current directory')
  .action(fix)

program
  .command('explain [file]')
  .description('Explain what a file does')
  .action(explain)

program
  .command('commit')
  .description('Generate a smart git commit message')
  .action(commit)

// Default: open interactive chat
program
  .argument('[prompt]', 'Ask Zyctra anything')
  .action(chat)

program.parse()
