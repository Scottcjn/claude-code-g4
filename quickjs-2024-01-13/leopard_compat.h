/*
 * Leopard Compatibility Header for QuickJS — PowerPC G5 (970) variant
 * =====================================================================
 * Target: Mac OS X Leopard 10.5 (Darwin 9) on a PowerPC G5 (970).
 *
 * Leopard is newer than Tiger (10.4): it ships Python 2.5 and a 64-bit
 * userland, and the G5 is a 64-bit ppc64 chip with AltiVec. Two consequences
 * for this build vs. the G4/Tiger one:
 *
 *   - clock_gettime() is STILL absent (it doesn't arrive until macOS 10.12),
 *     so we keep the gettimeofday() shim.
 *   - QuickJS compiles its js_atomics_op() code whenever CONFIG_ATOMICS is
 *     *defined* (even as 0), so the atomic_* names must always resolve. We keep
 *     the single-threaded stub macros below for every toolchain (the
 *     SharedArrayBuffer/Atomics JS feature is off, so they're never hot). This
 *     compiles cleanly under both Leopard's system GCC 4.0.1 and a modern
 *     /usr/local/gcc-10 — gcc-10 is used purely for faster codegen, not for
 *     swapping in real C11 atomics (which would be unused anyway).
 */

#ifndef LEOPARD_COMPAT_H
#define LEOPARD_COMPAT_H

#include <stdint.h>
#include <sys/time.h>
#include <time.h>

/* SharedArrayBuffer/Atomics JS feature not needed for Claude Code. */
#ifndef CONFIG_ATOMICS
#define CONFIG_ATOMICS 0
#endif

/*
 * No <stdatomic.h> on the system GCC 4.0.1; QuickJS only touches these in
 * single-threaded paths here, so map them to plain memory ops on every
 * toolchain (Atomics is disabled, so they're never used concurrently).
 */
#define _Atomic(T) T
#define atomic_load(p) (*(p))
#define atomic_store(p, v) (*(p) = (v))
#define atomic_fetch_add(p, v) ((*(p)) += (v), (*(p)) - (v))
#define atomic_fetch_sub(p, v) ((*(p)) -= (v), (*(p)) + (v))
#define atomic_fetch_and(p, v) ((*(p)) &= (v), (*(p)))
#define atomic_fetch_or(p, v) ((*(p)) |= (v), (*(p)))
#define atomic_fetch_xor(p, v) ((*(p)) ^= (v), (*(p)))
#define atomic_exchange(p, v) ({ typeof(*(p)) _old = *(p); *(p) = (v); _old; })
#define atomic_compare_exchange_strong(p, expected, desired) \
    (*(p) == *(expected) ? (*(p) = (desired), 1) : (*(expected) = *(p), 0))

/* clock_gettime() — absent on Leopard (arrives in macOS 10.12). */
#ifndef CLOCK_REALTIME
#define CLOCK_REALTIME 0
#define CLOCK_MONOTONIC 1

static inline int clock_gettime(int clk_id, struct timespec *tp) {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    tp->tv_sec = tv.tv_sec;
    tp->tv_nsec = tv.tv_usec * 1000;
    return 0;
}
#endif

#endif /* LEOPARD_COMPAT_H */
