/*
 * Tiger/Leopard Compatibility Header for QuickJS
 * Provides stubs for C11 atomics and clock_gettime
 */

#ifndef TIGER_COMPAT_H
#define TIGER_COMPAT_H

#include <stdint.h>
#include <sys/time.h>

/* Disable SharedArrayBuffer/Atomics - not needed for Claude Code */
#ifndef CONFIG_ATOMICS
#define CONFIG_ATOMICS 0
#endif

/* Stub out stdatomic.h */
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

/* clock_gettime for Tiger/Leopard */
#include <time.h>

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

#endif /* TIGER_COMPAT_H */
