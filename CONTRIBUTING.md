# Contributing

Thanks for helping keep Claude Code experiments alive on PowerPC G4/G5 Macs.
This repository targets Mac OS X Tiger and Leopard, so compatibility notes and
real hardware validation matter more than broad modernizations.

## Getting Started

1. Read `README.md` for the supported runtime paths: Python with a TLS proxy and
   QuickJS on PowerPC.
2. Review `quickjs-2024-01-13/Makefile.ppc` before changing QuickJS build flags.
3. Work on a focused branch:

   ```bash
   git checkout -b your-change-name
   ```

## Development Workflow

Keep pull requests scoped to one area:

- Python client or proxy helpers.
- QuickJS Tiger/Leopard compatibility changes.
- Documentation for vintage Mac setup and tested hardware.
- Packaging or vendored Claude Code assets.

Avoid replacing vintage-compatible code with modern-only dependencies. If a
change requires newer Python, OpenSSL, libc, or compiler behavior, call that out
explicitly.

## Validation

For QuickJS changes, include the build command you ran, for example:

```bash
cd quickjs-2024-01-13
make -f Makefile.ppc
```

For runtime changes, include:

- Mac model, CPU, RAM, and OS version.
- Compiler or Python version.
- Whether testing happened on Tiger, Leopard, or a modern host.
- Proxy/TLS setup if network calls were tested.
- Any failing tests or features that remain unsupported.

## Code Style

- Preserve compatibility with old PowerPC toolchains unless the PR is explicitly
  documenting a modern-host-only helper.
- Keep shell and Python examples copy-pasteable for Tiger/Leopard users.
- Avoid introducing large dependencies into the vintage runtime path.
- Document non-obvious PowerPC, endian, TLS, or QuickJS constraints.

## Pull Request Checklist

Before opening a PR, include:

- A short summary of the runtime path affected.
- Exact build or run commands.
- Hardware and OS used for validation.
- Known limitations and follow-up work.
- Links to related vintage Mac or QuickJS compatibility references.

