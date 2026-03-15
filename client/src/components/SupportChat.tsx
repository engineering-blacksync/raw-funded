import { useState, useRef, useEffect, useCallback } from "react";
import lionImg from "/lion.png";

const GOLD = "#C9A84C";
const DARK = "#111213";
const CARD = "#1a1b1e";
const BORDER = "rgba(255,255,255,0.07)";
const FONT = "'Plus Jakarta Sans', -apple-system, sans-serif";
const LION_FILTER = "brightness(0) invert(1)";
const ESCALATION_THRESHOLD = 3;

function splitIntoSentences(text: string): string[] {
  // Protect URLs/emails: replace dots in them with a placeholder before splitting
  const protected_text = text
    .replace(/https?:\/\/[^\s]+/g, (m) => m.replace(/\./g, "##DOT##"))
    .replace(/[\w.-]+\.(com|org|net|io|ai|co|uk|app)/gi, (m) => m.replace(/\./g, "##DOT##"));

  // Split on sentence-ending punctuation followed by space+capital or end of string
  const raw = protected_text.match(/[^.!?]+[.!?]+(?=\s+[A-Z]|\s*$)|[^.!?]+$/g);

  if (!raw || raw.length <= 1) return [text.trim()];

  // Restore placeholders and trim
  const sentences = raw
    .map((s) => s.replace(/##DOT##/g, ".").trim())
    .filter(Boolean);

  // Always cap at 2 bubbles max
  if (sentences.length <= 2) return sentences;
  return [sentences[0], sentences.slice(1).join(" ")];
}

const SECTORS = [
  { id: "payouts", label: "Payouts", icon: "M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z", color: "#f43f5e", chips: ["How do I withdraw?", "How long does it take?", "What's the withdrawal fee?"] },
  { id: "technical", label: "Technical Issues", icon: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z", color: "#f59e0b", chips: ["My trade didn't execute", "Platform is showing an error", "Price feed looks wrong"] },
  { id: "support", label: "Support", icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z", color: "#3b82f6", chips: ["How does the platform work?", "What instruments can I trade?", "What are the account tiers?"] },
  { id: "billing", label: "Billing", icon: "M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z", color: "#10b981", chips: ["What are all the fees?", "Payment methods accepted?", "Can I get a refund?"] },
  { id: "login", label: "Login Issues", icon: "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z", color: "#8b5cf6", chips: ["I forgot my username", "Forgot my password", "My account is locked"] },
  { id: "general", label: "General", icon: "M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-1.25 3-2.5 3-5 0-2.21-1.79-4-4-4z", color: "#64748b", chips: ["Tell me about Raw Funded", "How is this different from other prop firms?", "Do you have an affiliate program?"] },
];

type Tab = "home" | "messages" | "help" | "news";
type HelpView = "landing" | "chat";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
}

interface NewsItem {
  tag: string;
  tagColor: string;
  handle: string;
  title: string;
  summary: string;
  time: string;
  change: string | null;
  positive: boolean;
  replies: number;
  reposts: number;
  likes: number;
  xQuery?: string;
}

// Instrument SVG icons
const INSTRUMENT_ICONS: Record<string, (color: string) => React.ReactNode> = {
  GOLD: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill={c} opacity="0.9"/>
    </svg>
  ),
  BTC: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={c}>
      <path d="M17.06 11.57c.47-.93.4-2.17-.41-2.92-.7-.65-1.67-.83-2.57-.85V5.5h-1.5v2.25H11.5V5.5H10v2.25H7.5v1.5H9v7.5H7.5v1.5H10v2.25h1.5v-2.25h1.08v2.25h1.5v-2.3c1.05-.08 2.08-.4 2.7-1.18.7-.9.72-2.2.28-3.2zM10.5 9.25h2.25c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5H10.5V9.25zm2.55 7.5H10.5v-3h2.55c.97 0 1.7.78 1.7 1.5s-.73 1.5-1.7 1.5z"/>
    </svg>
  ),
  NQ: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <polyline points="3,17 8,11 13,14 21,6" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="15,6 21,6 21,12" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  SPX: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="14" width="3" height="7" fill={c} opacity="0.7" rx="1"/>
      <rect x="8.5" y="9" width="3" height="12" fill={c} opacity="0.85" rx="1"/>
      <rect x="14" y="5" width="3" height="16" fill={c} rx="1"/>
      <rect x="19.5" y="11" width="3" height="10" fill={c} opacity="0.75" rx="1"/>
    </svg>
  ),
  OIL: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C8 7 5 10.5 5 14a7 7 0 0014 0c0-3.5-3-7-7-12z" fill={c} opacity="0.9"/>
    </svg>
  ),
  SILVER: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="7" stroke={c} strokeWidth="2" fill={c} opacity="0.2"/>
      <circle cx="12" cy="12" r="4" fill={c} opacity="0.7"/>
    </svg>
  ),
  FTSE: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" fill={c} opacity="0.9"/>
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" fill={c} opacity="0.6"/>
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" fill={c} opacity="0.6"/>
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" fill={c} opacity="0.9"/>
    </svg>
  ),
};

