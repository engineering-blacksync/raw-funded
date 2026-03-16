i
      }

      const body: any = {
        instrument: activeInstrument.label,
        side,
        contracts: quantity,
        size,
        entryPrice: fillPrice,
      };
      if (orderSl) body.stopLoss = parseFloat(orderSl);
      if (orderTp) body.takeProfit = parseFloat(orderTp);

      const response = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const trade: Trade = await response.json();
        if (supabaseId) {
          setSupabaseTradeIds(prev => ({ ...prev, [trade.id]: supabaseId! }));
        }
        setTradeStatus({ type: 'success', message: `${side} ${quantity} ${activeInstrument.label} submitted — awaiting MT5 fill` });

        setOrderSl('');
        setOrderTp('');
        setTimeout(() => setTradeStatus(null), 3000);
      } else {
        const err = await response.json().catch(() => ({ message: 'Unknown error' }));
        setTradeStatus({ type: 'error', message: err.message || 'Order failed' });
        setTimeout(() => setTradeStatus(null), 5000);
      }
    } catch {
      setTradeStatus({ type: 'error', message: 'Connection error' });
      setTimeout(() => setTradeStatus(null), 5000);
    } finally {
      setTradeLoading(null);
    }
  };

  const closeTradeViaServer = async (localTradeId: string | null, supabaseId: string | null, exitPrice: number) => {
    const res = await fetch('/api/trades/close-with-supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localTradeId, supabaseId, exitPrice }),
    });
    if (res.ok) return await res.json();
    return null;
  };

  const handleClose = async (tradeId: string, exitPriceOverride?: number) => {
    if (closingId === tradeId || closingIdsRef.current.has(tradeId)) return;
    const localTrade = openTrades.find(t => t.id === tradeId);
    if (!localTrade || localTrade.mt5Status !== 'filled') return;
    closingIdsRef.current.add(tradeId);
    setClosingId(tradeId);
    const instrument = localTrade.instrument;
    const sbId = localTrade.supabaseId || supabaseTradeIds[tradeId] || null;

    const rawExitPrice = exitPriceOverride ?? livePrices[instrument];
    if (!rawExitPrice) { closingIdsRef.current.delete(tradeId); setClosingId(null); return; }
    const exitPrice = roundToTick(rawExitPrice, instrument);

    try {
      const closed = await closeTradeViaServer(tradeId, sbId, exitPrice);
      if (closed) {
        setOpenTrades(prev => prev.filter(t => t.id !== tradeId));
        setClosedTrades(prev => [closed, ...prev]);
      }
    } catch {} finally {
      closingIdsRef.current.delete(tradeId);
      setClosingId(null);
    }
  };

  const [closingAll, setClosingAll] = useState(false);
  const [sltpEdit, setSltpEdit] = useState<{ id: string; field: 'sl' | 'tp'; value: string } | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const isDev = import.meta.env.DEV;
  const handleCloseAll = async () => {
    if (closingAll) return;
    setClosingAll(true);

    const filledTrades = openTrades.filter(t => t.mt5Status === 'filled');

    for (const trade of filledTrades) {
      const sbId = trade.supabaseId || supabaseTradeIds[trade.id] || null;
      const rawPrice = livePrices[trade.instrument];
      if (!rawPrice) continue;
      const exitPrice = roundToTick(rawPrice, trade.instrument);

      try {
        closingIdsRef.current.add(trade.id);
        const closed = await closeTradeViaServer(trade.id, sbId, exitPrice);
        if (closed) {
          setOpenTrades(prev => prev.filter(t => t.id !== trade.id));
          setClosedTrades(prev => [closed, ...prev]);
        }
      } catch {} finally {
        closingIdsRef.current.delete(trade.id);
      }
    }

    setClosingAll(false);
  };

  const handleUpdateSLTP = useCallback(async (tradeId: string, field: 'stopLoss' | 'takeProfit', newPrice: number | null) => {
    const trade = openTrades.find(t => t.id === tradeId);
    if (!trade) return;
    const body: any = {
      stopLoss: field === 'stopLoss' ? newPrice : trade.stopLoss,
      takeProfit: field === 'takeProfit' ? newPrice : trade.takeProfit,
    };
    setOpenTrades(prev => prev.map(t => t.id === tradeId ? { ...t, [field]: newPrice } : t));
    try {
      await fetch(`/api/trades/${tradeId}/sltp`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const sbId = trade.supabaseId || supabaseTradeIds[tradeId];
      if (sbId) {
        fetch('/api/supabase/trades/sltp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supabaseId: sbId, stopLoss: body.stopLoss, takeProfit: body.takeProfit }),
        }).catch(() => {});
      }
    } catch {}
  }, [openTrades, supabaseTradeIds]);

  const activePositions = positionsWithPnl.filter(p => p.instrument === activeInstrument.label);

  const displayQty = String(quantity);

  const formatPnl = (val: number) => `${val >= 0 ? '+' : ''}$${val.toFixed(2)}`;

  const formatPrice = (price: number, instrument: string) => {
    if (['MBT', 'Gold', 'S&P 500', 'Nasdaq', 'MNQ', 'MES'].includes(instrument)) {
      return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  return (
    <div className="overflow-y-auto h-full">
      <div className="flex flex-col" style={{ height: '100vh' }}>
        {!bridgeOnline && (
          <div className="bg-[#EF4444] text-white text-center text-xs font-bold py-2 px-3 shrink-0" data-testid="banner-bridge-offline">
            Trading unavailable — market is closed or bridge is offline.
          </div>
        )}
        <div
          className="flex items-center justify-between shrink-0 backdrop-blur-md mx-2 mt-2"
          style={{
            height: '32px',
            background: 'rgba(40, 40, 40, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          }}
          data-testid="instrument-menu-bar"
        >
          <div className="flex items-center overflow-x-auto no-scrollbar px-4 space-x-5">
            {visibleInstruments.map((inst) => (
              <button
                key={inst.label}
                onClick={() => handleInstrumentChange(inst)}
                className={`text-[13px] whitespace-nowrap transition-all duration-150 relative pb-0.5 ${activeInstrument.label === inst.label ? 'text-white font-semibold' : 'text-white/50 hover:text-white/80 font-normal'}`}
                data-testid={`instrument-${inst.label}`}
              >
                {inst.label}
                {activeInstrument.label === inst.label && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ background: '#E8C547' }} />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 px-4 shrink-0">
            <button
              onClick={() => setViewMode('simple')}
              className={`text-[12px] uppercase tracking-wide transition-all duration-150 ${viewMode === 'simple' ? 'text-white font-semibold' : 'text-white/50 hover:text-white/80 font-normal'}`}
              data-testid="btn-simple-mode"
            >
              Simple
            </button>
            <button
              onClick={() => setViewMode('pro')}
              className={`text-[12px] uppercase tracking-wide transition-all duration-150 px-3 py-0.5 rounded-full ${viewMode === 'pro' ? 'text-white font-semibold border border-white/30 bg-white/10' : 'text-white/50 hover:text-white/80 font-normal border border-white/15 bg-transparent'}`}
              data-testid="btn-pro-mode"
            >
              Pro
            </button>
          </div>
        </div>

        {/* Quick Trading Controls */}
        <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-b1 bg-s1/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Quick Trade</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleTrade('BUY')}
                  disabled={tradeLoading !== null || !bridgeOnline}
                  className={`px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                    bridgeOnline 
                      ? 'bg-green/20 text-green border border-green/30 hover:bg-green/30' 
                      : 'bg-s2 text-muted-foreground border border-b2 opacity-50 cursor-not-allowed'
                  }`}
                  data-testid="btn-buy-mkt-top"
                >
                  {tradeLoading === 'BUY' ? '...' : 'Buy Mkt'}
                </button>
                <button
                  onClick={() => handleTrade('SELL')}
                  disabled={tradeLoading !== null || !bridgeOnline}
                  className={`px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
                    bridgeOnline 
                      ? 'bg-red/20 text-red border border-red/30 hover:bg-red/30' 
                      : 'bg-s2 text-muted-foreground border border-b2 opacity-50 cursor-not-allowed'
                  }`}
                  data-testid="btn-sell-mkt-top"
                >
                  {tradeLoading === 'SELL' ? '...' : 'Sell Mkt'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Open P&L</span>
              <span className={`data-number text-sm font-bold ${totalOpenPnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {totalOpenPnl >= 0 ? '+' : ''}${totalOpenPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">{openTrades.length} open</div>
          </div>
        </div>

        <div className="flex-1 flex relative">
          <div className="flex-1 relative bg-background">
            <div ref={chartContainerRef} id="tradingview-chart" className="absolute inset-0" />
            {!tvLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            <PositionLines
              positions={activePositions}
              currentPrice={livePrices[activeInstrument.label] || 0}
              instrumentLabel={activeInstrument.label}
              onUpdateSL={(tradeId, newPrice) => handleUpdateSLTP(tradeId, 'stopLoss', newPrice)}
              onUpdateTP={(tradeId, newPrice) => handleUpdateSLTP(tradeId, 'takeProfit', newPrice)}
            />
          </div>
        </div>

        {showSltp && (
          <div className="shrink-0 border-t border-b1 bg-s1 px-3 py-2 flex gap-3">
            <div className="flex-1 flex items-center gap-1.5">
              <label className="text-[9px] text-red font-bold uppercase shrink-0">SL</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="None"
                value={orderSl}
                onChange={(e) => setOrderSl(e.target.value)}
                className="w-full bg-s2 border border-b2 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-red/50"
                data-testid="input-order-sl"
              />
            </div>
            <div className="flex-1 flex items-center gap-1.5">
              <label className="text-[9px] text-green font-bold uppercase shrink-0">TP</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="None"
                value={orderTp}
                onChange={(e) => setOrderTp(e.target.value)}
                className="w-full bg-s2 border border-b2 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-green/50"
                data-testid="input-order-tp"
              />
            </div>
          </div>
        )}
      </div>
      {positionsWithPnl.length > 0 && (
        <div className="bg-[#0A0A0C]">
          <div className="px-3 py-2 border-b border-b1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Open Positions</span>
              <div className="flex items-center gap-0.5 bg-[#141418] rounded px-1 py-0.5" data-testid="sort-control">
                {([['oldest', 'Old'], ['newest', 'New'], ['loss', 'Loss']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setPositionSort(val)}
                    className={`text-[8px] px-1.5 py-0.5 rounded transition-colors ${positionSort === val ? 'bg-[#222228] text-white font-bold' : 'text-muted-foreground hover:text-white'}`}
                    data-testid={`sort-${val}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleCloseAll}
              disabled={closingAll}
              className="text-[9px] font-bold uppercase text-red hover:text-white bg-red/10 border border-red/30 hover:bg-red/20 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
              data-testid="btn-close-all"
            >
              {closingAll ? 'Closing...' : 'Close All'}
            </button>
          </div>
          {positionsWithPnl.map(pos => {
            const editingSlHere = sltpEdit?.id === pos.id && sltpEdit?.field === 'sl';
            const editingTpHere = sltpEdit?.id === pos.id && sltpEdit?.field === 'tp';

            const confirmSltp = (id: string, field: 'sl' | 'tp') => {
              const val = parseFloat(sltpEdit?.value || '');
              if (!isNaN(val) && val > 0) {
                handleUpdateSLTP(id, field === 'sl' ? 'stopLoss' : 'takeProfit', val);
              }
              setSltpEdit(null);
            };

            return (
              <div key={pos.supabaseId || pos.id} data-testid={`position-row-${pos.id}`}>
                <div className="flex items-center gap-3 px-3 py-2 border-b border-b1 hover:bg-s2/50 transition-colors group">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${pos.side === 'BUY' ? 'bg-[#22C55E] text-white' : 'bg-[#EF4444] text-white'}`}>
                    {pos.side}
                  </span>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded shrink-0 bg-[#22C55E]/20 text-[#22C55E]" data-testid={`badge-mt5-${pos.id}`}>
                    Live
                  </span>
                  <span className="text-white font-bold text-xs shrink-0">
                    {(() => { const inst = INSTRUMENTS.find(i => i.label === pos.instrument); return inst ? Math.round(pos.size / inst.lotSize) : pos.size; })()} {pos.instrument}
                  </span>
                  <span className="text-muted-foreground text-[11px] shrink-0">Entry <span className="text-gold data-number">{formatPrice(pos.entryPrice, pos.instrument)}</span></span>
                  <span className="text-muted-foreground text-[11px] shrink-0">Now <span className="text-white data-number">{pos.currentPrice ? formatPrice(pos.currentPrice, pos.instrument) : '---'}</span></span>
                  <div className="flex items-center gap-1 shrink-0">
                    {pos.stopLoss ? (
                      <button onClick={() => setSltpEdit({ id: pos.id, field: 'sl', value: String(pos.stopLoss) })} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/40 transition-colors">
                        SL {formatPrice(pos.stopLoss, pos.instrument)}
                      </button>
                    ) : (
                      <button onClick={() => setSltpEdit({ id: pos.id, field: 'sl', value: '' })} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-s2 text-muted-foreground border border-b2 hover:text-[#EF4444] hover:border-[#EF4444]/30 transition-colors">
                        + SL
                      </button>
                    )}
                    {pos.takeProfit ? (
                      <button onClick={() => setSltpEdit({ id: pos.id, field: 'tp', value: String(pos.takeProfit) })} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30 hover:bg-[#22C55E]/40 transition-colors">
                        TP {formatPrice(pos.takeProfit, pos.instrument)}
                      </button>
                    ) : (
                      <button onClick={() => setSltpEdit({ id: pos.id, field: 'tp', value: '' })} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-s2 text-muted-foreground border border-b2 hover:text-[#22C55E] hover:border-[#22C55E]/30 transition-colors">
                        + TP
                      </button>
                    )}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className={`data-number font-bold text-sm ${pos.livePnl >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                      {formatPnl(pos.livePnl)}
                    </span>
                    <button onClick={() => handleClose(pos.id)} disabled={closingId === pos.id} className="opacity-0 group-hover:opacity-100 text-[9px] text-muted-foreground hover:text-white bg-b1 border border-b2 px-1.5 py-0.5 rounded transition-all disabled:opacity-50" data-testid={`btn-close-${pos.id}`}>
                      {closingId === pos.id ? '...' : 'Close'}
                    </button>
                  </div>
                </div>
                {editingSlHere && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#EF4444]/5 border-b border-b1">
                    <span className="text-[9px] font-bold text-[#EF4444] uppercase shrink-0">Stop Loss</span>
                    <input autoFocus type="number" value={sltpEdit?.value || ''} onChange={e => setSltpEdit(prev => prev ? { ...prev, value: e.target.value } : null)} onKeyDown={e => { if (e.key === 'Enter') confirmSltp(pos.id, 'sl'); if (e.key === 'Escape') setSltpEdit(null); }} placeholder="Enter SL price" className="flex-1 bg-s2 border border-[#EF4444]/40 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-[#EF4444]" />
                    <button onClick={() => confirmSltp(pos.id, 'sl')} className="text-[9px] font-bold px-2 py-1 rounded bg-[#EF4444] text-white hover:bg-[#EF4444]/80 transition-colors shrink-0">Set</button>
                    {pos.stopLoss && <button onClick={() => { handleUpdateSLTP(pos.id, 'stopLoss', null); setSltpEdit(null); }} className="text-[9px] font-bold px-2 py-1 rounded bg-s2 text-muted-foreground border border-b2 hover:text-white transition-colors shrink-0">Remove</button>}
                    <button onClick={() => setSltpEdit(null)} className="text-[9px] text-muted-foreground hover:text-white transition-colors shrink-0">✕</button>
                  </div>
                )}
                {editingTpHere && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#22C55E]/5 border-b border-b1">
                    <span className="text-[9px] font-bold text-[#22C55E] uppercase shrink-0">Take Profit</span>
                    <input autoFocus type="number" value={sltpEdit?.value || ''} onChange={e => setSltpEdit(prev => prev ? { ...prev, value: e.target.value } : null)} onKeyDown={e => { if (e.key === 'Enter') confirmSltp(pos.id, 'tp'); if (e.key === 'Escape') setSltpEdit(null); }} placeholder="Enter TP price" className="flex-1 bg-s2 border border-[#22C55E]/40 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-[#22C55E]" />
                    <button onClick={() => confirmSltp(pos.id, 'tp')} className="text-[9px] font-bold px-2 py-1 rounded bg-[#22C55E] text-white hover:bg-[#22C55E]/80 transition-colors shrink-0">Set</button>
                    {pos.takeProfit && <button onClick={() => { handleUpdateSLTP(pos.id, 'takeProfit', null); setSltpEdit(null); }} className="text-[9px] font-bold px-2 py-1 rounded bg-s2 text-muted-foreground border border-b2 hover:text-white transition-colors shrink-0">Remove</button>}
                    <button onClick={() => setSltpEdit(null)} className="text-[9px] text-muted-foreground hover:text-white transition-colors shrink-0">✕</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {isDev && (
        <div className="bg-[#0A0A0C] border-t border-b1">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="w-full px-3 py-1 text-[9px] text-muted-foreground hover:text-white text-left font-mono uppercase tracking-wider"
            data-testid="btn-toggle-debug"
          >
            {showDebug ? '▼' : '▶'} Debug Panel
          </button>
          {showDebug && (
            <div className="px-3 pb-2 space-y-2 text-[10px] font-mono">
              <div className="flex gap-4">
                <span className="text-muted-foreground">WS Status:</span>
                <span className={finnhubDebug.wsStatus === 'connected' ? 'text-[#22C55E]' : finnhubDebug.wsStatus === 'connecting' ? 'text-gold' : 'text-[#EF4444]'}>
                  {finnhubDebug.wsStatus.toUpperCase()}
                </span>
              </div>
              <div className="flex gap-4">
                <span className="text-muted-foreground">Last Price:</span>
                <span className="text-white">{finnhubDebug.lastPrice !== null ? `$${finnhubDebug.lastPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '---'}</span>
              </div>
              <div className="flex gap-4">
                <span className="text-muted-foreground">Last Update:</span>
                <DebugTimestamp ts={finnhubDebug.lastUpdateTs} />
              </div>
              {positionsWithPnl.length > 0 && (
                <div className="border-t border-b1 pt-2 space-y-1">
                  <span className="text-muted-foreground uppercase tracking-wider">P&L Check</span>
                  {positionsWithPnl.map(pos => {
                    const expectedPnl = pos.currentPrice ? calcPnl(pos.side, pos.entryPrice, pos.currentPrice, pos.size, pos.instrument) : 0;
                    const match = Math.abs(expectedPnl - pos.livePnl) < 0.01;
                    return (
                      <div key={pos.id} className="grid grid-cols-6 gap-1 items-center text-[9px]" data-testid={`debug-row-${pos.id}`}>
                        <span className="text-white">{pos.instrument}</span>
                        <span className="text-muted-foreground">Entry: {pos.entryPrice.toFixed(2)}</span>
                        <span className="text-muted-foreground">Now: {pos.currentPrice ? pos.currentPrice.toFixed(2) : '---'}</span>
                        <span className="text-muted-foreground">Calc: ${expectedPnl.toFixed(2)}</span>
                        <span className="text-muted-foreground">Disp: ${pos.livePnl.toFixed(2)}</span>
                        <span className={match ? 'text-[#22C55E] font-bold' : 'text-[#EF4444] font-bold'}>{match ? 'PASS' : 'FAIL'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DebugTimestamp({ ts }: { ts: number | null }) {
  const [ago, setAgo] = useState<string>('---');
  useEffect(() => {
    if (ts === null) { setAgo('---'); return; }
    const update = () => setAgo(`${Date.now() - ts}ms ago`);
    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [ts]);
  return <span className="text-white">{ago}</span>;
}
