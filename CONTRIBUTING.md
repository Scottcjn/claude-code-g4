# Contributing

Thanks for helping improve Claude Code for PowerPC G4 systems. This repository
targets older Mac OS X environments, so compatibility and clear documentation
matter more than broad refactors.

## Local Setup

Clone the repository:

```bash
git clone https://github.com/Scottcjn/claude-code-g4.git
cd claude-code-g4
```

Read the README and existing scripts before changing behavior. If you cannot
test on PowerPC hardware, state that clearly in the pull request.

## Contribution Guidelines

- Preserve compatibility with the documented Mac OS X and PowerPC targets.
- Avoid introducing dependencies that are unavailable on the target systems.
- Keep scripts readable and reversible.
- Update documentation when changing setup, TLS, runtime, or troubleshooting
  behavior.
- Prefer small pull requests with one compatibility or documentation goal.

## Validation

For documentation-only changes:

```bash
git diff --check
```

For script changes, run any syntax checks available in your environment and
describe the target hardware or emulator used for testing.

## Pull Request Checklist

- Summarize the compatibility impact.
- Include validation commands and environment details.
- Note any untested target hardware.
- Link the related issue or bounty, if applicable.
