import { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import MacOSMenuBar from "@/components/ui/mac-os-menu-bar";
import { ArrowLeft, Send, Bot, User, Loader2, Sparkles, TrendingUp, AlertTriangle, BarChart2, Target } from "lucide-react";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_ACTIONS = [
  { label: "Analyze my trades", icon: BarChart2, prompt: "Give me a full analysis of my trading performance. Be honest and direct about what I'm doing well and where I'm failing." },
  { label: "Calculate my ROI", icon: TrendingUp, prompt: "Calculate my ROI and break down my profitability. How am I performing relative to my starting balance?" },
  { label: "Show my biggest issues", icon: AlertTriangle, prompt: "What are the biggest problems in my trading? Identify patterns of poor decision-making, overtrading, or any red flags you see." },
  { label: "Best/worst instruments", icon: Target, prompt: "Break down my performance by instrument. Which ones am I profitable on and which ones are costing me money? Should I stop trading any of them?" },
  { label: "Worst trades review", icon: AlertTriangle, prompt: "Review my worst trades. What went wrong in each one? Are there common patterns — bad entries, missing stop losses, wrong instrument, wrong timing? Be brutally honest." },
];

const COLLEAGUE_MENUS = [
  {
    label: 'Analysis',
    items: [
      { label: 'Full Performance Review', action: 'full-review' },
      { label: 'ROI Breakdown', action: 'roi' },
      { label: 'Risk Assessment', action: 'risk' },
      { label: '', type: 'separator' as const },
      { label: 'Instrument Analysis', action: 'instruments' },
      { label: 'Win/Loss Streaks', action: 'streaks' },
    ],
  },
  {
    label: 'Metrics',
    items: [
      { label: 'Win Rate & P&L', action: 'win-rate' },
      { label: 'Profit Factor', action: 'profit-factor' },
      { label: 'Risk/Reward Ratio', action: 'risk-reward' },
      { label: '', type: 'separator' as const },
      { label: 'Max Drawdown', action: 'drawdown' },
      { label: 'Trade Duration', action: 'duration' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Trading Patterns', action: 'patterns' },
      { label: 'Overtrading Check', action: 'overtrading' },
      { label: 'Stop Loss Usage', action: 'sl-usage' },
      { label: '', type: 'separator' as const },
      { label: 'Buy vs Sell Bias', action: 'side-bias' },
    ],
  },
];

const MENU_ACTION_PROMPTS: Record<string, string> = {
  'full-review': "Give me a comprehensive performance review of all my trades.",
  'roi': "Calculate my ROI and break it down in detail.",
  'risk': "Assess my risk management. Am I protecting my capital properly?",
  'instruments': "Analyze my performance across all instruments I've traded.",
  'streaks': "What are my win/loss streaks? Am I prone to revenge trading after losses?",
  'win-rate': "Break down my win rate and P&L in detail.",
  'profit-factor': "Analyze my profit factor. Is my edge sustainable?",
  'risk-reward': "What's my risk/reward ratio? Am I risking too much for too little?",
  'drawdown': "Analyze my max drawdown and how I handle losses.",
  'duration': "How long do I typically hold trades? Am I cutting winners short or letting losers run?",
  'patterns': "Identify any patterns in my trading behavior — good or bad.",
  'overtrading': "Am I overtrading? Analyze my trade frequency and whether quantity is hurting quality.",
  'sl-usage': "How consistently do I use stop losses? Is poor risk management costing me?",
  'side-bias': "Do I have a bias toward buying or selling? Is it costing me money?",
};

export default function AIPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user)) setLocation("/login");
    if (!isLoading && user && user.status !== "approved") setLocation("/pending");
  }, [isLoading, isAuthenticated, user, setLocation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isTyping) return;

    const userMessage: ChatMessage = { role: 'user', content: content.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    try {
      const res = await apiRequest("POST", "/api/ai/chat", {
        messages: newMessages,
      });
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.response }]);
    } catch (err: any) {
      setMessages([...newMessages, { role: 'assistant', content: "Something went wrong. Try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleMenuAction = (action: string) => {
    const prompt = MENU_ACTION_PROMPTS[action];
    if (prompt) sendMessage(prompt);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-ai">
      <div className="p-3 pb-0">
        <MacOSMenuBar
          appName="Blacksync Colleague"
          menus={COLLEAGUE_MENUS}
          onMenuAction={handleMenuAction}
        />
      </div>

      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" data-testid="link-back-dashboard">
            <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-s1 border border-b1 text-muted-foreground hover:text-white hover:border-b2 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30 flex items-center justify-center">
              <Bot className="w-5 h-5 text-gold" />
            </div>
            <div>
              <h1 className="text-lg font-heading text-white tracking-wider uppercase" data-testid="text-page-title">Blacksync Colleague</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">AI Trading Analyst</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-s1 border border-b1 rounded-lg px-3 py-1.5">
            <div className="w-2 h-2 rounded-full bg-green animate-pulse" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Online</span>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-xs text-muted-foreground">Logged in as</div>
            <div className="text-sm text-white font-medium" data-testid="text-username">{user.username}</div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden mx-4 mb-4 bg-s1 border border-b1 rounded-xl">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/20 flex items-center justify-center mb-6">
                <Sparkles className="w-10 h-10 text-gold" />
              </div>
              <h2 className="text-2xl font-heading text-white uppercase tracking-wider mb-2" data-testid="text-welcome">What's up, {user.username}.</h2>
              <p className="text-sm text-muted-foreground max-w-md mb-8">
                I have full access to your trade history. Ask me anything about your performance, or use a quick action below to get started.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-2xl w-full">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => sendMessage(action.prompt)}
                    className="flex items-center gap-3 bg-background border border-b1 rounded-lg px-4 py-3 text-left hover:border-gold/40 hover:bg-gold/5 transition-all group"
                    data-testid={`btn-quick-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <action.icon className="w-4 h-4 text-muted-foreground group-hover:text-gold transition-colors shrink-0" />
                    <span className="text-sm text-muted-foreground group-hover:text-white transition-colors">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-gold" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-gold/10 border border-gold/20 text-white'
                    : 'bg-background border border-b1 text-[#d4d4d8]'
                }`}
                data-testid={`msg-${msg.role}-${i}`}
              >
                {formatMessage(msg.content)}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-s2 border border-b2 flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-gold" />
              </div>
              <div className="bg-background border border-b1 rounded-xl px-4 py-3 flex items-center gap-2" data-testid="typing-indicator">
                <Loader2 className="w-4 h-4 text-gold animate-spin" />
                <span className="text-sm text-muted-foreground">Analyzing your data...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-b1 p-4">
          {messages.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.prompt)}
                  disabled={isTyping}
                  className="flex items-center gap-1.5 bg-background border border-b1 rounded-full px-3 py-1.5 text-[11px] text-muted-foreground hover:border-gold/40 hover:text-white transition-all whitespace-nowrap disabled:opacity-50"
                  data-testid={`btn-inline-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <action.icon className="w-3 h-3" />
                  {action.label}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your trading performance..."
              rows={1}
              className="flex-1 bg-background border border-b1 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground outline-none focus:border-gold/50 transition-colors resize-none"
              style={{ maxHeight: '120px' }}
              data-testid="input-chat"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-gold text-black hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              data-testid="btn-send"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function formatMessage(content: string): React.ReactNode {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}
