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
| `fail-on-error` | no | `true` | Set `false` to warn and pass when the API errors or returns no score. A score below `min-coverage` still fails |
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

The repository has to be documented on AutomaDocs first. The action reads
coverage, it does not generate documentation. Connect the repository at
[automadocs.com](https://automadocs.com), then point this action at it.

## Versioning

Reference the action by major tag, `forbiddenlink/automadocs-coverage-action@v1`. The tags `v1` and `v1.0.0` exist; `v1` moves forward with fixes. The action is dependency-free (no `@actions/core`, no vendored `node_modules`): `src/` runs as-is on the `node24` runner.

## Development

```bash
npm test   # node --test test/*.test.js, no dependencies (Node 20 or later)
```

## License

MIT. See [LICENSE](LICENSE).
