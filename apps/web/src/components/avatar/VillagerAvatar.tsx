import { type ReactNode, useMemo } from "react";
import { type AvatarTraits, avatarTraits } from "./traits";

/** Bleached linen: chemises, shirts and coifs. */
const LINEN = "#ece3cf";
const OUTLINE = "rgb(0 0 0 / 0.22)";

/**
 * A villager's portrait (head and shoulders) for the player behind `id`. Flat SVG drawn on a
 * 64×64 grid; the parent decides the size, the frame and the backdrop. Decorative: the
 * player's name is always given next to it.
 */
export function VillagerAvatar({ id, className }: { id: string; className?: string }) {
  const traits = useMemo(() => avatarTraits(id), [id]);
  const hooded = traits.garment === "hood";

  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" className={className}>
      {!hooded && <BackHair traits={traits} />}
      <Body traits={traits} />
      {/* Braids hang over the shoulders, from behind the head. */}
      {!hooded && <Braids traits={traits} />}
      <Head traits={traits} />
      <FrontHair traits={traits} />
      {hooded && <Hood traits={traits} />}
    </svg>
  );
}

function Body({ traits }: { traits: AvatarTraits }) {
  const { cloth, trim, skin } = traits;
  const shoulders = "M6 64 C7 52 17 46 32 46 C47 46 57 52 58 64Z";
  const neck = (
    <>
      <path d="M27.5 33 h9 v14 h-9z" fill={skin} />
      <path d="M27.5 37 q4.5 3.2 9 0 v3 q-4.5 2 -9 0z" fill="rgb(0 0 0 / 0.16)" />
    </>
  );

  let garment: ReactNode;
  switch (traits.garment) {
    case "tunic":
      // Rough wool tunic with a laced slit at the neck.
      garment = (
        <>
          <path d={shoulders} fill={cloth} stroke={OUTLINE} strokeWidth="0.6" />
          <path d="M27.5 46 L32 55 L36.5 46Z" fill={skin} />
          <path d="M27.5 46 L32 55 L36.5 46" fill="none" stroke={trim} strokeWidth="1.4" />
          <path
            d="M29.6 48.5 L34.2 51 M34.4 48.5 L29.8 51"
            stroke="#3b2a1d"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
        </>
      );
      break;
    case "jerkin":
      // Leather jerkin over a linen shirt.
      garment = (
        <>
          <path d={shoulders} fill={LINEN} stroke={OUTLINE} strokeWidth="0.6" />
          <path d="M26 46 L32 51 L38 46Z" fill={skin} />
          <path d="M6 64 C7 52 17 46.5 26.5 46.5 L29.5 64Z" fill={cloth} stroke={OUTLINE} />
          <path d="M58 64 C57 52 47 46.5 37.5 46.5 L34.5 64Z" fill={cloth} stroke={OUTLINE} />
          <circle cx="29.2" cy="55" r="0.9" fill="#2b1d14" />
          <circle cx="34.8" cy="55" r="0.9" fill="#2b1d14" />
          <circle cx="29.6" cy="60" r="0.9" fill="#2b1d14" />
          <circle cx="34.4" cy="60" r="0.9" fill="#2b1d14" />
        </>
      );
      break;
    case "smock":
      // Gathered smock with a drawstring neck.
      garment = (
        <>
          <path d={shoulders} fill={cloth} stroke={OUTLINE} strokeWidth="0.6" />
          <path d="M26 46 Q32 51.5 38 46Z" fill={skin} />
          <path d="M25.5 46 Q32 52.5 38.5 46" fill="none" stroke={trim} strokeWidth="1.5" />
          <path
            d="M27 51 v3 M30 52.4 v3 M34 52.4 v3 M37 51 v3"
            stroke="rgb(0 0 0 / 0.25)"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
        </>
      );
      break;
    case "apronDress":
      // Wool dress, chemise at the neck and an apron tied over it.
      garment = (
        <>
          <path d={shoulders} fill={cloth} stroke={OUTLINE} strokeWidth="0.6" />
          <path d="M25 46 h14 v3.5 q-7 3.2 -14 0z" fill={skin} />
          <path d="M25 49.5 q7 3.2 14 0" fill="none" stroke={LINEN} strokeWidth="1.6" />
          <path d="M25.5 55 h13 v9 h-13z" fill={trim} stroke={OUTLINE} strokeWidth="0.6" />
          <path d="M25.8 55 L21.5 47.5 M38.2 55 L42.5 47.5" stroke={trim} strokeWidth="2" />
        </>
      );
      break;
    case "bodice":
      // Laced bodice over a linen chemise.
      garment = (
        <>
          <path d={shoulders} fill={LINEN} stroke={OUTLINE} strokeWidth="0.6" />
          <path d="M25 46 Q32 50 39 46Z" fill={skin} />
          <path
            d="M18.5 64 C19.5 56 22 51.5 24.5 50.5 L39.5 50.5 C42 51.5 44.5 56 45.5 64Z"
            fill={cloth}
            stroke={OUTLINE}
            strokeWidth="0.6"
          />
          <path
            d="M30.2 52 L33.8 54.5 L30.2 57 L33.8 59.5 L30.2 62"
            fill="none"
            stroke={trim}
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
        </>
      );
      break;
    case "shawl":
      // Dress with a wool shawl knotted at the chest.
      garment = (
        <>
          <path d={shoulders} fill={cloth} stroke={OUTLINE} strokeWidth="0.6" />
          <path d="M26 46 Q32 50 38 46Z" fill={skin} />
          <path
            d="M7 61 C9 52 17 46.5 25.5 45.5 L32 57 L38.5 45.5 C47 46.5 55 52 57 61 C50 58.5 43 58 32 63 C21 58 14 58.5 7 61Z"
            fill={trim}
            stroke={OUTLINE}
            strokeWidth="0.6"
          />
          <circle cx="32" cy="57.5" r="2.4" fill={trim} stroke={OUTLINE} strokeWidth="0.6" />
        </>
      );
      break;
    case "hood":
      // A plain cloak: the hood itself is drawn over the head.
      garment = (
        <>
          <path d={shoulders} fill={cloth} stroke={OUTLINE} strokeWidth="0.6" />
          <path d="M29 46 L32 50 L35 46Z" fill={LINEN} />
        </>
      );
      break;
  }

  return (
    <>
      {neck}
      {garment}
    </>
  );
}

