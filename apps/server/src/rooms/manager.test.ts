import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, roomCodeSchema } from "@aullidos/shared";
import { describe, expect, it } from "vitest";
import { generateRoomCode } from "./code.js";
import { RoomManager, type RoomManagerOptions } from "./manager.js";

function manager(options: RoomManagerOptions = {}) {
  let time = 1_000;
  let id = 0;
  const instance = new RoomManager({
    now: () => time,
    newPlayerId: () => `p${++id}`,
    ...options,
  });
  return { rooms: instance, advance: (ms: number) => (time += ms) };
}

describe("generateRoomCode", () => {
  it("uses only unambiguous characters and the fixed length", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      for (const char of code) expect(ROOM_CODE_ALPHABET).toContain(char);
      expect(code).not.toMatch(/[01OI]/);
      expect(roomCodeSchema.safeParse(code).success).toBe(true);
    }
  });

  it("is not predictable from the previous code", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateRoomCode()));
    expect(codes.size).toBe(200);
  });
});

describe("RoomManager", () => {
  it("creates a room with the creator as host", () => {
    const { rooms } = manager();
    const { room, member } = rooms.create("Ana");
    expect(room.state()).toEqual({
      code: room.code,
      hostId: member.id,
      maxPlayers: 20,
      players: [{ id: member.id, name: "Ana", connected: true }],
    });
    expect(rooms.get(room.code)).toBe(room);
  });

  it("retries when a generated code is already taken", () => {
    const sequence = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1];
    const { rooms } = manager({ randomInt: () => sequence.shift() ?? 2 });
    const first = rooms.create("Ana").room.code;
    const second = rooms.create("Bea").room.code;
    expect(first).toBe("AAAAAA");
    expect(second).toBe("BBBBBB");
  });

  it("lets others join and lists them in join order", () => {
    const { rooms } = manager();
    const { room } = rooms.create("Ana");
    const joined = rooms.join(room.code, "Bea", "ip1");
    expect(joined.ok).toBe(true);
    expect(room.state().players.map((p) => p.name)).toEqual(["Ana", "Bea"]);
  });

  it("rejects an unknown room", () => {
    const { rooms } = manager();
    expect(rooms.join("ZZZZZZ", "Bea", "ip1")).toEqual({ ok: false, error: "ROOM_NOT_FOUND" });
  });

  it("rejects joins to a full room", () => {
    const { rooms } = manager({ maxPlayersPerRoom: 2 });
    const { room } = rooms.create("Ana");
    expect(rooms.join(room.code, "Bea", "ip").ok).toBe(true);
    expect(rooms.join(room.code, "Cai", "ip")).toEqual({ ok: false, error: "ROOM_FULL" });
  });

  it("rejects duplicate names, ignoring case and spaces", () => {
    const { rooms } = manager();
    const { room } = rooms.create("Ana");
    expect(rooms.join(room.code, "  aNa ", "ip")).toEqual({ ok: false, error: "NAME_TAKEN" });
  });

  it("frees a seat when someone leaves", () => {
    const { rooms } = manager({ maxPlayersPerRoom: 2 });
    const { room } = rooms.create("Ana");
    const bea = rooms.join(room.code, "Bea", "ip");
    if (!bea.ok) throw new Error("join failed");
    rooms.leave(room.code, bea.member.id);
    expect(rooms.join(room.code, "Cai", "ip").ok).toBe(true);
  });

  describe("host transfer", () => {
    it("passes the host to the oldest remaining member", () => {
      const { rooms } = manager();
      const { room, member: ana } = rooms.create("Ana");
      const bea = rooms.join(room.code, "Bea", "ip");
      const cai = rooms.join(room.code, "Cai", "ip");
      if (!bea.ok || !cai.ok) throw new Error("join failed");

      rooms.leave(room.code, ana.id);
      expect(room.state().hostId).toBe(bea.member.id);
      rooms.leave(room.code, bea.member.id);
      expect(room.state().hostId).toBe(cai.member.id);
    });

    it("keeps the host when a non-host leaves", () => {
      const { rooms } = manager();
      const { room, member: ana } = rooms.create("Ana");
      const bea = rooms.join(room.code, "Bea", "ip");
      if (!bea.ok) throw new Error("join failed");
      rooms.leave(room.code, bea.member.id);
      expect(room.state().hostId).toBe(ana.id);
    });

    it("destroys the room when the last member leaves", () => {
      const { rooms } = manager();
      const { room, member } = rooms.create("Ana");
      expect(rooms.leave(room.code, member.id)).toBeNull();
      expect(rooms.get(room.code)).toBeUndefined();
      expect(rooms.size).toBe(0);
    });

    it("ignores leaving twice or from an unknown room", () => {
      const { rooms } = manager();
      const { room, member } = rooms.create("Ana");
      rooms.join(room.code, "Bea", "ip");
      rooms.leave(room.code, member.id);
      expect(() => rooms.leave(room.code, member.id)).not.toThrow();
      expect(rooms.leave("NOROOM", "x")).toBeNull();
    });
  });

  describe("join attempt limit", () => {
    const options = { joinAttempts: { maxFailures: 3, windowMs: 60_000 } };

    it("blocks a client after repeated wrong codes, even for a valid code", () => {
      const { rooms } = manager(options);
      const { room } = rooms.create("Ana");
      for (let i = 0; i < 3; i++) rooms.join("ZZZZZZ", "Bea", "bad-ip");
      expect(rooms.join(room.code, "Bea", "bad-ip")).toEqual({
        ok: false,
        error: "TOO_MANY_ATTEMPTS",
      });
    });

    it("does not affect other clients", () => {
      const { rooms } = manager(options);
      const { room } = rooms.create("Ana");
      for (let i = 0; i < 3; i++) rooms.join("ZZZZZZ", "Bea", "bad-ip");
      expect(rooms.join(room.code, "Cai", "good-ip").ok).toBe(true);
    });

    it("only counts failures: a full room or taken name does not block", () => {
      const { rooms } = manager({ ...options, maxPlayersPerRoom: 1 });
      const { room } = rooms.create("Ana");
      for (let i = 0; i < 10; i++) rooms.join(room.code, "Bea", "ip");
      expect(rooms.join("ZZZZZZ", "Bea", "ip")).toEqual({ ok: false, error: "ROOM_NOT_FOUND" });
    });

    it("lets the client try again once the window has passed", () => {
      const { rooms, advance } = manager(options);
      const { room } = rooms.create("Ana");
      for (let i = 0; i < 3; i++) rooms.join("ZZZZZZ", "Bea", "bad-ip");
      advance(60_001);
      expect(rooms.join(room.code, "Bea", "bad-ip").ok).toBe(true);
    });
  });

  describe("sweep", () => {
    it("removes rooms idle longer than the TTL and keeps active ones", () => {
      const { rooms, advance } = manager({ idleTtlMs: 1_000 });
      const idle = rooms.create("Ana").room;
      advance(800);
      const active = rooms.create("Bea").room;
      advance(400);
      expect(rooms.sweep()).toEqual([idle.code]);
      expect(rooms.get(idle.code)).toBeUndefined();
      expect(rooms.get(active.code)).toBe(active);
    });

    it("joining refreshes a room's activity", () => {
      const { rooms, advance } = manager({ idleTtlMs: 1_000 });
      const { room } = rooms.create("Ana");
      advance(900);
      rooms.join(room.code, "Bea", "ip");
      advance(900);
      expect(rooms.sweep()).toEqual([]);
    });
  });
});

describe("name uniqueness", () => {
  it("treats composed and decomposed accents as the same name", () => {
    const rooms = new RoomManager();
    const { room } = rooms.create("Ána"); // Á precomposed
    expect(rooms.join(room.code, "Ána", "ip")).toEqual({ ok: false, error: "NAME_TAKEN" });
  });
});
