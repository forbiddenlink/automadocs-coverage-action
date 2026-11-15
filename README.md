# AutomaDocs coverage action

Report AutomaDocs documentation coverage on every push or pull request, and
optionally fail the build when it drops below a threshold.

## Usage

Store an [API key](https://automadocs.com/settings/api) as a repository
secret, then add a step:

```yaml
name: Docs

on:
  pull_request:
  push:
    branches: [main]

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: forbiddenlink/automadocs-coverage-action@v1
        with:
          api-key: ${{ secrets.AUTOMADOCS_API_KEY }}
          min-coverage: 70
```

The step writes a coverage table to the job summary and fails when coverage is
below `min-coverage`. Leave `min-coverage` out to report without gating.

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `api-key` | yes | | AutomaDocs API key, from a repository secret |
| `repository` | no | `${{ github.repository }}` | Repository to report on, as an id or `owner/name` |
| `api-url` | no | `https://api.automadocs.com` | Override for self-hosted installs |
| `min-coverage` | no | | Fail the step below this score (0-100) |
| `summary` | no | `true` | Write the coverage table to the job summary |

## Outputs

| Output | Description |
| --- | --- |
| `score` | Overall coverage score (0-100) |
| `repository-id` | AutomaDocs id of the repository reported on |
| `undocumented-count` | Number of undocumented items found |

Use them in later steps:

```yaml
      - uses: forbiddenlink/automadocs-coverage-action@v1
        id: docs
        with:
          api-key: ${{ secrets.AUTOMADOCS_API_KEY }}
      - run: echo "Coverage is ${{ steps.docs.outputs.score }}%"
```

## Requirements

The repository has to be documented on AutomaDocs first — the action reads
coverage, it does not generate documentation. Connect the repository at
[automadocs.com](https://automadocs.com), then point this action at it.

## Publishing

GitHub Marketplace serves an action from the root of its own repository, so
this directory is mirrored to `automadocs/coverage-action` and tagged there.
It is dependency-free on purpose: `src/` runs as-is on the `node24` runner with
nothing vendored.

## Development

```bash
npm test   # node --test, no dependencies
```
