import {
  CHAT_MESSAGE_MAX_LENGTH,
  type ChatChannel,
  type ChatMessage,
  type PlayerView,
} from "@howlsinthedark/shared";
import { ChevronLeft, MessageCircle, Send } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { audioManager } from "../../audio/audioManager";
import { VillagerAvatar } from "../../components/avatar/VillagerAvatar";
import type { Result } from "../../net/session";
import { seatColor } from "./PlayersTable";

interface Props {
  view: PlayerView;
  messages: ChatMessage[];
  onSend: (channel: ChatChannel, text: string) => Promise<Result>;
}

/**
 * Channel chats in a drawer that slides out from the left edge. Only the channels the
 * server lets this player read appear; writing is enabled where it allows it.
 */
export function ChatDrawer({ view, messages, onSend }: Props) {
  const { t } = useTranslation();
  const readable = view.chat.read;
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<ChatChannel>(readable[0] ?? "general");
  const [seen, setSeen] = useState<Record<string, number>>({});
  const active = readable.includes(channel) ? channel : (readable[0] ?? "general");

  const countIn = (c: ChatChannel) => messages.filter((message) => message.channel === c).length;
  const unread = (c: ChatChannel) => Math.max(0, countIn(c) - (seen[c] ?? 0));
  const totalUnread = readable.reduce((sum, c) => sum + unread(c), 0);

  // What is on screen counts as read.
  // biome-ignore lint/correctness/useExhaustiveDependencies: recount when lines arrive
  useEffect(() => {
    if (open) setSeen((previous) => ({ ...previous, [active]: countIn(active) }));
  }, [open, active, messages.length]);

  const toggle = (next: boolean) => {
    audioManager.playEffect(next ? "ui-open" : "ui-close");
    setOpen(next);
  };

  if (!readable.length) return null;
  return (
    <>
      <motion.button
        type="button"
        onClick={() => toggle(true)}
        aria-label={t("chat.open")}
        aria-expanded={open}
        initial={{ x: -40 }}
        animate={{ x: open ? -80 : 0 }}
        className="glass fixed top-1/3 left-0 z-30 flex flex-col items-center gap-1 rounded-r-2xl border-l-0 px-2 py-3"
      >
        <MessageCircle aria-hidden="true" className="size-5" />
        <AnimatePresence>
          {totalUnread > 0 && (
            <motion.span
              key={totalUnread}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="flex size-5 items-center justify-center rounded-full bg-[var(--accent)] font-bold text-[10px] text-[var(--on-accent)]"
              aria-label={t("chat.unread", { count: totalUnread })}
            >
              {totalUnread}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => toggle(false)}
              className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px] sm:hidden"
            />
            <motion.aside
              key="drawer"
              aria-label={t("chat.title")}
              initial={{ x: "-105%" }}
              animate={{ x: 0 }}
              exit={{ x: "-105%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="glass-strong fixed inset-y-3 left-0 z-40 flex w-[min(22rem,88vw)] flex-col rounded-r-3xl"
            >
              <header className="flex items-center justify-between px-4 pt-3">
                <h2 className="font-display text-lg">{t("chat.title")}</h2>
                <button
                  type="button"
                  onClick={() => toggle(false)}
                  aria-label={t("chat.close")}
                  className="rounded-full p-1.5 hover:bg-white/10"
                >
                  <ChevronLeft aria-hidden="true" className="size-5" />
                </button>
              </header>

              <div role="tablist" className="flex gap-1 px-3 pt-2">
                {readable.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={c === active}
                    onClick={() => setChannel(c)}
                    className={`relative flex-1 rounded-t-lg px-2 py-2 text-sm ${c === active ? "" : "text-ink-muted"} ${c === "wolves" ? "font-wolf text-base text-blood" : ""}`}
                  >
                    {t(`chat.channels.${c}`)}
                    {c !== active && unread(c) > 0 && (
                      <span className="ml-1 inline-block size-2 rounded-full bg-[var(--accent)]" />
                    )}
                    {c === active && (
                      <motion.span
                        layoutId="chat-tab"
                        className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--accent)]"
                      />
                    )}
                  </button>
                ))}
              </div>

              <Messages
                messages={messages.filter((message) => message.channel === active)}
                view={view}
              />
              <Composer
                channel={active}
                canWrite={view.chat.write.includes(active)}
                onSend={onSend}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Messages({ messages, view }: { messages: ChatMessage[]; view: PlayerView }) {
  const { t } = useTranslation();
  const list = useRef<HTMLOListElement>(null);
  const seatOf = (id: string) => view.players.find((player) => player.id === id)?.seat;

  // biome-ignore lint/correctness/useExhaustiveDependencies: follow the newest message
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  if (!messages.length) {
    return <p className="flex-1 px-4 py-6 text-center text-ink-muted text-sm">{t("chat.empty")}</p>;
  }
  return (
    <ol
      ref={list}
      className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-3"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {messages.map((message) => {
          const mine = message.from === view.you.id;
          const seat = seatOf(message.from);
          return (
            <motion.li
              key={message.id}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`flex max-w-[85%] items-end gap-2 ${mine ? "self-end" : "self-start"}`}
            >
              {!mine && (
                <span
                  className="relative size-7 shrink-0 overflow-hidden rounded-full"
                  style={{ background: seat === undefined ? undefined : seatColor(seat) }}
                >
                  <VillagerAvatar id={message.from} className="size-full" />
                </span>
              )}
              <div
                className={`min-w-0 rounded-2xl px-3 py-2 text-sm ${mine ? "bg-[var(--accent)]/20" : "bg-white/8"}`}
              >
                {!mine && (
                  <p
                    className="font-semibold text-xs"
                    style={{
                      color:
                        seat === undefined ? undefined : `hsl(${(seat * 47 + 200) % 360} 70% 75%)`,
                    }}
                  >
                    {message.name}
                  </p>
                )}
                <p className="break-words">{message.text}</p>
              </div>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}

function Composer({
  channel,
  canWrite,
  onSend,
}: {
  channel: ChatChannel;
  canWrite: boolean;
  onSend: (channel: ChatChannel, text: string) => Promise<Result>;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!canWrite) {
    return <p className="px-4 pb-4 text-center text-ink-muted text-xs">{t("chat.readOnly")}</p>;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");
    const result = await onSend(channel, trimmed);
    if (!result.ok) {
      setText(trimmed);
      setError(t(`errors.${result.code}`));
    } else setError(null);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-1 p-3">
      {error && (
        <p role="alert" className="text-rose-300 text-xs">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          placeholder={t("chat.placeholder")}
          aria-label={t("chat.placeholder")}
          className="min-w-0 flex-1 rounded-full border border-panel-border bg-black/30 px-4 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
        />
        <motion.button
          type="submit"
          whileTap={{ scale: 0.9 }}
          aria-label={t("chat.send")}
          className="flex size-10 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)]"
        >
          <Send aria-hidden="true" className="size-4" />
        </motion.button>
      </div>
    </form>
  );
}
