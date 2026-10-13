import { randomInt } from "node:crypto";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@aullidos/shared";

export type RandomInt = (maxExclusive: number) => number;

/** Cryptographically random, so codes cannot be predicted from earlier ones. */
export function generateRoomCode(random: RandomInt = randomInt): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++)
    code += ROOM_CODE_ALPHABET[random(ROOM_CODE_ALPHABET.length)];
  return code;
}