function Head({ traits }: { traits: AvatarTraits }) {
  const { skin, hairColor } = traits;
  return (
    <>
      <ellipse cx="21.6" cy="28.5" rx="2.1" ry="3" fill={skin} />
      <ellipse cx="42.4" cy="28.5" rx="2.1" ry="3" fill={skin} />
      <ellipse cx="32" cy="27.5" rx="10.6" ry="12.2" fill={skin} />
      {/* Soft shade on the jaw. */}
      <path
        d="M22 31 C23 37.5 27 39.7 32 39.7 C37 39.7 41 37.5 42 31 C40 36.5 36.5 38.4 32 38.4 C27.5 38.4 24 36.5 22 31Z"
        fill="rgb(0 0 0 / 0.1)"
      />
      <circle cx="26.6" cy="32.4" r="2.2" fill="#e0786a" opacity="0.22" />
      <circle cx="37.4" cy="32.4" r="2.2" fill="#e0786a" opacity="0.22" />
      {traits.freckles && (
        <g fill="#7a4a30" opacity="0.45">
          <circle cx="28.3" cy="31" r="0.45" />
          <circle cx="29.6" cy="32" r="0.45" />
          <circle cx="27.4" cy="32.3" r="0.45" />
          <circle cx="35.7" cy="31" r="0.45" />
          <circle cx="34.4" cy="32" r="0.45" />
          <circle cx="36.6" cy="32.3" r="0.45" />
        </g>
      )}
      <path
        d="M25.6 24.6 q2.5 -1.3 5 0 M33.4 24.6 q2.5 -1.3 5 0"
        fill="none"
        stroke={hairColor}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M25.6 24.6 q2.5 -1.3 5 0 M33.4 24.6 q2.5 -1.3 5 0"
        fill="none"
        stroke="rgb(0 0 0 / 0.25)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="28.1" cy="28.2" r="1.3" fill="#24180f" />
      <circle cx="35.9" cy="28.2" r="1.3" fill="#24180f" />
      <path
        d="M32 28.8 q-1.7 3.4 0.5 4"
        fill="none"
        stroke="rgb(0 0 0 / 0.28)"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      <FacialHair traits={traits} />
      <path
        d="M29.6 35.4 q2.4 1.5 4.8 0"
        fill="none"
        stroke="#6e3a30"
        strokeOpacity="0.75"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </>
  );
}

