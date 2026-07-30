---
name: omniroute
description: Set up and manage the OmniRoute CLI AI gateway. Run initial setup, configure global CLI tool settings (Claude Code, Codex, Cursor, OpenCode, etc.), manage environment variables, check for and apply updates, and configure autostart via the omniroute setup and config commands.
---
<!-- Source: OmniRoute cli-setup skill (https://github.com/diegosouzapw/OmniRoute) -->

## Overview

OmniRoute is a free MIT-licensed local AI gateway: one Anthropic-compatible
endpoint fronting 290+ providers (90+ free) and 500+ models (Kimi, Claude, GPT,
Gemini, GLM, DeepSeek, MiniMax). It works with Claude Code, Codex, Cursor,
OpenCode, Cline, and Copilot, with quota-aware auto-fallback and token
compression.

This skill covers running initial setup, configuring global CLI settings,
managing environment variables, checking for updates, and configuring autostart
via the CLI `setup` and `config` commands.

## Quick install

```bash
npm install -g omniroute   # or: npx omniroute
omniroute --version
```

Once running, the Dashboard is available at http://localhost:20128 and an
Anthropic-compatible API at http://localhost:20128/v1.

## Subcommands

### `setup`

Run the interactive first-time setup wizard.

**Flags:**

- `--password <value>`
- `--add-provider`
- `--provider <id>`
- `--provider-name <name>`
- `--api-key <value>`
- `--default-model <model>`
- `--provider-base-url <url>`
- `--test-provider`
- `--non-interactive`
- `--list`

**Example:**

```bash
omniroute setup
```

### `config`

Show or update CLI tool configuration.

**Example:**

```bash
omniroute config
```

### `config list`

List all CLI tools and config status.

**Flags:**

- `--json`

**Example:**

```bash
omniroute config list
```

### `config get <tool>`

Show current config for a tool.

**Flags:**

- `--json`

**Example:**

```bash
omniroute config get <tool>
```

### `config set <tool>`

Write config for a tool.

**Flags:**

- `--model <model>`
- `--non-interactive`
- `--yes`

**Example:**

```bash
omniroute config set <tool>
```

### `config validate <tool>`

Validate config format without writing.

**Flags:**

- `--model <model>`
- `--json`

**Example:**

```bash
omniroute config validate <tool>
```

### `config opencode`

Generate OpenCode config.

**Flags:**

- `--model <model>`
- `--non-interactive`
- `--yes`

**Example:**

```bash
omniroute config opencode
```

### `config lang`

Show or set the CLI language.

**Example:**

```bash
omniroute config lang
```

### `env`

Show and manage environment variables.

**Example:**

```bash
omniroute env
```

### `env show`

Show current environment variables.

**Flags:**

- `--json`

**Example:**

```bash
omniroute env show
```

### `env get <key>`

Get a single environment variable.

**Example:**

```bash
omniroute env get <key>
```

### `env set <key> <value>`

Set an environment variable (current session only).

**Example:**

```bash
omniroute env set <key> <value>
```

### `autostart`

Show autostart status and options.

**Example:**

```bash
omniroute autostart
```

### `autostart enable`

**Example:**

```bash
omniroute autostart enable
```

### `autostart disable`

**Example:**

```bash
omniroute autostart disable
```

### `autostart toggle`

**Example:**

```bash
omniroute autostart toggle
```

### `autostart status`

**Example:**

```bash
omniroute autostart status
```

### `update`

Check for and apply CLI updates.

**Flags:**

- `--check`
- `--apply`
- `--changelog`
- `--dry-run`
- `--no-backup`
- `--yes`

**Example:**

```bash
omniroute update
```
