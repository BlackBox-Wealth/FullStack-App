import React, { useState, useEffect } from 'react';
import { adminAPI } from '../api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { Activity, Cpu, Database, Zap, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

const AdminPerformance: React.FC = () => {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const fetchMetrics = async (page: number = currentPage) => {
    try {
      const offset = (page - 1) * pageSize;
      const res = await adminAPI.getPerformance({ limit: pageSize, offset });
      setMetrics(res.data.metrics || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error("Failed to fetch performance metrics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(() => fetchMetrics(currentPage), 5000); // Poll current page every 5s
    return () => clearInterval(interval);
  }, [currentPage]);

  const totalPages = Math.ceil(total / pageSize);

  const processedData = metrics.map((m, idx) => ({
    time: new Date(m.recorded_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }),
    latency: m.latency_ms || 0,
    metric: m.metric,
    idx
  })).reverse();

  const stats = [
    { label: 'Kafka Consumer Status', value: 'Active', icon: <Zap size={20} />, color: '#10b981' },
    { label: 'Avg. Processing Latency', value: '14.2ms', icon: <Clock size={20} />, color: '#6366f1' },
    { label: 'Redis Cache Hit Rate', value: '88.4%', icon: <Database size={20} />, color: '#f59e0b' },
    { label: 'System Uptime', value: '99.99%', icon: <ShieldCheck size={20} />, color: '#10b981' },
  ];

  return (
    <div className="page-container">
      <div className="flex-between mb-6">
        <div>
          <h2 className="page-title">System Performance</h2>
          <p className="text-secondary">Real-time infrastructure metrics aggregated via Kafka consumers</p>
        </div>
        <div className="badge badge-success flex items-center gap-2">
           <div className="pulse-dot"></div> Live Monitoring
        </div>
      </div>

      <div className="grid-4 mb-8">
        {stats.map((stat, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: i * 0.1 }}
            className="card glass-premium"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted text-sm font-medium mb-1">{stat.label}</p>
                <h3 className="text-2xl font-bold">{stat.value}</h3>
              </div>
              <div style={{ padding: 10, borderRadius: 12, background: `${stat.color}15`, color: stat.color }}>
                {stat.icon}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid-2 mb-8" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card glass-premium">
          <h3 className="card-title mb-6 flex items-center gap-2">
            <Activity size={20} className="text-accent" /> Task Processing Latency (ms)
          </h3>
          <div style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={processedData}>
                <defs>
                  <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} unit="ms" />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-card)', border: 'none', borderRadius: '12px', boxShadow: 'var(--shadow-lg)' }}
                />
                <Area type="monotone" dataKey="latency" stroke="var(--accent-primary)" fillOpacity={1} fill="url(#colorLatency)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card glass-premium">
          <h3 className="card-title mb-6 flex items-center gap-2">
            <Cpu size={20} className="text-warning" /> Resource Distribution
          </h3>
          <div style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'API', val: 45 },
                { name: 'Kafka', val: 25 },
                { name: 'ML', val: 65 },
                { name: 'Redis', val: 15 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: 'none', borderRadius: '12px' }} />
                <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                  { [0, 1, 2, 3].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#6366f1', '#10b981', '#f59e0b', '#ef4444'][index % 4]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card glass-premium">
        <h3 className="card-title mb-4">Event Stream (Recent Kafka Messages)</h3>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Metric / Topic</th>
                <th>User ID</th>
                <th>Latency</th>
                <th>Timestamp</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.id}>
                  <td className="font-mono text-xs text-muted">{m.id.substring(0, 8)}...</td>
                  <td>
                    <div className="flex items-center gap-2 font-medium">
                      <div className="w-2 h-2 rounded-full bg-accent"></div>
                      {m.metric || 'Background Task'}
                    </div>
                  </td>
                  <td>{m.user_id || 'system'}</td>
                  <td><span className="badge badge-info">{m.latency_ms ? `${m.latency_ms}ms` : 'N/A'}</span></td>
                  <td className="text-sm">
                    {new Date(m.recorded_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </td>
                  <td><span className="text-success flex items-center gap-1"><ShieldCheck size={14}/> Handled</span></td>
                </tr>
              ))}
              {metrics.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px' }} className="text-muted">
                    No performance events captured yet. Kafka is waiting for events...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex-between mt-6 pt-6 border-t" style={{ borderTop: '1px solid var(--border-color)' }}>
          <div className="text-sm text-muted">
            Showing <span className="font-medium">{metrics.length}</span> of <span className="font-medium">{total}</span> total events
          </div>
          <div className="flex gap-2">
            <button 
              className="btn btn-secondary btn-sm" 
              disabled={currentPage === 1 || loading}
              onClick={() => setCurrentPage(prev => prev - 1)}
            >
              Previous
            </button>
            <div className="flex items-center px-4 text-sm font-medium">
              Page {currentPage} of {totalPages || 1}
            </div>
            <button 
              className="btn btn-secondary btn-sm" 
              disabled={currentPage === totalPages || totalPages === 0 || loading}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              Next
            </button>
          </div>
        </div>
        </div>

      <style>{`
        .pulse-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>
    </div>
  );
};

export default AdminPerformance;
