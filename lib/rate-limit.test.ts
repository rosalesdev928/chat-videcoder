import { describe, expect, it } from "vitest";
import { createRateLimiter, rateLimitHeaders } from "./rate-limit";

function fakeClock(start = 0) {
  let time = start;
  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe("createRateLimiter", () => {
  it("allows up to `limit` requests per window", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: clock.now });

    expect(limiter.check("user").remaining).toBe(2);
    expect(limiter.check("user").remaining).toBe(1);
    expect(limiter.check("user")).toMatchObject({ allowed: true, remaining: 0 });

    const blocked = limiter.check("user");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(60);
  });

  it("counts each key separately", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: fakeClock().now });

    expect(limiter.check("alice").allowed).toBe(true);
    expect(limiter.check("alice").allowed).toBe(false);
    expect(limiter.check("bob").allowed).toBe(true);
  });

  it("resets after the window", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: clock.now });

    limiter.check("user");
    clock.advance(400);
    expect(limiter.check("user")).toMatchObject({ allowed: false, retryAfter: 1 });

    clock.advance(600);
    expect(limiter.check("user").allowed).toBe(true);
  });

  it("prunes expired keys instead of growing forever", () => {
    const clock = fakeClock();
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 1000,
      now: clock.now,
      maxKeys: 2,
    });

    limiter.check("a");
    limiter.check("b");
    clock.advance(1000);
    // "a" and "b" expired: the map is pruned and "c" starts a fresh window
    expect(limiter.check("c").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(true);
  });
});

describe("rateLimitHeaders", () => {
  it("adds Retry-After only when the request is blocked", () => {
    expect(
      rateLimitHeaders({ allowed: true, limit: 10, remaining: 9, retryAfter: 30 })
    ).toEqual({ "X-RateLimit-Limit": "10", "X-RateLimit-Remaining": "9" });

    expect(
      rateLimitHeaders({ allowed: false, limit: 10, remaining: 0, retryAfter: 30 })
    ).toMatchObject({ "Retry-After": "30" });
  });
});
