# @bgicli/skillhub

SkillHub CLI — install, update, search, and publish agent skills as folders.

## Install

```bash
# Install globally
npm install -g @bgicli/skillhub

# Or use npx (no install)
npx @bgicli/skillhub@latest --help
```

## Quick Start

```bash
# Search for skills
skillhub search "data analysis"

# Install a skill
skillhub install python-data-analysis

# List installed skills
skillhub list

# Update all skills
skillhub update --all
```

## Auth (for publishing)

```bash
# Login with browser
skillhub login

# Or use existing token
skillhub login --token clh_...
```

## Commands

| Command | Description |
|---------|-------------|
| `search <query>` | Vector search skills |
| `install <slug>` | Install a skill |
| `list` | List installed skills |
| `update [slug]` | Update installed skills |
| `uninstall <slug>` | Remove a skill |
| `publish <path>` | Publish a skill from folder |
| `sync` | Scan and sync local skills |
| `whoami` | Check login status |

## Environment Variables

```bash
SKILLHUB_SITE=https://clawhub.ai      # Registry site URL
SKILLHUB_REGISTRY=<api-url>           # Direct registry override
SKILLHUB_WORKDIR=<path>               # Working directory
```

## Examples

### Publish a skill

```bash
skillhub publish ./my-skill \
  --slug my-skill \
  --name "My Skill" \
  --version 1.0.0 \
  --changelog "Initial release"
```

### Sync local skills

```bash
# Interactive sync
skillhub sync

# Non-interactive dry-run
skillhub sync --all --dry-run
```

## License

MIT
