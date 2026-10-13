import type { PlayerId, RoomMember, RoomStateMessage } from "@aullidos/shared";

export type AddMemberError = "FULL" | "NAME_TAKEN";

/** Locale-independent comparison key, so "Ana", " ana " and a decomposed "Ána" clash predictably. */
const normalizeName = (name: string) => name.trim().normalize("NFC").toLowerCase();

/** A pre-game lobby: members in join order and a host (the oldest member still seated). */
export class Room {
  private readonly members: RoomMember[] = [];
  private readonly offline = new Set<PlayerId>();
  private host: PlayerId | null = null;
  lastActivity: number;

  constructor(
    readonly code: string,
    readonly maxPlayers: number,
    now: number,
  ) {
    this.lastActivity = now;
  }

  get size(): number {
    return this.members.length;
  }

  get isEmpty(): boolean {
    return this.members.length === 0;
  }

  get hostId(): PlayerId | null {
    return this.host;
  }

  has(id: PlayerId): boolean {
    return this.members.some((member) => member.id === id);
  }

  add(member: RoomMember, now: number): { ok: true } | { ok: false; reason: AddMemberError } {
    if (this.members.length >= this.maxPlayers) return { ok: false, reason: "FULL" };
    const taken = this.members.some((m) => normalizeName(m.name) === normalizeName(member.name));
    if (taken) return { ok: false, reason: "NAME_TAKEN" };
    this.members.push(member);
    this.host ??= member.id;
    this.lastActivity = now;
    return { ok: true };
  }

  /** Removes a member; if it was the host, the next-oldest member takes over. */
  remove(id: PlayerId, now: number): boolean {
    const index = this.members.findIndex((member) => member.id === id);
    if (index === -1) return false;
    this.members.splice(index, 1);
    this.offline.delete(id);
    if (this.host === id) this.host = this.members[0]?.id ?? null;
    this.lastActivity = now;
    return true;
  }

  /** Presence only: the seat stays, other players see who is reconnecting. */
  setConnected(id: PlayerId, connected: boolean): boolean {
    if (!this.has(id)) return false;
    if (connected) this.offline.delete(id);
    else this.offline.add(id);
    return true;
  }

  state(): RoomStateMessage {
    if (this.host === null) throw new Error("An empty room has no state");
    return {
      code: this.code,
      hostId: this.host,
      maxPlayers: this.maxPlayers,
      players: this.members.map((member) => ({
        ...member,
        connected: !this.offline.has(member.id),
      })),
    };
  }
}