function FacialHair({ traits }: { traits: AvatarTraits }) {
  const fill = traits.hairColor;
  switch (traits.facialHair) {
    case "none":
      return null;
    case "stubble":
      return (
        <path
          d="M21.8 29 C22 36.5 26 39.7 32 39.7 C38 39.7 42 36.5 42.2 29 C41 32.5 38.5 34 35.5 33.8 C33.5 33.5 30.5 33.5 28.5 33.8 C25.5 34 23 32.5 21.8 29Z"
          fill={fill}
          opacity="0.32"
        />
      );
    case "beard":
      return (
        <path
          d="M21.4 27.5 C21.2 40 25.5 44.5 32 44.5 C38.5 44.5 42.8 40 42.6 27.5 C41.5 32.5 39 34.4 36.5 33.7 C34.5 33 29.5 33 27.5 33.7 C25 34.4 22.5 32.5 21.4 27.5Z"
          fill={fill}
          stroke={OUTLINE}
          strokeWidth="0.5"
        />
      );
    case "moustache":
      return (
        <path
          d="M27.3 35 C28.6 32.6 30.8 32.6 32 33.4 C33.2 32.6 35.4 32.6 36.7 35 C35.2 34.4 33.6 35 32 34.6 C30.4 35 28.8 34.4 27.3 35Z"
          fill={fill}
          stroke={OUTLINE}
          strokeWidth="0.4"
        />
      );
  }
}

/** Hair that falls behind the head and shoulders. */
function BackHair({ traits }: { traits: AvatarTraits }) {
  const fill = traits.hairColor;
  switch (traits.hairstyle) {
    case "long":
      return (
        <path
          d="M20 26 C19.5 14 25 10.5 32 10.5 C39 10.5 44.5 14 44 26 L45.5 47 C42.5 49.5 39 48.5 38 46.5 L37 33 H27 L26 46.5 C25 48.5 21.5 49.5 18.5 47Z"
          fill={fill}
          stroke={OUTLINE}
          strokeWidth="0.6"
        />
      );
    case "bun":
      return <circle cx="32" cy="12.2" r="5.4" fill={fill} stroke={OUTLINE} strokeWidth="0.6" />;
    case "coif":
      // Linen coif framing the face, tied under the chin.
      return (
        <path
          d="M19 30 C18 14 25 9 32 9 C39 9 46 14 45 30 C45 36.5 43 40.5 40 42.5 L24 42.5 C21 40.5 19 36.5 19 30Z"
          fill={LINEN}
          stroke={OUTLINE}
          strokeWidth="0.6"
        />
      );
    default:
      return null;
  }
}

