import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const CAPTURES_DATA = [
  { day: 'Mon', passed: 18, check: 1 },
  { day: 'Tue', passed: 24, check: 2 },
  { day: 'Wed', passed: 29, check: 1 },
  { day: 'Thu', passed: 22, check: 0 },
  { day: 'Fri', passed: 31, check: 2 },
  { day: 'Sat', passed: 14, check: 0 },
  { day: 'Sun', passed: 9, check: 0 },
];

const WAGNER_DISTRIBUTION = [
  { name: 'Grade 0: Intact Skin', value: 28, color: '#10B981' },
  { name: 'Grade 1: Superficial Ulcer', value: 46, color: '#3B82F6' },
  { name: 'Grade 2: Deep Tissue Lesion', value: 52, color: '#F59E0B' },
  { name: 'Grade 3: Osteitis / Abscess', value: 24, color: '#EF4444' },
  { name: 'Grade 4/5: Ischemic Gangrene', value: 18, color: '#8B5CF6' },
];

const LEADERBOARD = [
  { rank: 1, mrn: 'PAT_KGP_01', name: 'Ramesh Chandra Sen', district: 'Paschim Medinipur', initial: '5.20 cm²', current: '2.57 cm²', delta: '-50.6%', status: 'HEALING (Stage B)' },
  { rank: 2, mrn: 'PAT_KGP_02', name: 'Anjali Devi Das', district: 'Jhargram', initial: '4.80 cm²', current: '2.90 cm²', delta: '-39.5%', status: 'HEALING (Stage B)' },
  { rank: 3, mrn: 'PAT_KGP_03', name: 'Sunil Kumar Roy', district: 'Purba Medinipur', initial: '3.10 cm²', current: '2.80 cm²', delta: '-9.6%', status: 'STABLE (Stage A)' },
  { rank: 4, mrn: 'PAT_KGP_04', name: 'Lakshmi Narayan Paul', district: 'Bankura', initial: '6.40 cm²', current: '7.10 cm²', delta: '+10.9%', status: 'DETERIORATING (Stage C)' },
];

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30D');
  const [modelSelector, setModelSelector] = useState('OPENCV_HYBRID');

  return (
    <div className="space-y-6 max-w-6xl font-sans">
      {/* ── Top Header with Model & Time Selectors ── */}
      <div className="p-5 rounded-xl bg-[#111C38] border border-[#23355E] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Clinical Intelligence & AI Model Governance</span>
          <h2 className="text-xl sm:text-2xl font-bold text-white mt-0.5">AI Clinical Informatics & Model Metrics</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Validation metrics, Dice segmentation coefficient, and cohort re-epithelialization trajectories.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <select
            value={modelSelector}
            onChange={(e) => setModelSelector(e.target.value)}
            className="px-3 py-1.5 bg-[#091024] border border-[#22335A] rounded-md text-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            <option value="OPENCV_HYBRID">OpenCV LAB/HSV Adaptive Contour (Active)</option>
            <option value="UNET_RESNET">U-Net ResNet-34 Segmentation Engine</option>
            <option value="DEEPLAB_V3">DeepLabV3+ Wound Boundary Model</option>
          </select>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-1.5 bg-[#091024] border border-[#22335A] rounded-md text-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            <option value="7D">Last 7 Days</option>
            <option value="30D">Last 30 Days</option>
            <option value="90D">Last Quarter</option>
            <option value="YTD">Year to Date (2026)</option>
          </select>
        </div>
      </div>

      {/* ── 3 Key Model Performance Indicators ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#111C38] border border-[#23355E] shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Photographic Ingests</span>
          <h3 className="text-2xl font-bold text-white mt-1">147 Scans</h3>
          <p className="text-[11px] text-emerald-400 mt-0.5">✓ 97.2% Quality Validation Pass Rate</p>
        </div>

        <div className="p-4 rounded-xl bg-[#111C38] border border-[#23355E] shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Mean Dice Similarity Coefficient</span>
          <h3 className="text-2xl font-bold text-blue-400 mt-1">0.894 (89.4%)</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Benchmarked against panel of 3 podiatrists</p>
        </div>

        <div className="p-4 rounded-xl bg-[#111C38] border border-[#23355E] shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Scale Calibration Error</span>
          <h3 className="text-2xl font-bold text-teal-300 mt-1">&lt; 0.42 mm</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">20mm circular sticker metric precision</p>
        </div>
      </div>

      {/* ── 2 Column Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="p-5 rounded-xl bg-[#111C38] border border-[#23355E] shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-white">Daily Field Capture Volume & Validation Quality</h3>
          <p className="text-[11px] text-slate-400">Photographs submitted by ASHA workers across South Bengal</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CAPTURES_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1D2B52" />
                <XAxis dataKey="day" stroke="#64748B" fontSize={10} />
                <YAxis stroke="#64748B" fontSize={10} />
                <Tooltip contentStyle={{ backgroundColor: '#091024', borderColor: '#23355E', borderRadius: '8px', fontSize: '11px' }} />
                <Bar dataKey="passed" fill="#2563EB" radius={[4, 4, 0, 0]} name="Quality PASS" stackId="a" />
                <Bar dataKey="check" fill="#EF4444" radius={[4, 4, 0, 0]} name="Quality CHECK" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[#111C38] border border-[#23355E] shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-white">Wagner Ulcer Classification Distribution (168 Cases)</h3>
          <p className="text-[11px] text-slate-400">Institutional patient cohort breakdown</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={WAGNER_DISTRIBUTION} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
                  {WAGNER_DISTRIBUTION.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#091024', borderColor: '#23355E', borderRadius: '8px', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '10px', color: '#94A3B8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Cohort Healing Leaderboard ── */}
      <div className="p-5 rounded-xl bg-[#111C38] border border-[#23355E] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Patient Ulcer Re-epithelialization Trajectory Table</h3>
            <p className="text-[11px] text-slate-400">Objective surface area delta measured between baseline and latest visit</p>
          </div>
          <button
            onClick={() => alert('✓ Exporting cohort informatics to CSV format…')}
            className="px-3 py-1 rounded bg-[#091024] hover:bg-[#152347] text-blue-300 text-xs font-semibold border border-[#22335A]"
          >
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0D1836] text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-[#23355E]">
              <tr>
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">MRN / Patient Name</th>
                <th className="py-2.5 px-3">District</th>
                <th className="py-2.5 px-3">Baseline Area</th>
                <th className="py-2.5 px-3">Latest Area</th>
                <th className="py-2.5 px-3">Surface Delta</th>
                <th className="py-2.5 px-3 text-right">Clinical Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1D2B52] font-medium text-xs">
              {LEADERBOARD.map((p) => (
                <tr key={p.rank} className="hover:bg-[#162347] transition-colors">
                  <td className="py-2.5 px-3 font-bold text-blue-400">#{p.rank}</td>
                  <td className="py-2.5 px-3 font-bold text-white">
                    {p.name}
                    <span className="block text-[10px] text-slate-500 font-mono">{p.mrn}</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">{p.district}</td>
                  <td className="py-2.5 px-3 font-mono">{p.initial}</td>
                  <td className="py-2.5 px-3 font-mono text-blue-300 font-bold">{p.current}</td>
                  <td className={`py-2.5 px-3 font-mono font-bold ${p.delta.startsWith('-') ? 'text-emerald-400' : 'text-red-400'}`}>
                    {p.delta}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.status.includes('HEALING') ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-700/50' :
                      p.status.includes('STABLE') ? 'bg-amber-950/50 text-amber-300 border border-amber-700/50' :
                      'bg-red-950/50 text-red-300 border border-red-700/50'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
