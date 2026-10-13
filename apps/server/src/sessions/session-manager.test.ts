import { describe, expect, it } from "vitest";
import { FakeClock } from "../testing/fake-clock.js";
import { SessionManager, type SessionRecord } from "./session-manager.js";

function setup(graceMs = 1_000) {
  const clock = new FakeClock();
  const sessions = new SessionManager({ graceMs, clock });
  const expired: SessionRecord[] = [];
  sessions.onGraceExpired((record) => expired.push({ ...record }));
  return { clock, sessions, expired };
}

describe("SessionManager", () => {
  it("issues unguessable, distinct tokens and resolves them to the seat", () => {
    const { sessions } = setup();
    const a = sessions.issue("p1", "ROOM01");
    const b = sessions.issue("p2", "ROOM01");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sessions.resolve(a)).toMatchObject({ playerId: "p1", roomCode: "ROOM01" });
    expect(sessions.resolve("x".repeat(43))).toBeNull();
  });

  it("holds a lobby seat during the grace period and releases it afterwards", () => {
    const { sessions, clock, expired } = setup(1_000);
    sessions.issue("p1", "ROOM01");
    expect(sessions.disconnect("p1")).toBe(true);
    clock.advance(999);
    expect(expired).toEqual([]);
    clock.advance(1);
    expect(expired).toMatchObject([{ playerId: "p1", roomCode: "ROOM01" }]);
  });

  it("cancels the countdown when the player comes back in time", () => {
    const { sessions, clock, expired } = setup(1_000);
    sessions.issue("p1", "ROOM01");
    sessions.disconnect("p1");
    clock.advance(500);
    sessions.connect("p1");
    clock.advance(10_000);
    expect(expired).toEqual([]);
    expect(clock.pending).toBe(0);
  });

  it("does not start the countdown while another tab is still connected", () => {
    const { sessions, clock, expired } = setup(1_000);
    sessions.issue("p1", "ROOM01");
    sessions.connect("p1"); // second tab
    expect(sessions.disconnect("p1")).toBe(false);
    clock.advance(5_000);
    expect(expired).toEqual([]);
    expect(sessions.disconnect("p1")).toBe(true);
    clock.advance(1_000);
    expect(expired).toHaveLength(1);
  });

  it("keeps the seat of a player in a running game for as long as the game lasts", () => {
    const { sessions, clock, expired } = setup(1_000);
    sessions.issue("p1", "ROOM01");
    sessions.bindGame("ROOM01", "game-1");
    expect(sessions.disconnect("p1")).toBe(true);
    clock.advance(60 * 60 * 1_000);
    expect(expired).toEqual([]);
    expect(sessions.get("p1")).toMatchObject({ gameId: "game-1" });
  });

  it("stops the countdown of players already offline when their game starts", () => {
    const { sessions, clock, expired } = setup(1_000);
    sessions.issue("p1", "ROOM01");
    sessions.disconnect("p1");
    sessions.bindGame("ROOM01", "game-1");
    clock.advance(5_000);
    expect(expired).toEqual([]);
  });

  it("revoking a seat invalidates its token and countdown", () => {
    const { sessions, clock, expired } = setup(1_000);
    const token = sessions.issue("p1", "ROOM01");
    sessions.disconnect("p1");
    sessions.revoke("p1");
    clock.advance(5_000);
    expect(expired).toEqual([]);
    expect(sessions.resolve(token)).toBeNull();
    expect(sessions.size).toBe(0);
  });

  it("revokes every seat of a room only", () => {
    const { sessions } = setup();
    const a = sessions.issue("p1", "ROOM01");
    const b = sessions.issue("p2", "ROOM02");
    sessions.revokeRoom("ROOM01");
    expect(sessions.resolve(a)).toBeNull();
    expect(sessions.resolve(b)).not.toBeNull();
  });

  it("ignores unknown players and disposes pending timers", () => {
    const { sessions, clock } = setup();
    expect(sessions.disconnect("ghost")).toBe(false);
    expect(() => sessions.connect("ghost")).not.toThrow();
    sessions.issue("p1", "ROOM01");
    sessions.disconnect("p1");
    sessions.dispose();
    expect(clock.pending).toBe(0);
  });
});
