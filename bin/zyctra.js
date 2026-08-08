#!/usr/bin/env node
import { program } from 'commander'
import { chat } from '../src/commands/chat.js'
import { login } from '../src/commands/login.js'
import { logout } from '../src/commands/logout.js'
import { fix } from '../src/commands/fix.js'
import { explain } from '../src/commands/explain.js'
import { read } from '../src/commands/read.js'
import { commit } from '../src/commands/commit.js'
import { signup } from '../src/commands/signup.js'
import { plans } from '../src/commands/plans.js'
import { scan } from '../src/commands/scan.js'
import { write } from '../src/commands/write.js'
import { editFile } from '../src/commands/edit.js'

program
  .name('zyctra')
  .description('Zyctra AI assistant for your terminal')
  .version('1.1.0')

program
  .command('login')
  .description('Login to your Zyctra account')
  .action(login)

program
  .command('logout')
  .description('Logout from Zyctra')
  .action(logout)

program
  .command('fix <file>')
  .description('Scan and fix bugs in a file')
  .option('--write', 'Automatically write the fix back to the file')
  .action(fix)

program
  .command('explain [file]')
  .description('Explain what a file does')
  .action(explain)

program
  .command('commit')
  .description('Generate a smart git commit message')
  .action(commit)

program
  .command('signup')
  .description('Create a new Zyctra account')
  .action(signup)

program
  .command('read <file>')
  .description('Read and analyze any file — code, image, or PDF')
  .option('--fix', 'Generate code from the file or image')
  .action(read)

program
  .command('scan [folder]')
  .description('Scan and analyze an entire folder of code')
  .action(scan)

program
  .command('write <prompt>')
  .description('Generate and save a new file from a prompt')
  .option('--output <file>', 'Output file path')
  .action(write)

program
  .command('plans')
  .description('View Zyctra plans and pricing')
  .action(plans)

program
  .command('upgrade')
  .description('Upgrade your Zyctra plan')
  .action(plans)

program
  .command('edit <file> [instruction]')
  .description('Edit a file — shows a diff preview and asks before applying changes')
  .action(editFile)

// Default: open interactive chat
program
  .argument('[prompt]', 'Ask Zyctra anything')
  .action(chat)

program.parse()
