import { z } from "zod";
import type { PlayerId } from "./game/actions.js";

export const ROOM_CODE_LENGTH = 6;
/** Uppercase letters and digits without look-alikes (no 0/O, 1/I). 32 symbols ≈ 10⁹ codes. */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const PLAYER_NAME_MAX_LENGTH = 24;

/** Accepts what people type: surrounding spaces and lowercase are normalized. */
export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(ROOM_CODE_LENGTH)
  .regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]+$`));

/** Display name: 1-24 characters, no control characters. */
export const playerNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(PLAYER_NAME_MAX_LENGTH)
  .regex(/^[^\p{C}]+$/u);

export const roomCreateSchema = z.object({ name: playerNameSchema });
export const roomJoinSchema = z.object({ code: roomCodeSchema, name: playerNameSchema });

export type RoomCreate = z.infer<typeof roomCreateSchema>;
export type RoomJoin = z.infer<typeof roomJoinSchema>;

export interface RoomMember {
  id: PlayerId;
  name: string;
}

/** A lobby member plus whether they currently have a live connection (false during the grace period). */
export interface RoomPlayer extends RoomMember {
  connected: boolean;
}

/** Public lobby state, identical for every member (nothing secret lives in a lobby). */
export interface RoomStateMessage {
  code: string;
  hostId: PlayerId;
  maxPlayers: number;
  /** In join order; the host is the oldest member still present. */
  players: RoomPlayer[];
}
