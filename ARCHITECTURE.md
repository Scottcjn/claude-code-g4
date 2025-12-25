# Claude Code G4 - Architecture Design

## Overview
Port of Claude Code CLI to PowerPC G4/G5 Macs running Mac OS X Tiger (10.4) and Leopard (10.5).

## Target Systems
| System | OS | Python | RAM | Status |
|--------|-----|--------|-----|--------|
| Dual G4 (192.168.0.125) | Tiger 10.4.12 | 3.10 | 2GB | Primary target |
| G5 (192.168.0.130) | Leopard 10.5.8 | 2.5.1/3.x | 6GB | Secondary |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Claude Code G4 CLI                      │
│            (Python 3.10 / rust-ppc-tiger)               │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   Prompt    │  │   Tools     │  │    Context      │  │
│  │   Handler   │  │  Executor   │  │    Manager      │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│              HTTP Client (mbedTLS 2.28 LTS)             │
│         (Bundled TLS - no system OpenSSL needed)        │
├─────────────────────────────────────────────────────────┤
│    AltiVec Optimizations        │    ripgrep PPC       │
│    - vec_perm token ops         │    - Code search     │
│    - Fast JSON parsing          │    - File matching   │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS (TLS 1.2+)
                          ▼
              ┌───────────────────────┐
              │  api.anthropic.com    │
              │     (Claude API)      │
              └───────────────────────┘
```

## Key Components

### 1. TLS Layer (mbedTLS)
From rust-ppc-tiger project - embedded mbedTLS 2.28 LTS:
- No dependency on Tiger's broken SSL
- TLS 1.2 support (required by Anthropic API)
- Can be wrapped with Python ctypes or used directly in Rust

### 2. HTTP Client
Options:
- **Python + ctypes**: Wrap mbedTLS shared library
- **Rust native**: Use rust-ppc-tiger with mbedTLS bindings
- **Proxy**: Route through NAS (192.168.0.160) for TLS termination

### 3. Tool Execution
Claude Code tools to implement:
- `Read` - File reading (Python native)
- `Write` - File writing (Python native)
- `Edit` - String replacement (Python native)
- `Bash` - Shell execution (subprocess)
- `Glob` - File pattern matching (fnmatch/glob)
- `Grep` - Content search (ripgrep PPC or Python re)

### 4. AltiVec Optimizations
From POWER8 work, adapted for G4:
```c
// G4 AltiVec vec_perm pattern (from ppc-tiger-tools)
static inline vector float altivec_dot_product(
    vector float *a, vector float *b, int n
) {
    vector float sum = vec_splats(0.0f);
    for (int i = 0; i < n; i++) {
        sum = vec_madd(a[i], b[i], sum);
    }
    // Horizontal sum
    sum = vec_add(sum, vec_sld(sum, sum, 8));
    sum = vec_add(sum, vec_sld(sum, sum, 4));
    return sum;
}
```

### 5. Streaming Response Handler
- SSE (Server-Sent Events) parsing for real-time token display
- Buffer management for partial JSON chunks
- Progress indicators

## Implementation Phases

### Phase 1: Basic API Client (Python)
- [ ] Python 3.10 HTTP client with mbedTLS
- [ ] Claude API authentication
- [ ] Simple prompt/response

### Phase 2: Tool Execution
- [ ] File read/write/edit
- [ ] Shell command execution
- [ ] Grep/glob for search

### Phase 3: Interactive CLI
- [ ] Readline-based input
- [ ] Conversation history
- [ ] Streaming output

### Phase 4: AltiVec Acceleration
- [ ] Port POWER8 vec_perm patterns to G4
- [ ] Fast token processing
- [ ] Optional local inference support

## Files from Existing Projects

### From ppc-tiger-tools:
- `openssl_tls12_shim.c` - TLS 1.2 shim (if using system SSL)
- `tls12_system_shim.c` - System-level TLS layer
- `altivec_http_service.c` - AltiVec HTTP patterns
- `g4_chat.c` - G4 chat client with AltiVec

### From rust-ppc-tiger:
- `cargo_ppc.sh` - Cargo wrapper for PPC builds
- mbedTLS integration code
- AltiVec code generation

### From claude-code-power8:
- Full Claude Code package structure
- ripgrep PPC binary pattern
- Platform detection code

## Build Commands

### Python approach (Tiger G4):
```bash
# On G4 (192.168.0.125)
export PATH="/opt/local/bin:$PATH"
python3.10 claude_code_g4.py
```

### Rust approach:
```bash
# Using rust-ppc-tiger
./cargo_ppc.sh build --release
./target/release/claude-code-g4
```

## Environment Variables
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export CLAUDE_CODE_G4_DEBUG=1  # Optional debug output
```

## Notes

### Why mbedTLS?
Tiger's OpenSSL is stuck at 0.9.7 (no TLS 1.2). The rust-ppc-tiger project solved this by embedding mbedTLS 2.28 LTS directly - same approach Firefox used for PocketFox.

### Memory Considerations
- G4 has 2GB RAM - need to be efficient
- Streaming responses instead of buffering
- Lazy loading of components

### AltiVec vs VSX
- G4 has AltiVec (128-bit SIMD)
- POWER8 has VSX (more instructions)
- Core vec_perm patterns are similar
- Need to remove POWER8-specific intrinsics (vec_bperm, etc.)
