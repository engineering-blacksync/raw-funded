import React from "react";
// ── Raw Funded Dashboard (replaces the CRM dashboard image) ──────────────────
const RawFundedDashboard = () => {
  const mono = "'JetBrains Mono', monospace";

  const stats = [
    { label: "Net P&L Today",  value: "+$4,040", sub: "+21.07% from last session", iconBg: "#166534", icon: "📈" },
    { label: "Active Trades",  value: "3",        sub: "+2 from last session",       iconBg: "#1e3a8a", icon: "⚡" },
    { label: "Account Value",  value: "$57,340",  sub: "+$4,040 today",             iconBg: "#5b21b6", icon: "💰" },
    { label: "Win Rate",       value: "94.12%",   sub: "+0.8% from yesterday",       iconBg: "#9a3412", icon: "🎯" },
  ];

  const recentTrades = [
    { icon: "📈", name: "Micro Gold",   sub: "XAUUSD · LONG · 5 lots",  tag: "Hot Win",  tagColor: "#22C55E", tagBg: "#14532d" },
    { icon: "📈", name: "Micro Silver", sub: "XAGUSD · LONG · 2 lots",  tag: "Open",     tagColor: "#3B82F6", tagBg: "#1e3a8a" },
    { icon: "📉", name: "MNQ Short",    sub: "MNQ · SHORT · 1 lot",     tag: "Stop Hit", tagColor: "#EF4444", tagBg: "#450a0a" },
    { icon: "💸", name: "Withdrawal",   sub: "Wise · Processed",         tag: "Paid",     tagColor: "#E8C547", tagBg: "#422006" },
  ];

  const recentActivity = [
    { icon: "💸", text: "Withdrawal processed · $4,040",  time: "2 hours ago"  },
    { icon: "⬡",  text: "Titan tier unlocked",             time: "4 hours ago"  },
    { icon: "✅", text: "Trade closed · XAUUSD +$1,200",  time: "6 hours ago"  },
  ];

  // Simple SVG line chart for P&L
  const LineChart = () => {
    const points = "0,80 40,72 80,78 120,58 160,62 200,42 240,48 280,28 320,34 360,14 400,8 440,2";
    return (
      <svg viewBox="0 0 440 90" style={{ width: "100%", height: "100%" }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="rfGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22C55E" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[18, 36, 54, 72].map(y => <line key={y} x1="0" y1={y} x2="440" y2={y} stroke="#27272a" strokeWidth="1" />)}
        {["Jan","Feb","Mar","Apr","May","Jun"].map((m, i) => (
          <text key={m} x={i * 88} y={88} fill="#52525b" fontSize="8" fontFamily={mono}>{m}</text>
        ))}
        <polygon points={`0,80 ${points} 440,80`} fill="url(#rfGrad)" />
        <polyline points={points} stroke="#22C55E" strokeWidth="2" fill="none" />
        {points.split(" ").map((p, i) => {
          const [x, y] = p.split(",");
          return <circle key={i} cx={x} cy={y} r="3" fill="#22C55E" stroke="#111113" strokeWidth="1.5" />;
        })}
      </svg>
    );
  };

  // Donut chart for tier distribution
  const DonutChart = () => {
    const r = 38, cx = 50, cy = 50, circ = 2 * Math.PI * r;
    const slices = [
      { pct: 45, color: "#22C55E", label: "Titan" },
      { pct: 30, color: "#E8C547", label: "Elite" },
      { pct: 15, color: "#3B82F6", label: "Verified" },
      { pct: 10, color: "#71717A", label: "Unverified" },
    ];
    let offset = 0;
    return (
      <svg viewBox="0 0 200 110" style={{ width: "100%", height: "100%" }}>
        {slices.map(s => {
          const dash = s.pct / 100 * circ;
          const el = (
            <circle key={s.label} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="16"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset * circ / 100}
              style={{ transform: `rotate(-90deg)`, transformOrigin: `${cx}px ${cy}px` }} />
          );
          offset += s.pct; return el;
        })}
        <circle cx={cx} cy={cy} r={26} fill="#111113" />
        <text x={cx} y={cx - 3} fill="#F4F4F5" fontSize="11" fontFamily={mono} textAnchor="middle" fontWeight="700">Titan</text>
        <text x={cx} y={cx + 9} fill="#71717A" fontSize="7" fontFamily={mono} textAnchor="middle">45.0%</text>
        {slices.map((s, i) => (
          <g key={s.label}>
            <text x={105} y={18 + i * 22} fill={s.color} fontSize="8" fontFamily={mono}>{s.label}: {s.pct}%</text>
          </g>
        ))}
      </svg>
    );
  };

  return (
    <div style={{ background: "#0d0d10", border: "1px solid #27272a", borderRadius: 10, overflow: "hidden", color: "#F4F4F5", fontSize: 12, fontFamily: "'Barlow', sans-serif" }}>
      <div style={{ display: "flex", height: 510 }}>

        {/* Sidebar */}
        <div style={{ width: 155, background: "#111113", borderRight: "1px solid #27272a", padding: "14px 0", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px 12px", borderBottom: "1px solid #27272a", marginBottom: 6 }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, background: "#E8C547", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>⚡</div>
            <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 14, letterSpacing: 1 }}>
              RAW<span style={{ color: "#E8C547" }}>FUNDED</span>
            </span>
          </div>
          {[
            { icon: "⬛", label: "Dashboard", on: true  },
            { icon: "📊", label: "Terminal",  on: false },
            { icon: "🧭", label: "Compass",   on: false },
            { icon: "🏆", label: "Leaderboard",on:false },
            { icon: "🔓", label: "Verify",    on: false },
            { icon: "💸", label: "Withdraw",  on: false },
            { icon: "⚙️", label: "Settings",  on: false },
          ].map(item => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", cursor: "pointer",
              background: item.on ? "#1a1a1f" : "transparent",
              color: item.on ? "#F4F4F5" : "#71717A", fontSize: 12,
            }}>
              <span style={{ fontSize: 13 }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Main */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Header */}
          <div style={{ background: "#111113", borderBottom: "1px solid #27272a", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Dashboard</div>
              <div style={{ color: "#71717A", fontSize: 11, marginTop: 1 }}>Welcome back. Here's what's happening today.</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#1a1a1f", border: "1px solid #27272a", borderRadius: 6, padding: "5px 10px", minWidth: 130 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <span style={{ fontFamily: mono, fontSize: 10, color: "#52525B" }}>Search...</span>
              </div>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: "#1a1a1f", border: "1px solid #27272a", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                <div style={{ position: "absolute", top: 5, right: 5, width: 5, height: 5, borderRadius: "50%", background: "#EF4444" }} />
              </div>
            </div>
          </div>

          {/* 4 stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "#27272a", flexShrink: 0 }}>
            {stats.map(s => (
              <div key={s.label} style={{ background: "#111113", padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <span style={{ color: "#71717A", fontSize: 10 }}>{s.label}</span>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{s.icon}</div>
                </div>
                <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: "#F4F4F5", letterSpacing: -0.5 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#71717A", marginTop: 3 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#27272a", flexShrink: 0 }}>
            <div style={{ background: "#111113", padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>P&L Performance</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#1a1a1f", border: "1px solid #27272a", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>
                  <span style={{ fontFamily: mono, fontSize: 9, color: "#71717A" }}>Last 6 months</span>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
              <div style={{ height: 95 }}><LineChart /></div>
            </div>
            <div style={{ background: "#111113", padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Tier Distribution</span>
                <span style={{ fontFamily: mono, fontSize: 9, color: "#52525B", cursor: "pointer" }}>View All</span>
              </div>
              <div style={{ height: 95 }}><DonutChart /></div>
            </div>
          </div>

          {/* Bottom: Recent Traders + Recent Activities */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#27272a", flex: 1, overflow: "hidden" }}>
            <div style={{ background: "#111113", padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Recent Trades</span>
                <span style={{ fontFamily: mono, fontSize: 9, color: "#52525B", cursor: "pointer" }}>View All</span>
              </div>
              {recentTrades.map(t => (
                <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: "#1a1a1f", border: "1px solid #27272a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{t.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: "#71717A" }}>{t.sub}</div>
                  </div>
                  <div style={{ background: t.tagBg, color: t.tagColor, borderRadius: 4, padding: "2px 8px", fontFamily: mono, fontSize: 9, fontWeight: 600, flexShrink: 0 }}>{t.tag}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#111113", padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Recent Activities</span>
                <span style={{ fontFamily: mono, fontSize: 9, color: "#52525B", cursor: "pointer" }}>View All</span>
              </div>
              {recentActivity.map(a => (
                <div key={a.text} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: "#1a1a1f", border: "1px solid #27272a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{a.icon}</div>
                  <div>
                    <div style={{ fontSize: 11, color: "#A1A1AA" }}>{a.text}</div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: "#52525B", marginTop: 1 }}>{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RawFundedDashboard;
