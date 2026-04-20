/** AI Wealth Projection Module **/
import React, { useState, useMemo } from 'react'; // v1.0.2
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const WhatIf: React.FC = () => {
  const [monthly, setMonthly] = useState(10000);
  const [rate, setRate] = useState(12);
  const [years, setYears] = useState(10);
  const [stepUp, setStepUp] = useState(10);

  const calculateWealth = (m: number, r: number, y: number, s: number) => {
    let totalInvested = 0;
    let currentValue = 0;
    let monthlyAmount = m;
    const monthlyRate = r / 12 / 100;
    const data = [];

    for (let year = 1; year <= y; year++) {
      for (let month = 1; month <= 12; month++) {
        totalInvested += monthlyAmount;
        currentValue = (currentValue + monthlyAmount) * (1 + monthlyRate);
      }
      data.push({
        year: `Year ${year}`,
        invested: Math.round(totalInvested),
        value: Math.round(currentValue),
      });
      // Apply annual step-up
      monthlyAmount = monthlyAmount * (1 + s / 100);
    }
    return { data, totalInvested, currentValue };
  };

  const scenario = useMemo(() => calculateWealth(monthly, rate, years, stepUp), [monthly, rate, years, stepUp]);
  
  // AI Recommended: +10% amount, +2 years
  const recommended = useMemo(() => calculateWealth(monthly * 1.1, rate, years + 2, 12), [monthly, rate, years]);

  return (
    <div className="what-if-page">
      <div className="page-header">
        <div>
          <h2 className="gradient-text">🔮 AI Wealth Simulator</h2>
          <p>Experiment with scenarios to see the power of compounding before you invest.</p>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 2fr', gap: '32px' }}>
        <div className="simulation-controls card glass">
          <h3 className="card-title mb-4">Simulation Parameters</h3>
          
          <div className="form-group mb-4">
            <div className="flex-between">
              <label className="form-label">Monthly Investment</label>
              <span className="text-accent">₹{monthly.toLocaleString()}</span>
            </div>
            <input type="range" min="1000" max="100000" step="1000" className="slider" value={monthly} onChange={e => setMonthly(Number(e.target.value))} />
          </div>

          <div className="form-group mb-4">
            <div className="flex-between">
              <label className="form-label">Expected Return (p.a.)</label>
              <span className="text-accent">{rate}%</span>
            </div>
            <input type="range" min="5" max="25" step="0.5" className="slider" value={rate} onChange={e => setRate(Number(e.target.value))} />
          </div>

          <div className="form-group mb-4">
            <div className="flex-between">
              <label className="form-label">Time Horizon (Years)</label>
              <span className="text-accent">{years} Years</span>
            </div>
            <input type="range" min="1" max="40" step="1" className="slider" value={years} onChange={e => setYears(Number(e.target.value))} />
          </div>

          <div className="form-group mb-4">
            <div className="flex-between">
              <label className="form-label">Annual Step-up (%)</label>
              <span className="text-accent">{stepUp}%</span>
            </div>
            <input type="range" min="0" max="30" step="1" className="slider" value={stepUp} onChange={e => setStepUp(Number(e.target.value))} />
          </div>

          <div className="sim-summary mt-4 p-3 glass-glow" style={{ borderRadius: '12px' }}>
             <div className="flex-between mb-2">
                <span className="text-muted">Total Invested</span>
                <span className="font-bold">&nbsp; ₹ {Math.round(scenario.totalInvested).toLocaleString()}</span>
             </div>
             <div className="flex-between mb-2">
                <span className="text-muted">Est. Wealth</span>
                <span className="font-bold text-success">&nbsp; ₹ {Math.round(scenario.currentValue).toLocaleString()}</span>
             </div>
             <div className="flex-between">
                <span className="text-muted">Net Gain</span>
                <span className="font-bold text-accent">&nbsp; ₹ {Math.round(scenario.currentValue - scenario.totalInvested).toLocaleString()}</span>
             </div>
          </div>
        </div>

        <div className="chart-container card glass">
          <div className="flex-between mb-4">
            <h3 className="card-title">Projected Growth Path</h3>
            <div className="risk-tag" data-risk={rate > 15 ? 'high' : rate > 10 ? 'moderate' : 'low'}>
              {rate > 15 ? 'High Risk/Return' : rate > 10 ? 'Moderate Risk' : 'Conservative'}
            </div>
          </div>
          
          <div style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={scenario.data}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="year" stroke="var(--text-muted)" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(val) => `₹${(val / 100000).toFixed(1)}L`} stroke="var(--text-muted)" fontSize={11} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-card)', border: 'none', borderRadius: '12px', boxShadow: 'var(--shadow-lg)' }}
                  formatter={(val: number) => `₹${val.toLocaleString()}`}
                />
                <Area type="monotone" dataKey="value" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                <Area type="monotone" dataKey="invested" stroke="#64748b" fill="transparent" strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-center gap-4 mt-2">
             <span className="legend-item"><span className="dot" style={{ background: 'var(--accent-primary)' }}></span> Wealth</span>
             <span className="legend-item"><span className="dot" style={{ background: '#64748b' }}></span> Invested Capital</span>
          </div>
        </div>
      </div>

      <div className="nudge-section mt-4">
        <h3 className="section-title mb-3">💡 AI Financial Insights</h3>
        <div className="grid-3">
          <div className="nudge-card glass-premium highlight-green">
             <div className="nudge-icon">🔥</div>
             <div className="nudge-content">
                <h4>Compounding Miracle</h4>
                <p>By increasing your duration from {years} to {years + 5} years, your wealth could potentially grow by <b>{Math.round((calculateWealth(monthly, rate, years + 5, stepUp).currentValue / scenario.currentValue - 1) * 100)}%</b>.</p>
             </div>
          </div>

          <div className="nudge-card glass-premium highlight-green">
             <div className="nudge-icon">⚡</div>
             <div className="nudge-content">
                <h4>Step-up Advantage</h4>
                <p>Switching from <b>0%</b> to a <b>10%</b> annual step-up increases your final corpus by <b>₹{Math.round(calculateWealth(monthly, rate, years, 10).currentValue - calculateWealth(monthly, rate, years, 0).currentValue).toLocaleString()}</b>.</p>
             </div>
          </div>

          <div className="nudge-card glass-premium highlight-green">
             <div className="nudge-icon">🤖</div>
             <div className="nudge-content">
                <h4>AI Recommended Path</h4>
                <p>Our optimal simulation suggests ₹{(monthly * 1.1).toLocaleString()} for {years + 2} years @ 12% to reach a corpus of <b>₹{Math.round(recommended.currentValue).toLocaleString()}</b>.</p>
                <button className="btn btn-primary btn-sm mt-2" onClick={() => {
                  setMonthly(monthly * 1.1);
                  setYears(years + 2);
                  setStepUp(12);
                }}>Apply Recommendation</button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatIf;
