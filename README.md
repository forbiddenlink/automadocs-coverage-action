# AutomaDocs documentation coverage

Show your repository's documentation coverage in every job summary, and fail
the build when it drops below a threshold you choose.

```yaml
- uses: forbiddenlink/automadocs-coverage-action@v1
  with:
    api-key: ${{ secrets.AUTOMADOCS_API_KEY }}
    min-coverage: 70
```

Create an [API key](https://automadocs.com/settings/api?utm_source=github-action&utm_medium=marketplace)
and store it as a repository secret named `AUTOMADOCS_API_KEY`. Leave
`min-coverage` out to report without gating.

## Full workflow

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

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `api-key` | yes | | AutomaDocs API key, from a repository secret |
| `repository` | no | `${{ github.repository }}` | Repository to report on, as an id or `owner/name` |
| `api-url` | no | `https://api.automadocs.com` | Override for self-hosted installs |
| `min-coverage` | no | | Fail the step below this score (0-100) |
| `fail-on-error` | no | `true` | Set `false` to warn and pass when the API errors or returns no score. A score below `min-coverage` still fails |
| `summary` | no | `true` | Write the coverage table to the job summary |
| `show-upgrade-link` | no | `true` | End the job summary with one link to automadocs.com. Set `false` to omit it |

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

## Example output

The job summary looks like this:

> ## AutomaDocs coverage
>
> **acme/api**: 72%
>
> | Area | Score |
> | --- | ---: |
> | readme | 100% |
> | functions | 55% |
>
> 2 undocumented item(s):
>
> - handleWebhook
> - parseConfig
>
> Keep docs current on every push with [AutomaDocs](https://automadocs.com/?utm_source=github-action&utm_medium=marketplace).

## Requirements

The repository has to be documented on AutomaDocs first. The action reads
coverage, it does not generate documentation. Connect the repository at
[automadocs.com](https://automadocs.com), then point this action at it.

## Want more?

This action reads coverage. [AutomaDocs](https://automadocs.com/?utm_source=github-action&utm_medium=marketplace)
generates the documentation from your code, refreshes it on every push, and
lets your team ask questions about the codebase with cited answers. There is a
free plan for one public repository; Pro ($49/month) covers 20 repositories and
Team ($149/month) adds unlimited repositories, custom domains and SSO.

## Versioning

Reference the action by major tag, `forbiddenlink/automadocs-coverage-action@v1`. The tags `v1` and `v1.0.0` exist; `v1` moves forward with fixes. The action is dependency-free (no `@actions/core`, no vendored `node_modules`): `src/` runs as-is on the `node24` runner.

## Development

```bash
npm test   # node --test test/*.test.js, no dependencies (Node 20 or later)
```

## License

MIT. See [LICENSE](LICENSE).