function FrontHair({ traits }: { traits: AvatarTraits }) {
  const fill = traits.hairColor;
  const props = { fill, stroke: OUTLINE, strokeWidth: 0.6 };
  switch (traits.hairstyle) {
    case "cropped":
      return (
        <path
          d="M21.3 27 C20.5 16 26 13 32 13 C38 13 43.5 16 42.7 27 C41.5 22 38.5 19.5 32 19.8 C25.5 19.5 22.5 22 21.3 27Z"
          {...props}
        />
      );
    case "bowl":
      return (
        <path
          d="M20.5 30 C19.5 16 25.5 12 32 12 C38.5 12 44.5 16 43.5 30 L42 30 C41.8 26 41 23.5 40 22.5 L24 22.5 C23 23.5 22.2 26 22 30Z"
          {...props}
        />
      );
    case "shaggy":
      return (
        <path
          d="M20.5 29 C19.5 15 25.5 11.5 32 11.5 C38.5 11.5 44.5 15 43.5 29 L41.5 25 L40 22 L37.5 24 L35.5 21 L33 23.5 L30.5 21 L28 24 L25.5 21.5 L24 25 L22.5 23Z"
          {...props}
        />
      );
    case "long":
      return (
        <path
          d="M21 30 C20.5 16 26 12 32 12 C38 12 43.5 16 43 30 C41 23 37 19 32.6 17.5 L32 16.5 L31.4 17.5 C27 19 23 23 21 30Z"
          {...props}
        />
      );
    case "braid":
    case "twinBraids":
    case "bun":
      // Pulled back, parted in the middle.
      return (
        <path
          d="M21.3 27 C21 16 26 12.3 32 12.3 C38 12.3 43 16 42.7 27 C40.5 21.5 37 18.6 32.5 18 L32 17 L31.5 18 C27 18.6 23.5 21.5 21.3 27Z"
          {...props}
        />
      );
    case "bald":
      return (
        <>
          <path d="M21.2 30 C20.6 26 21 23.5 22.6 21.8 L23.4 29Z" {...props} />
          <path d="M42.8 30 C43.4 26 43 23.5 41.4 21.8 L40.6 29Z" {...props} />
          <ellipse cx="28" cy="18.5" rx="3" ry="1.5" fill="#fff" opacity="0.22" />
        </>
      );
    case "coif":
      return (
        <>
          <path
            d="M23 25 C25 21.3 28.5 20.3 32 20.3 C35.5 20.3 39 21.3 41 25 C38 22.8 35 22.2 32 22.2 C29 22.2 26 22.8 23 25Z"
            fill={fill}
          />
          <path
            d="M21.4 25.5 C21.4 16 26 12.3 32 12.3 C38 12.3 42.6 16 42.6 25.5 C40 21.3 36 20.4 32 20.4 C28 20.4 24 21.3 21.4 25.5Z"
            fill={LINEN}
            stroke={OUTLINE}
            strokeWidth="0.6"
          />
        </>
      );
  }
}

/** One braid: a chain of plaits from behind the ear at `x` down to a tie. */
function Braid({ x, lean, fill, tie }: { x: number; lean: number; fill: string; tie: string }) {
  const links = [0, 1, 2, 3, 4];
  return (
    <g>
      {links.map((i) => (
        <ellipse
          key={i}
          cx={x + lean * i}
          cy={34 + i * 5}
          rx="2.9"
          ry="2.7"
          fill={fill}
          stroke={OUTLINE}
          strokeWidth="0.6"
        />
      ))}
      <rect x={x + lean * 5 - 2} y="55.6" width="4" height="1.8" rx="0.6" fill={tie} />
      <path
        d={`M${x + lean * 5 - 1.8} 57.4 l-0.6 3.5 h4.8 l-0.6 -3.5z`}
        fill={fill}
        stroke={OUTLINE}
        strokeWidth="0.5"
      />
    </g>
  );
}

function Braids({ traits }: { traits: AvatarTraits }) {
  const { hairColor, trim } = traits;
  if (traits.hairstyle === "braid") {
    return <Braid x={43} lean={0.7} fill={hairColor} tie={trim} />;
  }
  if (traits.hairstyle === "twinBraids") {
    return (
      <>
        <Braid x={21} lean={-0.7} fill={hairColor} tie={trim} />
        <Braid x={43} lean={0.7} fill={hairColor} tie={trim} />
      </>
    );
  }
  return null;
}

/** A wool hood with the face showing through; its lining is the trim colour. */
function Hood({ traits }: { traits: AvatarTraits }) {
  return (
    <>
      <path
        fillRule="evenodd"
        d="M14.5 35 C13.5 13 23 6.5 32 6.5 C41 6.5 50.5 13 49.5 35 C49.5 42 46.5 46.5 43.5 48.5 L20.5 48.5 C17.5 46.5 14.5 42 14.5 35Z M22 32.5 C22 21 26 16.2 32 16.2 C38 16.2 42 21 42 32.5 C42 39 38.5 43.2 32 43.2 C25.5 43.2 22 39 22 32.5Z"
        fill={traits.cloth}
        stroke={OUTLINE}
        strokeWidth="0.6"
      />
      <path
        d="M22 32.5 C22 21 26 16.2 32 16.2 C38 16.2 42 21 42 32.5 C42 39 38.5 43.2 32 43.2 C25.5 43.2 22 39 22 32.5Z"
        fill="none"
        stroke={traits.trim}
        strokeWidth="1.4"
      />
    </>
  );
}
