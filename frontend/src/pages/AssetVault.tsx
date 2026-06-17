import React, { useEffect, useState } from 'react';
import { assetsAPI, mlAPI } from '../api';
import { Lightbulb } from 'lucide-react';
import PageInfoButton from '../components/PageInfoButton';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlus, FiTrash2, FiHome, FiTruck, FiActivity, FiBox } from 'react-icons/fi';
import { GiGoldBar } from 'react-icons/gi';
import PageLoader from '../components/animation/PageLoader';

const AssetVault: React.FC = () => {
  const [assets, setAssets] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [llmNudge, setLlmNudge] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    asset_type: 'property',
    purchase_price: 0,
    current_valuation: 0,
    purchase_date: new Date().toISOString().split('T')[0],
    description: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [assetsRes, summaryRes, insightRes] = await Promise.all([
        assetsAPI.getAll(),
        assetsAPI.getNetWorthSummary(),
        mlAPI.assetInsights().catch(() => null)
      ]);
      setAssets(assetsRes.data);
      setSummary(summaryRes.data);
      if (insightRes?.data?.llm_nudge) setLlmNudge(insightRes.data.llm_nudge);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await assetsAPI.create(form);
      setShowAddModal(false);
      setForm({
        name: '',
        asset_type: 'property',
        purchase_price: 0,
        current_valuation: 0,
        purchase_date: new Date().toISOString().split('T')[0],
        description: ''
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this asset?')) return;
    try {
      await assetsAPI.delete(id);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !summary) return <PageLoader label="Loading assets" />;

  const chartData = summary ? [
    { name: 'Liquid Cash', value: summary.liquid_cash, color: 'var(--success)' },
    { name: 'Investments', value: summary.investments, color: 'var(--accent-primary)' },
    { name: 'Physical Assets', value: summary.physical_assets, color: 'var(--accent-secondary)' },
  ].filter(d => d.value > 0) : [];

  const COLORS = chartData.map(d => d.color);

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'property': return <FiHome />;
      case 'gold': return <GiGoldBar />;
      case 'vehicle': return <FiTruck />;
      case 'jewellery': return <FiActivity />;
      default: return <FiBox />;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="asset-vault-page"
    >
      <div className="page-header">
        <div>
          <h2 style={{ margin: 0, paddingBottom: 4, display: 'flex', alignItems: 'center' }}>
            Asset Vault
            <PageInfoButton
              pageTitle="Asset Vault"
              items={[
                { title: 'Physical Assets', description: 'Real-world tangible wealth like Gold, Real Estate, or Vehicles that hold intrinsic value.' },
                { title: 'Net Worth Valuation', description: 'The dynamic total sum of all physical assets combined with your liquid cash and standard investments.' },
                { title: 'Appreciation', description: 'The increase in value of your physical assets over time, calculated as the difference between current valuation and purchase price.' }
              ]}
            />
          </h2>
          <p>Track your physical wealth and net worth</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <FiPlus /> Add Asset
        </button>
      </div>

      {llmNudge && (
        <div style={{ marginBottom: 24, padding: 14, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 12, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: 12, alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <Lightbulb size={24} strokeWidth={1.5} style={{ flexShrink: 0, color: 'var(--accent-secondary)' }} />
          <span style={{ lineHeight: 1.5, width: '100%', fontWeight: 500 }}>{llmNudge}</span>
        </div>
      )}

      <div className="grid-2" style={{ gridTemplateColumns: '1.2fr 0.8fr', gap: 24, marginBottom: 32 }}>
        {/* Net Worth Summary Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="card-header">
            <h3 className="card-title">Total Net Worth</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>
                ₹{summary?.total_net_worth.toLocaleString('en-IN')}
              </div>
              <div style={{ display: 'grid', gap: 12 }}>
                {chartData.map((d, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: d.color }}></div>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{d.name}</span>
                    </div>
                    <span style={{ fontWeight: 600 }}>₹{d.value.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ width: 220, height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-md)' }}
                    formatter={(value: any) => [`₹${value.toLocaleString('en-IN')}`, 'Amount']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Assets Distribution Card */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Asset Distribution</h3>
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            {summary && Object.entries(summary.asset_distribution).map(([key, val]: any) => (
              val > 0 && (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{key}</span>
                    <span style={{ fontWeight: 600 }}>₹{val.toLocaleString('en-IN')}</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(val / summary.physical_assets) * 100}%` }}
                      style={{ height: '100%', background: 'var(--accent-gradient)' }}
                    />
                  </div>
                </div>
              )
            ))}
            {summary?.physical_assets === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                No physical assets added yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Asset List */}
      <h3 style={{ marginBottom: 20 }}>Physical Assets</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
        <AnimatePresence>
          {assets.map((asset) => (
            <motion.div 
              key={asset.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="card asset-card"
              style={{ position: 'relative' }}
            >
              <button 
                onClick={() => handleDelete(asset.id)}
                style={{ position: 'absolute', top: 15, right: 15, border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <FiTrash2 />
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: 12, 
                  background: 'rgba(255,255,255,0.05)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  color: 'var(--accent-primary)'
                }}>
                  {getAssetIcon(asset.asset_type)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{asset.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                    {asset.asset_type} • Purchased {new Date(asset.purchase_date).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20 }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current Value</div>
                  <div style={{ fontWeight: 700 }}>₹{asset.current_valuation.toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Returns</div>
                  <div style={{ fontWeight: 700, color: asset.appreciation >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    ₹{asset.appreciation.toLocaleString('en-IN')} ({asset.appreciation_pct.toFixed(1)}%)
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }}
            className="modal" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 500 }}
          >
            <div className="modal-header">
              <h3>Track New Physical Asset</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddAsset}>
              <div className="form-group">
                <label className="form-label">Asset Name</label>
                <input 
                  type="text" className="form-input" required placeholder="e.g. 2BHK Mumbai, Gold Coin" 
                  value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.asset_type} onChange={e => setForm({...form, asset_type: e.target.value})}>
                    <option value="property">Property</option>
                    <option value="gold">Gold</option>
                    <option value="vehicle">Vehicle</option>
                    <option value="jewellery">Jewellery</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Purchase Date</label>
                  <input 
                    type="date" className="form-input" 
                    value={form.purchase_date} onChange={e => setForm({...form, purchase_date: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Purchase Price (₹)</label>
                  <input 
                    type="number" className="form-input" required 
                    value={form.purchase_price} onChange={e => setForm({...form, purchase_price: Number(e.target.value)})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Current Valuation (₹)</label>
                  <input 
                    type="number" className="form-input" required 
                    value={form.current_valuation} onChange={e => setForm({...form, current_valuation: Number(e.target.value)})}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <textarea 
                  className="form-input" rows={3} 
                  value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 20 }}>
                Secure Asset to Vault
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default AssetVault;
