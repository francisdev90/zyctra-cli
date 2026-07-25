# Zyctra CLI

AI that remembers you — in your terminal.

## Install

```bash
npm install -g zyctra
```

## Setup

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=your_key_here
```

Then log in with your Zyctra account:

```bash
zyctra login
```

## Commands

### Chat

Start an interactive AI chat session:

```bash
zyctra
```

Or send a one-shot message:

```bash
zyctra "How do I reverse a string in Python?"
```

### Fix

Analyse a file for bugs and get a fixed version:

```bash
zyctra fix src/app.js
```

### Explain

Get a plain-English explanation of any code file:

```bash
zyctra explain src/utils.ts
```

### Commit

Generate a git commit message from your staged changes:

```bash
git add .
zyctra commit
```

### Login / Logout

```bash
zyctra login
zyctra logout
```

## AI Engines

Zyctra has three engines you can switch between:

| Engine | Model | Best for |
|--------|-------|----------|
| `zev`   | Claude Haiku  | Fast, lightweight tasks |
| `vora`  | Claude Sonnet | Balanced (default) |
| `talyn` | Claude Opus   | Complex reasoning |

Switch engine in chat by typing `/engine vora` (coming soon).

## Built by

[Francis Shakur](https://francisshakur.com) · [Zyctra](https://zyctra.com)