let msgId = 0;

function StreamingMessage({ content, onDone }: { content: string; onDone: () => void }) {
  const words = content.split(" ");
  const [wordCount, setWordCount] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    done.current = false;
    setWordCount(0);
    const interval = setInterval(() => {
      setWordCount((prev) => {
        const next = prev + 1;
        if (next >= words.length) {
          clearInterval(interval);
          if (!done.current) {
            done.current = true;
            setTimeout(onDone, 80);
          }
          return words.length;
        }
        return next;
      });
    }, 80); // 80ms between words
    return () => clearInterval(interval);
  }, [content]);

  const isTyping = wordCount < words.length;

  return (
    <span>
      {words.slice(0, wordCount).map((word, i) => (
        <span
          key={i}
          style={{
            display: "inline",
            animation: "rf-word-in 1.2s ease both",
          }}
        >
          {word}{i < words.length - 1 ? " " : ""}
        </span>
      ))}
      {isTyping && (
        <span style={{
          display: "inline-block", width: 2, height: "1em",
          background: "#555", marginLeft: 2, verticalAlign: "middle",
          animation: "rf-cursor 0.7s ease-in-out infinite",
          borderRadius: 1,
        }} />
      )}
    </span>
  );
}

function LionAvatar({ circleSize, imgSize }: { circleSize: number; imgSize: number }) {
  return (
    <div style={{ width: circleSize, height: circleSize, borderRadius: "50%", background: "rgba(201,168,76,0.08)", border: "1.5px solid rgba(201,168,76,0.3)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
      <img src={lionImg} alt="" width={imgSize} height={imgSize} style={{ objectFit: "contain", filter: LION_FILTER, transform: "scale(1.20)" }} />
    </div>
  );
}

function EscalationBanner() {
  return (
    <div style={{ margin: "4px 0 8px", padding: "10px 14px", background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 12, animation: "rf-fade-up 0.3s ease" }}>
      <div style={{ fontSize: 12, color: "#888", fontFamily: FONT, marginBottom: 4 }}>Still need help?</div>
      <a href="mailto:support@rawfunded.com" style={{ fontSize: 13, color: GOLD, fontFamily: FONT, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2"/><path d="M22 6l-10 7L2 6" stroke="currentColor" strokeWidth="2"/></svg>
        Contact support@rawfunded.com
      </a>
    </div>
  );
}

function TypingBubble() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, animation: "rf-msg-in 0.2s ease" }}>
      <LionAvatar circleSize={36} imgSize={28} />
      <div style={{ padding: "13px 16px", background: CARD, borderRadius: "18px 18px 18px 4px", display: "flex", gap: 5, alignItems: "center" }}>
        {[0, 0.18, 0.36].map((d, i) => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#555", animation: `rf-typing 1.1s ${d}s infinite ease-in-out` }} />
        ))}
      </div>
    </div>
  );
}

interface InputBarProps {
  val: string;
  blocked: boolean;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  placeholder: string;
}

