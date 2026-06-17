import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calculator, Home, Briefcase, TrendingUp, DollarSign, Bot, Sparkles, Send, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { mlAPI } from '../api';

const COLORS = ['#6366f1', '#64748b', '#10b981', '#f59e0b', '#ef4444'];

const WhatIf: React.FC = () => {
  const [activeTab, setActiveTab] = useState('sip');
  const [scenarioLoading, setScenarioLoading] = useState<string | null>(null);
  const [scenarioResults, setScenarioResults] = useState<Record<string, string>>({});
  const [customPrompt, setCustomPrompt] = useState<string>('');

  const handleScenario = async (type: string, customParam?: string) => {
    setScenarioLoading(type);
    try {
      const res = await mlAPI.whatifScenario(type, customParam);
      setScenarioResults(prev => ({ ...prev, [type]: res.data.llm_response }));
    } catch (err) {
      console.error(err);
    } finally {
      setScenarioLoading(null);
    }
  };

  // SIP States
  const [sipMonthly, setSipMonthly] = useState(10000);
  const [sipRate, setSipRate] = useState(12);
  const [sipYears, setSipYears] = useState(10);
  const [sipStepUp, setSipStepUp] = useState(10);

  // Compound Interest States
  const [ciPrincipal, setCiPrincipal] = useState(100000);
  const [ciMonthly, setCiMonthly] = useState(5000);
  const [ciRate, setCiRate] = useState(10);
  const [ciYears, setCiYears] = useState(15);

  // Retirement States
  const [retCurrentAge, setRetCurrentAge] = useState(30);
  const [retRetireAge, setRetRetireAge] = useState(60);
  const [retSavings, setRetSavings] = useState(500000);
  const [retMonthly, setRetMonthly] = useState(15000);
  const [retRate, setRetRate] = useState(12);

  // Mortgage States
  const [mortHomeValue, setMortHomeValue] = useState(5000000);
  const [mortDownPayment, setMortDownPayment] = useState(1000000);
  const [mortRate, setMortRate] = useState(8.5);
  const [mortYears, setMortYears] = useState(20);

  // Loan States
  const [loanAmount, setLoanAmount] = useState(500000);
  const [loanRate, setLoanRate] = useState(10.5);
  const [loanYears, setLoanYears] = useState(5);

  // Parsers & Calculators
  const calcSIP = useMemo(() => {
    let invested = 0;
    let value = 0;
    let currentM = sipMonthly;
    const data = [];
    for (let y = 1; y <= sipYears; y++) {
      for (let m = 1; m <= 12; m++) {
        invested += currentM;
        value = (value + currentM) * (1 + (sipRate / 100) / 12);
      }
      data.push({ year: `Yr ${y}`, invested: Math.round(invested), value: Math.round(value) });
      currentM *= (1 + sipStepUp / 100);
    }
    return { data, invested, value: Math.round(value), returns: Math.round(value - invested) };
  }, [sipMonthly, sipRate, sipYears, sipStepUp]);

  const calcCI = useMemo(() => {
    let invested = ciPrincipal;
    let value = ciPrincipal;
    const data = [];
    for (let y = 1; y <= ciYears; y++) {
      for (let m = 1; m <= 12; m++) {
        invested += ciMonthly;
        value = (value + ciMonthly) * (1 + (ciRate / 100) / 12);
      }
      data.push({ year: `Yr ${y}`, invested: Math.round(invested), value: Math.round(value) });
    }
    return { data, invested, value: Math.round(value), returns: Math.round(value - invested) };
  }, [ciPrincipal, ciMonthly, ciRate, ciYears]);

  const calcRetirement = useMemo(() => {
    let invested = retSavings;
    let value = retSavings;
    const years = Math.max(1, retRetireAge - retCurrentAge);
    const data = [];
    for (let y = 1; y <= years; y++) {
      for (let m = 1; m <= 12; m++) {
        invested += retMonthly;
        value = (value + retMonthly) * (1 + (retRate / 100) / 12);
      }
      data.push({ age: `${retCurrentAge + y}`, invested: Math.round(invested), value: Math.round(value) });
    }
    return { data, invested, value: Math.round(value), returns: Math.round(value - invested), years };
  }, [retCurrentAge, retRetireAge, retSavings, retMonthly, retRate]);

  const calcMortgage = useMemo(() => {
    const principal = Math.max(0, mortHomeValue - mortDownPayment);
    const r = (mortRate / 100) / 12;
    const n = mortYears * 12;
    const emi = principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) || 0;
    const totalPayment = emi * n;
    const totalInterest = totalPayment - principal;

    const pieData = [
      { name: 'Principal', value: principal },
      { name: 'Total Interest', value: Math.round(totalInterest) }
    ];
    return { principal, emi: Math.round(emi), totalInterest: Math.round(totalInterest), totalPayment: Math.round(totalPayment), pieData };
  }, [mortHomeValue, mortDownPayment, mortRate, mortYears]);

  const calcLoan = useMemo(() => {
    const principal = loanAmount;
    const r = (loanRate / 100) / 12;
    const n = loanYears * 12;
    const emi = principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) || 0;
    const totalPayment = emi * n;
    const totalInterest = totalPayment - principal;

    const pieData = [
      { name: 'Principal', value: principal },
      { name: 'Total Interest', value: Math.round(totalInterest) }
    ];
    return { principal, emi: Math.round(emi), totalInterest: Math.round(totalInterest), totalPayment: Math.round(totalPayment), pieData };
  }, [loanAmount, loanRate, loanYears]);


  // Tab Navigation Mapping
  const tabs = [
    { id: 'sip', name: 'SIP Calculator', icon: <TrendingUp size={18} />, desc: 'Systematic Investment Plan returns' },
    { id: 'compound', name: 'Compound Interest', icon: <Calculator size={18} />, desc: 'See how your money grows' },
    { id: 'retirement', name: 'Retirement', icon: <Briefcase size={18} />, desc: 'Plan for golden years' },
    { id: 'mortgage', name: 'Mortgage', icon: <Home size={18} />, desc: 'Calculate home loan payments' },
    { id: 'loan', name: 'Loan', icon: <DollarSign size={18} />, desc: 'Calculate any loan payments' },
  ];

  return (
    <div className="what-if-page" style={{ paddingBottom: 60 }}>
      <div className="page-header" style={{ marginBottom: 30 }}>
        <div>
          <h2 className="gradient-text">🔮 AI Predictive What-Ifs & Calculators</h2>
          <p>Experiment with scenarios to see the power of compounding, debt, and wealth creation.</p>
        </div>
      </div>

      <div style={{ marginBottom: 40 }}>
        <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Briefcase size={20} className="text-accent" /> WealthVault AI Scenarios
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>

          <div className="card glass-premium highlight-green">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: '1rem' }}>Liquidate AA Idle Cash</h4>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 'bold' }}>+₹ 42,000 /yr</div>
            </div>
            {scenarioResults['aa_sweep'] ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="alert-card success-card" style={{ marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{scenarioResults['aa_sweep']}</p>
              </motion.div>
            ) : (
              <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: 16, lineHeight: 1.5 }}>
                Your Account Aggregator logs show a consistently idle ₹3.5L bank balance. <strong>What if you swept 50% into a Liquid Mutual Fund?</strong>
              </p>
            )}
            <button className="btn btn-outline btn-sm" style={{ width: '100%' }} onClick={() => handleScenario('aa_sweep')} disabled={scenarioLoading === 'aa_sweep'}>
              {scenarioLoading === 'aa_sweep' ? 'Simulating Extrapolation...' : 'Simulate Sweep Strategy'}
            </button>
          </div>

          <div className="card glass-premium highlight-red">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: '1rem' }}>Restructure High-Interest Loan</h4>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 'bold' }}>Save ₹ 1.2L</div>
            </div>
            {scenarioResults['loan_arbitrage'] ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="alert-card warning-card" style={{ marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{scenarioResults['loan_arbitrage']}</p>
              </motion.div>
            ) : (
              <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: 16, lineHeight: 1.5 }}>
                Your active personal loan costs 14% p.a. <strong>What if you liquidated 10% of your Gold Asset Vault to pre-pay the principal today?</strong>
              </p>
            )}
            <button className="btn btn-outline btn-sm" style={{ width: '100%' }} onClick={() => handleScenario('loan_arbitrage')} disabled={scenarioLoading === 'loan_arbitrage'}>
              {scenarioLoading === 'loan_arbitrage' ? 'Analyzing Arbitrage...' : 'View Debt Arbitrage'}
            </button>
          </div>

          <div className="card glass-premium" style={{ borderTop: '4px solid var(--accent-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: '1rem' }}>Homomorphic Market Stress</h4>
              <div style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 'bold' }}>Zero-Knowledge</div>
            </div>
            {scenarioResults['market_stress'] ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="alert-card info-card" style={{ marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{scenarioResults['market_stress']}</p>
              </motion.div>
            ) : (
              <p className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: 16, lineHeight: 1.5 }}>
                <strong>What if the NIFTY drops 20%?</strong> Run a secure encrypted LLM simulation against your portfolio to identify timeline vulnerabilities.
              </p>
            )}
            <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => handleScenario('market_stress')} disabled={scenarioLoading === 'market_stress'}>
              {scenarioLoading === 'market_stress' ? 'Running Encrypted LLM...' : 'Run Encrypted Stress Test'}
            </button>
          </div>

        </div>

        {/* CUSTOM SCENARIO BOX */}
        <div className="card glass-premium mt-6" style={{
          background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(15,118,110,0.05) 100%)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-md)',
          padding: '24px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-primary)' }}>
                <Bot size={22} style={{ color: 'var(--accent-primary)' }} />
                <span>What else can PSB AI simulate?</span>
              </h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--accent-primary)', background: 'rgba(15,118,110,0.1)', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
                <Sparkles size={12} /> Powered by Llama 3.3
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <textarea
                className="form-input"
                placeholder="E.g. What if I increase my SIP by 20% but the market return drops to 8%?"
                rows={3}
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                style={{
                  width: '100%',
                  resize: 'none',
                  padding: '16px',
                  paddingRight: '60px',
                  borderRadius: '12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  lineHeight: '1.5',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)'
                }}
              />
              <button
                onClick={() => handleScenario('custom', customPrompt)}
                disabled={scenarioLoading === 'custom' || !customPrompt.trim()}
                style={{
                  position: 'absolute',
                  right: '12px',
                  bottom: '12px',
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  border: 'none',
                  background: customPrompt.trim() ? 'var(--accent-primary)' : 'rgba(15,118,110,0.2)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: customPrompt.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  boxShadow: customPrompt.trim() ? '0 4px 12px rgba(15,118,110,0.3)' : 'none'
                }}
              >
                {scenarioLoading === 'custom' ? (
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>...</span>
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>

            <AnimatePresence>
              {scenarioResults['custom'] && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{
                    marginTop: 8,
                    padding: '16px',
                    background: 'rgba(15,118,110,0.08)',
                    borderLeft: '4px solid var(--accent-primary)',
                    borderRadius: '0 12px 12px 0'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase' }}>
                      <Lightbulb size={14} /> AI Projection Result
                    </div>
                    <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                      {scenarioResults['custom']}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={14} /> Projections are based on historical data and AI modeling. Actual results may vary.
            </div>
          </div>
        </div>

      </div>

      <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Calculator size={20} className="text-primary" /> Core Financial Calculators
      </h3>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, marginBottom: 24, borderBottom: '1px solid var(--border-color)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: '12px', border: 'none',
              background: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--bg-card)',
              color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600, flexShrink: 0,
              boxShadow: activeTab === tab.id ? 'var(--shadow-md)' : 'none'
            }}
          >
            {tab.icon}
            <div>
              <div style={{ fontSize: '0.95rem' }}>{tab.name}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1.2fr 1.8fr', gap: '32px' }}>

        {/* LEFT COLUMN: Input Forms */}
        <div className="simulation-controls card glass" style={{ border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' }}>
          <h3 className="card-title mb-4" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>Simulation Parameters</h3>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.25 }}
            >
              {activeTab === 'sip' && (
                <>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Monthly Investment</label><span className="text-accent">₹ {sipMonthly.toLocaleString()}</span></div>
                    <input type="range" min="1000" max="100000" step="500" className="slider" value={sipMonthly} onChange={e => setSipMonthly(Number(e.target.value))} />
                  </div>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Expected Return (p.a.)</label><span className="text-accent">{sipRate} %</span></div>
                    <input type="range" min="5" max="25" step="0.5" className="slider" value={sipRate} onChange={e => setSipRate(Number(e.target.value))} />
                  </div>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Time Horizon (Years)</label><span className="text-accent">{sipYears} Years</span></div>
                    <input type="range" min="1" max="40" step="1" className="slider" value={sipYears} onChange={e => setSipYears(Number(e.target.value))} />
                  </div>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Annual Step-up (%)</label><span className="text-accent">{sipStepUp} %</span></div>
                    <input type="range" min="0" max="30" step="1" className="slider" value={sipStepUp} onChange={e => setSipStepUp(Number(e.target.value))} />
                  </div>
                </>
              )}

              {activeTab === 'compound' && (
                <>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Initial Principal</label><span className="text-accent">₹ {ciPrincipal.toLocaleString()}</span></div>
                    <input type="range" min="10000" max="5000000" step="10000" className="slider" value={ciPrincipal} onChange={e => setCiPrincipal(Number(e.target.value))} />
                  </div>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Monthly Addition</label><span className="text-accent">₹ {ciMonthly.toLocaleString()}</span></div>
                    <input type="range" min="0" max="100000" step="1000" className="slider" value={ciMonthly} onChange={e => setCiMonthly(Number(e.target.value))} />
                  </div>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Interest Rate (p.a.)</label><span className="text-accent">{ciRate} %</span></div>
                    <input type="range" min="4" max="25" step="0.5" className="slider" value={ciRate} onChange={e => setCiRate(Number(e.target.value))} />
                  </div>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Years to Grow</label><span className="text-accent">{ciYears} Years</span></div>
                    <input type="range" min="1" max="40" step="1" className="slider" value={ciYears} onChange={e => setCiYears(Number(e.target.value))} />
                  </div>
                </>
              )}

              {activeTab === 'retirement' && (
                <>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Current Age</label><span className="text-accent">{retCurrentAge}</span></div>
                    <input type="range" min="18" max="60" step="1" className="slider" value={retCurrentAge} onChange={e => {
                      setRetCurrentAge(Number(e.target.value));
                      if (Number(e.target.value) >= retRetireAge) setRetRetireAge(Number(e.target.value) + 1);
                    }} />
                  </div>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Retirement Age</label><span className="text-accent">{retRetireAge}</span></div>
                    <input type="range" min={retCurrentAge + 1} max="80" step="1" className="slider" value={retRetireAge} onChange={e => setRetRetireAge(Number(e.target.value))} />
                  </div>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Current Savings</label><span className="text-accent">₹ {retSavings.toLocaleString()}</span></div>
                    <input type="range" min="0" max="10000000" step="50000" className="slider" value={retSavings} onChange={e => setRetSavings(Number(e.target.value))} />
                  </div>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Monthly Savings</label><span className="text-accent">₹ {retMonthly.toLocaleString()}</span></div>
                    <input type="range" min="0" max="200000" step="5000" className="slider" value={retMonthly} onChange={e => setRetMonthly(Number(e.target.value))} />
                  </div>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Expected Return</label><span className="text-accent">{retRate} %</span></div>
                    <input type="range" min="6" max="18" step="1" className="slider" value={retRate} onChange={e => setRetRate(Number(e.target.value))} />
                  </div>
                </>
              )}

              {activeTab === 'mortgage' && (
                <>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Home Value</label><span className="text-accent">₹ {mortHomeValue.toLocaleString()}</span></div>
                    <input type="number" className="form-input" value={mortHomeValue} onChange={e => setMortHomeValue(Number(e.target.value))} />
                  </div>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Down Payment</label><span className="text-accent">₹ {mortDownPayment.toLocaleString()}</span></div>
                    <input type="number" className="form-input" value={mortDownPayment} onChange={e => setMortDownPayment(Number(e.target.value))} />
                  </div>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Interest Rate (%)</label><span className="text-accent">{mortRate} %</span></div>
                    <input type="range" min="6" max="14" step="0.1" className="slider" value={mortRate} onChange={e => setMortRate(Number(e.target.value))} />
                  </div>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Loan Term (Years)</label><span className="text-accent">{mortYears} Years</span></div>
                    <input type="range" min="5" max="30" step="1" className="slider" value={mortYears} onChange={e => setMortYears(Number(e.target.value))} />
                  </div>
                </>
              )}

              {activeTab === 'loan' && (
                <>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Loan Amount</label><span className="text-accent">₹ {loanAmount.toLocaleString()}</span></div>
                    <input type="number" className="form-input" value={loanAmount} onChange={e => setLoanAmount(Number(e.target.value))} />
                  </div>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Interest Rate (%)</label><span className="text-accent">{loanRate} %</span></div>
                    <input type="range" min="8" max="24" step="0.1" className="slider" value={loanRate} onChange={e => setLoanRate(Number(e.target.value))} />
                  </div>
                  <div className="form-group mb-4">
                    <div className="flex-between"><label>Loan Term (Years)</label><span className="text-accent">{loanYears} Years</span></div>
                    <input type="range" min="1" max="15" step="1" className="slider" value={loanYears} onChange={e => setLoanYears(Number(e.target.value))} />
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* RIGHT COLUMN: Visualizations */}
        <div className="chart-container card glass" style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' }}>
          <h3 className="card-title mb-4">Visual Projections</h3>

          {(activeTab === 'sip' || activeTab === 'compound' || activeTab === 'retirement') && (
            <motion.div key={`chart-${activeTab}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, padding: 24, background: 'var(--bg-secondary)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Invested</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>₹ {(activeTab === 'sip' ? calcSIP.invested : activeTab === 'compound' ? calcCI.invested : calcRetirement.invested).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.85rem' }}>Est. Returns</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success)' }}>+₹ {(activeTab === 'sip' ? calcSIP.returns : activeTab === 'compound' ? calcCI.returns : calcRetirement.returns).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Wealth</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent-primary)' }}>₹ {(activeTab === 'sip' ? calcSIP.value : activeTab === 'compound' ? calcCI.value : calcRetirement.value).toLocaleString()}</div>
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activeTab === 'sip' ? calcSIP.data : activeTab === 'compound' ? calcCI.data : calcRetirement.data}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey={activeTab === 'retirement' ? 'age' : 'year'} stroke="var(--text-muted)" fontSize={11} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(val) => `₹${(val / 100000).toFixed(0)}L`} stroke="var(--text-muted)" fontSize={11} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card)', border: 'none', borderRadius: '12px', boxShadow: 'var(--shadow-lg)' }}
                      formatter={(val: number) => `₹ ${val.toLocaleString()}`}
                    />
                    <Area type="monotone" dataKey="value" name="Wealth" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                    <Area type="monotone" dataKey="invested" name="Invested" stroke="#64748b" fill="transparent" strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}

          {(activeTab === 'mortgage' || activeTab === 'loan') && (
            <motion.div key={`chart-${activeTab}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, padding: 24, background: 'var(--bg-secondary)', borderRadius: 16, border: '1px solid var(--border-color)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly EMI</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--danger)' }}>
                    ₹ {(activeTab === 'mortgage' ? calcMortgage.emi : calcLoan.emi).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.85rem' }}>Principal Amount</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                    ₹ {(activeTab === 'mortgage' ? calcMortgage.principal : calcLoan.principal).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-muted" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Payment</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--warning)' }}>
                    ₹ {(activeTab === 'mortgage' ? calcMortgage.totalPayment : calcLoan.totalPayment).toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={activeTab === 'mortgage' ? calcMortgage.pieData : calcLoan.pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--accent-primary)' : 'var(--danger)'} opacity={0.85} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `₹ ${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent-primary)' }}></div>
                  <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Principal</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--danger)' }}></div>
                  <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Total Interest</span>
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
};

export default WhatIf;