function InputBar({ val, blocked, onChange, onKeyDown, onSend, placeholder }: InputBarProps) {
  const canSend = val.trim().length > 0 && !blocked;
  return (
    <div style={{ padding: "10px 13px 14px", borderTop: `1px solid ${BORDER}`, background: DARK, flexShrink: 0 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          className="rf-input"
          autoFocus
          value={val}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={blocked ? "Waiting for reply..." : placeholder}
          rows={1}
          disabled={blocked}
          style={{ flex: 1, border: "1.5px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 13px", fontSize: 13.5, resize: "none", fontFamily: FONT, color: blocked ? "#555" : "#fff", background: CARD, maxHeight: 80, overflowY: "auto", caretColor: GOLD, opacity: blocked ? 0.5 : 1, cursor: blocked ? "not-allowed" : "text" }}
        />
        <button
          onClick={onSend}
          disabled={!canSend}
          style={{ width: 40, height: 40, borderRadius: 50, border: "none", background: canSend ? GOLD : "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", cursor: canSend ? "pointer" : "not-allowed", flexShrink: 0, transition: "background 0.15s ease" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 19V5M5 12l7-7 7 7" stroke={canSend ? "#0f0f0f" : "#444"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── News skeleton loader ──
function NewsSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ background: CARD, borderRadius: 16, padding: "14px 14px", border: `1px solid ${BORDER}`, animation: `rf-pulse 1.6s ${i * 0.15}s ease-in-out infinite` }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ width: 80, height: 11, borderRadius: 6, background: "rgba(255,255,255,0.05)" }} />
                <div style={{ width: 40, height: 11, borderRadius: 6, background: "rgba(255,255,255,0.04)" }} />
              </div>
              <div style={{ width: "90%", height: 13, borderRadius: 6, background: "rgba(255,255,255,0.06)" }} />
              <div style={{ width: "75%", height: 11, borderRadius: 6, background: "rgba(255,255,255,0.04)" }} />
              <div style={{ width: "55%", height: 11, borderRadius: 6, background: "rgba(255,255,255,0.03)" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── X-style news card ──
function NewsCard({ item, index }: { item: NewsItem; index: number }) {
  const xUrl = `https://x.com/search?q=${encodeURIComponent(item.xQuery || item.tag + " price")}&f=live`;
  const IconComponent = INSTRUMENT_ICONS[item.tag];
  return (
    <a
      href={xUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="rf-news-card"
      style={{
        display: "block",
        textDecoration: "none",
        background: CARD,
        borderRadius: 16,
        padding: "13px 14px 10px",
        border: `1px solid ${BORDER}`,
        animation: `rf-fade-up ${0.08 + index * 0.06}s ease both`,
        cursor: "pointer",
        transition: "border-color 0.15s ease, background 0.15s ease",
      }}
    >
      <div style={{ display: "flex", gap: 11 }}>
        {/* Avatar with instrument icon */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: item.tagColor + "15",
            border: `1.5px solid ${item.tagColor}50`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {IconComponent ? IconComponent(item.tagColor) : (
            <span style={{ fontSize: 12, fontWeight: 800, color: item.tagColor, fontFamily: FONT }}>{item.tag.slice(0,2)}</span>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#e0e0e0", fontFamily: FONT, whiteSpace: "nowrap" }}>
              @{item.handle}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 4,
                background: item.tagColor + "22",
                color: item.tagColor,
                fontFamily: FONT,
                letterSpacing: "0.4px",
                flexShrink: 0,
              }}
            >
              {item.tag}
            </span>
            <span style={{ fontSize: 11, color: "#3a3a3a", marginLeft: "auto", flexShrink: 0, fontFamily: FONT }}>
              {item.time}
            </span>
          </div>

          {/* Headline */}
          <p style={{ margin: "0 0 5px", fontSize: 13.5, fontWeight: 600, color: "#e8e8e8", lineHeight: 1.45, fontFamily: FONT }}>
            {item.title}
          </p>

          {/* Summary */}
          <p style={{ margin: "0 0 9px", fontSize: 12, color: "#555", lineHeight: 1.6, fontFamily: FONT }}>
            {item.summary}
          </p>

          {/* Footer row */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Engagement icons */}
            <button
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#3a3a3a", padding: 0 }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#3b82f6")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#3a3a3a")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
              <span style={{ fontSize: 11, fontFamily: FONT }}>{item.replies}</span>
            </button>
            <button
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#3a3a3a", padding: 0 }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#22c55e")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#3a3a3a")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontSize: 11, fontFamily: FONT }}>{item.reposts}</span>
            </button>
            <button
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#3a3a3a", padding: 0 }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#f43f5e")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#3a3a3a")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
              <span style={{ fontSize: 11, fontFamily: FONT }}>{item.likes}</span>
            </button>

            {/* Change badge */}
            {item.change && (
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  fontWeight: 700,
                  color: item.positive ? "#22c55e" : "#f43f5e",
                  background: (item.positive ? "#22c55e" : "#f43f5e") + "15",
                  padding: "3px 8px",
                  borderRadius: 6,
                  fontFamily: FONT,
                  letterSpacing: "0.2px",
                }}
              >
                {item.positive ? "▲" : "▼"} {item.change}
              </span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

// ── Nav Icons ──
function HomeIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>; }
function MsgIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>; }
function HelpIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="currentColor" strokeWidth="1.5"/></svg>; }
function NewsIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 22H18C19.1 22 20 21.1 20 20V8L14 2H6C4.9 2 4 2.9 4 4V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2V8H20" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M2 15H10M2 18H8M2 12H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>; }

const NAV = [
  { id: "home" as Tab, label: "Home", Icon: HomeIcon },
  { id: "messages" as Tab, label: "Messages", Icon: MsgIcon },
  { id: "help" as Tab, label: "Help", Icon: HelpIcon },
  { id: "news" as Tab, label: "News", Icon: NewsIcon },
];

export default function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [helpView, setHelpView] = useState<HelpView>("landing");
  const [activeSector, setActiveSector] = useState<(typeof SECTORS)[0] | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [helpMessages, setHelpMessages] = useState<Message[]>([]);
  const [streamingMsgIds, setStreamingMsgIds] = useState<Set<number>>(new Set());

  const [input, setInput] = useState("");
  const [helpInput, setHelpInput] = useState("");
  const [aiActive, setAiActive] = useState(false);

  // News state
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsLastFetched, setNewsLastFetched] = useState<Date | null>(null);
  const newsFetched = useRef(false);

  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 360, h: 475 });
  const [introSent, setIntroSent] = useState(false);

  const msgsEnd = useRef<HTMLDivElement>(null);
  const helpMsgsEnd = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ sx: number; sy: number; sw: number; sh: number } | null>(null);
  const sentenceDoneCallbacks = useRef<Record<number, () => void>>({});

  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const helpUserMsgCount = helpMessages.filter((m) => m.role === "user").length;
  const showEscalation = userMsgCount >= ESCALATION_THRESHOLD;
  const showHelpEscalation = helpUserMsgCount >= ESCALATION_THRESHOLD;
  const lastMsgIsUser = messages.length > 0 && messages[messages.length - 1].role === "user";
  const lastHelpMsgIsUser = helpMessages.length > 0 && helpMessages[helpMessages.length - 1].role === "user";

  useEffect(() => {
    setPos({ x: window.innerWidth - size.w - 28, y: window.innerHeight - size.h - 28 });
  }, []);

  useEffect(() => { msgsEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, aiActive]);
  useEffect(() => { helpMsgsEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [helpMessages, aiActive]);

  // Fetch news when news tab opens (once per session, with manual refresh)
  const fetchNews = useCallback(async (force = false) => {
    if (newsLoading) return;
    if (!force && newsFetched.current) return;
    newsFetched.current = true;
    setNewsLoading(true);
    setNewsError(null);
    try {
      const res = await fetch("/api/news");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setNewsItems(data.news || []);
      setNewsLastFetched(new Date());
    } catch {
      setNewsError("Couldn't load live news. Please try again.");
      newsFetched.current = false;
    } finally {
      setNewsLoading(false);
    }
  }, [newsLoading]);

  // Pre-fetch as soon as widget opens — so news is ready before user clicks the tab
  useEffect(() => {
    if (isOpen) {
      fetchNews();
    }
  }, [isOpen]);

  // Also fetch if user navigates to news tab and cache missed for some reason
  useEffect(() => {
    if (tab === "news" && isOpen && newsItems.length === 0 && !newsLoading) {
      fetchNews();
    }
  }, [tab]);

  const streamSentences = useCallback(
    (sentences: string[], setter: React.Dispatch<React.SetStateAction<Message[]>>, onAllDone: () => void) => {
      let i = 0;
      const streamNext = () => {
        if (i >= sentences.length) { onAllDone(); return; }
        const id = ++msgId;
        setter((prev) => [...prev, { id, role: "assistant", content: sentences[i] }]);
        setStreamingMsgIds((prev) => new Set(prev).add(id));
        const checkDone = () => {
          setStreamingMsgIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
          i++;
          if (i < sentences.length) { setTimeout(streamNext, 300); } else { onAllDone(); }
        };
        sentenceDoneCallbacks.current[id] = checkDone;
      };
      streamNext();
    },
    []
  );

  const callApi = async (msgs: Message[], sector: string): Promise<string> => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sector, messages: msgs.map((m) => ({ role: m.role, content: m.content })) }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.reply;
  };

  const handleAiResponse = useCallback(
    async (newMessages: Message[], sector: string, setter: React.Dispatch<React.SetStateAction<Message[]>>) => {
      setAiActive(true);
      try {
        const reply = await callApi(newMessages, sector);
        const sentences = splitIntoSentences(reply);
        streamSentences(sentences, setter, () => setAiActive(false));
      } catch {
        const id = ++msgId;
        setter((prev) => [...prev, { id, role: "assistant", content: "Something went wrong. Email support@rawfunded.com and we'll help you right away." }]);
        setStreamingMsgIds((prev) => new Set(prev).add(id));
        sentenceDoneCallbacks.current[id] = () => {
          setStreamingMsgIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
          setAiActive(false);
        };
      }
    },
    [streamSentences]
  );

  useEffect(() => {
    if (tab === "messages" && isOpen && !introSent) {
      setIntroSent(true);
      setAiActive(true);
      setTimeout(() => {
        const sentences = splitIntoSentences("Hey! I'm your Raw Funded assistant. How can I help you today?");
        streamSentences(sentences, setMessages, () => setAiActive(false));
      }, 1200);
    }
  }, [tab, isOpen, introSent, streamSentences]);

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { ox: e.clientX - pos.x, oy: e.clientY - pos.y };
      const onMove = (e: MouseEvent) => {
        if (!dragRef.current) return;
        setPos({ x: Math.max(0, Math.min(window.innerWidth - size.w - 10, e.clientX - dragRef.current.ox)), y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragRef.current.oy)) });
      };
      const onUp = () => { dragRef.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [pos, size]
  );

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      resizeRef.current = { sx: e.clientX, sy: e.clientY, sw: size.w, sh: size.h };
      const onMove = (e: MouseEvent) => {
        if (!resizeRef.current) return;
        setSize({ w: Math.max(340, Math.min(620, resizeRef.current.sw + e.clientX - resizeRef.current.sx)), h: Math.max(480, Math.min(780, resizeRef.current.sh + e.clientY - resizeRef.current.sy)) });
      };
      const onUp = () => { resizeRef.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [size]
  );

  const sendMessage = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || aiActive || lastMsgIsUser) return;
      setInput("");
      const newMessages: Message[] = [...messages, { id: ++msgId, role: "user", content }];
      setMessages(newMessages);
      await handleAiResponse(newMessages, "messages", setMessages);
    },
    [input, aiActive, lastMsgIsUser, messages, handleAiResponse]
  );

  const sendHelpMessage = useCallback(
    async (text?: string) => {
      const content = (text ?? helpInput).trim();
      if (!content || aiActive || lastHelpMsgIsUser || !activeSector) return;
      setHelpInput("");
      const newMessages: Message[] = [...helpMessages, { id: ++msgId, role: "user", content }];
      setHelpMessages(newMessages);
      await handleAiResponse(newMessages, activeSector.id, setHelpMessages);
    },
    [helpInput, aiActive, lastHelpMsgIsUser, helpMessages, activeSector, handleAiResponse]
  );

  const handleMsgInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
  };
  const handleHelpInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setHelpInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
  };
  const handleMsgKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };
  const handleHelpKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendHelpMessage(); }
  };

  const AiMsg = ({ m }: { m: Message }) => {
    const isStreaming = streamingMsgIds.has(m.id);
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <LionAvatar circleSize={36} imgSize={28} />
        <div style={{ maxWidth: "76%", padding: "11px 14px", fontSize: 13.5, lineHeight: 1.65, fontFamily: FONT, borderRadius: "18px 18px 18px 4px", background: CARD, color: "#e8e8e8", fontWeight: 400, whiteSpace: "pre-wrap" }}>
          {isStreaming ? <StreamingMessage content={m.content} onDone={() => { sentenceDoneCallbacks.current[m.id]?.(); }} /> : m.content}
        </div>
      </div>
    );
  };

  const UserMsg = ({ m }: { m: Message }) => (
    <div style={{ maxWidth: "76%", padding: "11px 14px", fontSize: 13.5, lineHeight: 1.65, fontFamily: FONT, borderRadius: "18px 18px 4px 18px", background: GOLD, color: "#0f0f0f", fontWeight: 500, whiteSpace: "pre-wrap", alignSelf: "flex-end" }}>
      {m.content}
    </div>
  );

  const renderMessages = (msgs: Message[], isHelp = false) => (
    <>
      {msgs.map((m) => (
        <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", animation: "rf-msg-in 0.22s cubic-bezier(0.34,1.4,0.64,1)" }}>
          {m.role === "assistant" ? <AiMsg m={m} /> : <UserMsg m={m} />}
        </div>
      ))}
      {aiActive && streamingMsgIds.size === 0 && <TypingBubble />}
      {(isHelp ? showHelpEscalation : showEscalation) && !aiActive && <EscalationBanner />}
    </>
  );

  if (!isOpen) {
    return (
      <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 9999 }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
          @keyframes rf-ripple { 0% { box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 0 0 rgba(201,168,76,0.6); } 50% { box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 0 12px rgba(201,168,76,0); } 100% { box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 0 0 rgba(201,168,76,0); } }
          .rf-bbl { animation: rf-ripple 2.2s ease-out infinite; transition: transform 0.2s ease; }
          .rf-bbl:hover { transform: scale(1.07); }
        `}</style>
        <button className="rf-bbl" onClick={() => setIsOpen(true)} style={{ width: 72, height: 72, borderRadius: "50%", background: DARK, border: `2px solid ${GOLD}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
          <img src={lionImg} alt="Support" width={60} height={54} style={{ objectFit: "contain", filter: LION_FILTER, transform: "scale(1.2)" }} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 9999, width: size.w, height: size.h, display: "flex", flexDirection: "column", background: DARK, borderRadius: 22, border: `1px solid ${BORDER}`, boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.3)", overflow: "hidden", fontFamily: FONT, animation: "rf-pop 0.28s cubic-bezier(0.34,1.56,0.64,1)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes rf-pop { from { opacity:0; transform:scale(0.88) translateY(18px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes rf-fade-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes rf-msg-in { from { opacity:0; transform:translateY(10px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes rf-typing { 0%,60%,100% { transform:translateY(0); opacity:0.3; } 30% { transform:translateY(-5px); opacity:1; } }
        @keyframes rf-cursor { 0%,100% { opacity:1; } 50% { opacity:0; } }
        @keyframes rf-word-in { from { opacity:0; } to { opacity:1; } }
        @keyframes rf-slide-right { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
        @keyframes rf-pulse { 0%,100% { opacity:0.5; } 50% { opacity:1; } }
        @keyframes rf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .rf-ctrl:hover { background:rgba(255,255,255,0.12) !important; }
        .rf-nav:hover { color:#fff !important; }
        .rf-nav { transition: color 0.15s ease !important; }
        .rf-sector:hover { background:rgba(255,255,255,0.06) !important; border-color:rgba(201,168,76,0.25) !important; }
        .rf-sector { transition: all 0.15s ease !important; }
        .rf-chip:hover { background:rgba(201,168,76,0.12) !important; border-color:rgba(201,168,76,0.4) !important; color:#fff !important; }
        .rf-chip { transition: all 0.15s ease !important; }
        .rf-input:focus { border-color:rgba(201,168,76,0.8) !important; outline:none; box-shadow: 0 0 0 2px rgba(201,168,76,0.12); }
        .rf-input:not(:disabled) { transition: border-color 0.2s, box-shadow 0.2s !important; }
        .rf-news-card:hover { background: #1e2023 !important; border-color: rgba(255,255,255,0.1) !important; }
        .rf-refresh:hover { background: rgba(201,168,76,0.15) !important; color: ${GOLD} !important; }
        .rf-refresh { transition: all 0.15s ease !important; }
        .rf-back:hover { color:#fff !important; }
        .rf-back { transition: color 0.15s ease !important; }
        .rf-msgs::-webkit-scrollbar { width:3px; }
        .rf-msgs::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:4px; }
      `}</style>

      {/* HEADER */}
      <div onMouseDown={onDragStart} style={{ padding: "13px 15px 11px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "grab", userSelect: "none", flexShrink: 0, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {tab === "help" && helpView === "chat" && (
            <button className="rf-back" onMouseDown={(e) => e.stopPropagation()} onClick={() => { setHelpView("landing"); setActiveSector(null); setHelpMessages([]); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", display: "flex", padding: "0 4px 0 0" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          )}
          <LionAvatar circleSize={44} imgSize={40} />
          <div>
            <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 13.5, color: "#fff" }}>
              {tab === "help" && helpView === "chat" && activeSector ? activeSector.label : "Raw Funded"}
            </div>
            <div style={{ fontSize: 11, color: GOLD, display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
              <span style={{ width: 5.5, height: 5.5, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              Online
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 5 }} onMouseDown={(e) => e.stopPropagation()}>
          <button className="rf-ctrl" onClick={() => setIsOpen(false)} style={{ width: 27, height: 27, borderRadius: 7, border: "none", background: "rgba(255,255,255,0.06)", color: "#666", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="10" height="2" viewBox="0 0 10 2"><path d="M0.5 1H9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
          <button className="rf-ctrl" onClick={() => setIsOpen(false)} style={{ width: 27, height: 27, borderRadius: 7, border: "none", background: "rgba(255,255,255,0.06)", color: "#666", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>

      {/* BODY */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* HOME */}
        {tab === "home" && (
          <div className="rf-msgs" style={{ flex: 1, overflowY: "auto", padding: "22px 16px", animation: "rf-fade-up 0.24s ease" }}>
            <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 22, color: "#fff", letterSpacing: "-0.4px", marginBottom: 20 }}>Hi there 👋</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { t: "messages" as Tab, title: "Send a message", sub: "Chat with our AI support", Icon: MsgIcon },
                { t: "help" as Tab, title: "Browse help topics", sub: "Payouts, billing, login & more", Icon: HelpIcon },
                { t: "news" as Tab, title: "Market news", sub: "Live updates on your instruments", Icon: NewsIcon },
              ].map((item, i) => (
                <button key={item.t} onClick={() => setTab(item.t)}
                  style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 13, cursor: "pointer", textAlign: "left", animation: `rf-fade-up ${0.12 + i * 0.07}s ease both`, transition: "border-color 0.15s ease" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(201,168,76,0.3)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = BORDER)}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(201,168,76,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: GOLD }}>
                    <item.Icon />
                  </div>
                  <div>
                    <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 14, color: "#fff" }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{item.sub}</div>
                  </div>
                  <div style={{ marginLeft: "auto", color: "#444" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MESSAGES */}
        {tab === "messages" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div className="rf-msgs" style={{ flex: 1, overflowY: "auto", padding: "16px 14px 10px", display: "flex", flexDirection: "column", gap: 12 }}>
              {renderMessages(messages)}
              <div ref={msgsEnd} />
            </div>
            <InputBar val={input} blocked={aiActive || lastMsgIsUser} onChange={handleMsgInput} onKeyDown={handleMsgKeyDown} onSend={sendMessage} placeholder="Message..." />
          </div>
        )}

        {/* HELP */}
        {tab === "help" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {helpView === "landing" && (
              <div className="rf-msgs" style={{ flex: 1, overflowY: "auto", padding: "18px 14px", animation: "rf-fade-up 0.22s ease" }}>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 17, color: "#fff", marginBottom: 14 }}>How can we help?</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {SECTORS.map((s, i) => (
                    <button key={s.id} className="rf-sector" onClick={() => { setActiveSector(s); setHelpMessages([]); setHelpView("chat"); }}
                      style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 13, padding: "10px 10px", textAlign: "left", display: "flex", flexDirection: "column", gap: 8, animation: `rf-fade-up ${0.12 + i * 0.05}s ease both` }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: s.color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={s.color}><path d={s.icon}/></svg>
                      </div>
                      <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 12.5, color: "#ccc" }}>{s.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {helpView === "chat" && activeSector && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", animation: "rf-slide-right 0.22s ease" }}>
                <div className="rf-msgs" style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px", display: "flex", flexDirection: "column", gap: 12 }}>
                  {helpMessages.length === 0 && !aiActive && (
                    <div style={{ animation: "rf-fade-up 0.24s ease" }}>
                      <div style={{ fontSize: 13.5, color: "#666", marginBottom: 14, lineHeight: 1.65 }}>
                        You're in <span style={{ fontWeight: 700, color: "#ccc" }}>{activeSector.label}</span>. Pick a question or ask anything.
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                        {activeSector.chips.map((c) => (
                          <button key={c} className="rf-chip" onClick={() => sendHelpMessage(c)} style={{ fontSize: 12.5, padding: "7px 12px", borderRadius: 20, border: "1.5px solid rgba(255,255,255,0.1)", background: "transparent", cursor: "pointer", color: "#999", fontFamily: FONT, fontWeight: 500 }}>
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {renderMessages(helpMessages, true)}
                  <div ref={helpMsgsEnd} />
                </div>
                <InputBar val={helpInput} blocked={aiActive || lastHelpMsgIsUser} onChange={handleHelpInput} onKeyDown={handleHelpKeyDown} onSend={sendHelpMessage} placeholder={`Ask about ${activeSector.label.toLowerCase()}...`} />
              </div>
            )}
          </div>
        )}

        {/* NEWS — redesigned as X/social feed */}
        {tab === "news" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* News header bar */}
            <div style={{ padding: "14px 14px 10px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 16, color: "#fff", letterSpacing: "-0.3px" }}>Market Feed</div>
                {newsLastFetched && !newsLoading && (
                  <div style={{ fontSize: 10.5, color: "#3a3a3a", marginTop: 1, fontFamily: FONT }}>
                    Updated {newsLastFetched.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Powered by badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#555", fontFamily: FONT }}>via</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#777", fontFamily: FONT, letterSpacing: "-0.3px" }}>𝕏 Grok</span>
                </div>
                {/* Refresh button */}
                <button
                  className="rf-refresh"
                  onClick={() => fetchNews(true)}
                  disabled={newsLoading}
                  title="Refresh news"
                  style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "rgba(255,255,255,0.05)", color: "#555", cursor: newsLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ animation: newsLoading ? "rf-spin 0.8s linear infinite" : "none" }}>
                    <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Feed content */}
            <div className="rf-msgs" style={{ flex: 1, overflowY: "auto", padding: "10px 12px 14px", display: "flex", flexDirection: "column", gap: 8, animation: "rf-fade-up 0.22s ease" }}>
              {newsLoading && <NewsSkeleton />}

              {newsError && !newsLoading && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 12, padding: "40px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 32 }}>📡</div>
                  <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 14, color: "#555" }}>{newsError}</div>
                  <button onClick={() => fetchNews(true)} style={{ padding: "8px 18px", borderRadius: 10, border: `1px solid ${GOLD}40`, background: `${GOLD}10`, color: GOLD, cursor: "pointer", fontFamily: FONT, fontWeight: 600, fontSize: 13 }}>
                    Try again
                  </button>
                </div>
              )}

              {!newsLoading && !newsError && newsItems.length === 0 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 10, padding: "40px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 28 }}>📰</div>
                  <div style={{ fontFamily: FONT, fontSize: 13, color: "#555" }}>No news loaded yet</div>
                </div>
              )}

              {!newsLoading && newsItems.map((item, i) => (
                <NewsCard key={`${item.tag}-${i}`} item={item} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ display: "flex", borderTop: `1px solid ${BORDER}`, background: DARK, flexShrink: 0 }}>
        {NAV.map(({ id, label, Icon }) => (
          <button key={id} className="rf-nav" onClick={() => { if (!aiActive) setTab(id); }} disabled={aiActive && tab !== id} style={{ flex: 1, padding: "11px 0 13px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, border: "none", background: "transparent", cursor: aiActive && tab !== id ? "not-allowed" : "pointer", color: tab === id ? GOLD : aiActive ? "#2a2a2a" : "#444", borderTop: `2px solid ${tab === id ? GOLD : "transparent"}`, opacity: aiActive && tab !== id ? 0.4 : 1, transition: "color 0.15s ease, opacity 0.15s ease" }}>
            <Icon />
            <span style={{ fontSize: 10.5, fontFamily: FONT, fontWeight: 600, letterSpacing: "0.2px" }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Resize handle */}
      <div onMouseDown={onResizeStart} style={{ position: "absolute", bottom: 52, right: 0, width: 20, height: 20, cursor: "se-resize", zIndex: 2, display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: "0 4px 4px 0" }}>
        <svg width="9" height="9" viewBox="0 0 10 10"><path d="M8.5 1.5L1.5 8.5M8.5 5.5L5.5 8.5" stroke="#333" strokeWidth="1.3" strokeLinecap="round"/></svg>
      </div>
    </div>
  );
}
