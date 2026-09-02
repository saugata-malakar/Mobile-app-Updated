import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function MobileAppSimulator() {
  const [step, setStep] = useState(1); // 1: Patient Form, 2: Photo Checklist, 3: Camera Viewfinder, 4: AI Review, 5: Cloud Sync
  const [patientName, setPatientName] = useState('Ramesh Chandra Sen');
  const [patientAge, setPatientAge] = useState('58');
  const [patientGender, setPatientGender] = useState('Male');
  const [patientHbA1c, setPatientHbA1c] = useState('9.4');
  const [consentGiven, setConsentGiven] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [simulatedDevice, setSimulatedDevice] = useState('POCO M4 Pro 5G');

  const handleCapture = () => {
    setIsCapturing(true);
    setTimeout(() => {
      setIsCapturing(false);
      setStep(4);
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-[#111C38] border border-[#23355E] rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Mobile Field Application Simulator
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-900/60 text-blue-300 border border-blue-700/50 uppercase">
              Live Interactive Emulator
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Simulates the exact ASHA Worker & Community Healthcare Mobile APK flow running on Android.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[#0C152E] px-3 py-1.5 rounded-lg border border-[#23355E] text-xs">
            <span className="text-slate-400">Device:</span>
            <select
              value={simulatedDevice}
              onChange={(e) => setSimulatedDevice(e.target.value)}
              className="bg-transparent text-white font-semibold outline-none cursor-pointer text-xs"
            >
              <option value="POCO M4 Pro 5G" className="bg-[#111C38]">POCO M4 Pro 5G</option>
              <option value="Samsung Galaxy A14" className="bg-[#111C38]">Samsung Galaxy A14</option>
              <option value="Redmi Note 12" className="bg-[#111C38]">Redmi Note 12</option>
            </select>
          </div>
          <a
            href="http://10.109.27.73:9090/DiabetesCareAI.apk"
            download
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow"
          >
            📥 Download APK (28.2 MB)
          </a>
        </div>
      </div>

      {/* Main Container: Phone Frame + Telemetry Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left: Smartphone Hardware Shell */}
        <div className="lg:col-span-6 flex justify-center">
          <div className="w-[360px] sm:w-[380px] h-[740px] bg-[#0A0D14] rounded-[48px] p-3.5 shadow-2xl border-4 border-slate-700 relative flex flex-col justify-between select-none">
            
            {/* Phone Bezel Buttons */}
            <div className="absolute -left-5 top-28 w-1 h-12 bg-slate-700 rounded-l-sm"></div>
            <div className="absolute -left-5 top-44 w-1 h-12 bg-slate-700 rounded-l-sm"></div>
            <div className="absolute -right-5 top-32 w-1 h-16 bg-slate-700 rounded-r-sm"></div>

            {/* Smartphone Inner Screen */}
            <div className="w-full h-full bg-[#0D1527] rounded-[36px] overflow-hidden flex flex-col relative text-slate-100 border border-slate-800">
              
              {/* Android Status Bar & Punch Hole */}
              <div className="h-7 bg-[#080D1A] px-5 flex items-center justify-between text-[11px] text-slate-400 font-medium z-20">
                <span>04:30</span>
                {/* Camera Punch Hole */}
                <div className="w-3.5 h-3.5 rounded-full bg-black border border-slate-700 mx-auto"></div>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span>Jio 5G</span>
                  <span>📶</span>
                  <span>🔋 98%</span>
                </div>
              </div>

              {/* Mobile App Header */}
              <div className="bg-[#142142] border-b border-[#223561] px-4 py-3 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-2">
                  <span className="text-base">🩹</span>
                  <div>
                    <h2 className="text-xs font-bold text-white">DiabetesCare AI</h2>
                    <p className="text-[9px] text-blue-300">ASHA Field Assistant v1.4</p>
                  </div>
                </div>
                <div className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  LAN Online
                </div>
              </div>

              {/* Mobile App Screen Content */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between">
                
                {/* ── STEP 1: Patient Registration ──────────────────────────── */}
                {step === 1 && (
                  <div className="space-y-3.5 animate-fadeIn">
                    <div className="bg-[#17254A] p-3 rounded-xl border border-[#273B6B]">
                      <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>👤</span> 1. Patient Demographics
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Enter details before photography.</p>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-slate-300 uppercase">Patient Full Name</label>
                        <input
                          type="text"
                          value={patientName}
                          onChange={(e) => setPatientName(e.target.value)}
                          className="w-full mt-1 px-3 py-2 bg-[#0C152E] border border-[#23355E] rounded-lg text-white text-xs"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-300 uppercase">Age (Years)</label>
                          <input
                            type="number"
                            value={patientAge}
                            onChange={(e) => setPatientAge(e.target.value)}
                            className="w-full mt-1 px-3 py-2 bg-[#0C152E] border border-[#23355E] rounded-lg text-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-300 uppercase">Gender</label>
                          <select
                            value={patientGender}
                            onChange={(e) => setPatientGender(e.target.value)}
                            className="w-full mt-1 px-2.5 py-2 bg-[#0C152E] border border-[#23355E] rounded-lg text-white text-xs"
                          >
                            <option>Male</option>
                            <option>Female</option>
                            <option>Other</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-300 uppercase">HbA1c Level (%)</label>
                        <input
                          type="text"
                          value={patientHbA1c}
                          onChange={(e) => setPatientHbA1c(e.target.value)}
                          className="w-full mt-1 px-3 py-2 bg-[#0C152E] border border-[#23355E] rounded-lg text-white text-xs"
                        />
                      </div>

                      <div className="bg-[#121E3D] p-3 rounded-lg border border-[#223561] flex items-start gap-2 mt-2">
                        <input
                          type="checkbox"
                          id="dpdpConsent"
                          checked={consentGiven}
                          onChange={(e) => setConsentGiven(e.target.checked)}
                          className="mt-0.5 rounded cursor-pointer"
                        />
                        <label htmlFor="dpdpConsent" className="text-[10px] text-slate-300 leading-tight cursor-pointer">
                          <strong>DPDP Act 2023 Statutory Consent:</strong> Patient agrees to secure wound photography and tele-assessment.
                        </label>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      disabled={!consentGiven}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center justify-center gap-1.5"
                    >
                      Start 3-Photo Protocol →
                    </button>
                  </div>
                )}

                {/* ── STEP 2: Photo Checklist ───────────────────────────────── */}
                {step === 2 && (
                  <div className="space-y-3.5 animate-fadeIn">
                    <div className="bg-[#17254A] p-3 rounded-xl border border-[#273B6B]">
                      <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>📋</span> 2. Standardized 3-Photo Protocol
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Required for AI dimension calibration.</p>
                    </div>

                    <div className="space-y-2">
                      <div className="p-2.5 rounded-lg bg-[#111C38] border border-[#23355E] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">✓</span>
                          <span className="text-xs font-semibold text-slate-200">Photo 1: Anatomical Overview</span>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-bold">Complete</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-[#111C38] border border-[#23355E] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">✓</span>
                          <span className="text-xs font-semibold text-slate-200">Photo 2: Close-Up Ulcer Bed</span>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-bold">Complete</span>
                      </div>

                      <div className="p-3 rounded-lg bg-blue-950/40 border-2 border-blue-500 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                          <div>
                            <span className="text-xs font-bold text-white">Photo 3: Measurement Photo</span>
                            <p className="text-[9px] text-blue-300">Place 20mm blue sticker next to ulcer</p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold">ACTIVE</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <span>📷</span> Open Camera & Viewfinder
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="w-full mt-2 py-1.5 text-slate-400 hover:text-white text-[11px] font-medium text-center"
                      >
                        ← Back to Demographics
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 3: Camera Viewfinder ─────────────────────────────── */}
                {step === 3 && (
                  <div className="flex-1 flex flex-col justify-between space-y-3 animate-fadeIn relative">
                    <div className="relative flex-1 bg-black rounded-2xl overflow-hidden border border-slate-700 flex flex-col justify-between p-3">
                      
                      {/* Viewfinder Guidance Badges */}
                      <div className="flex items-center justify-between z-10">
                        <span className="px-2 py-0.5 rounded bg-black/60 text-emerald-400 border border-emerald-500/50 text-[10px] font-bold">
                          ✓ In Focus
                        </span>
                        <span className="px-2 py-0.5 rounded bg-black/60 text-blue-300 border border-blue-500/50 text-[10px] font-bold">
                          📏 25cm Distance
                        </span>
                        <span className="px-2 py-0.5 rounded bg-black/60 text-yellow-300 border border-yellow-500/50 text-[10px] font-bold">
                          💡 380 Lux
                        </span>
                      </div>

                      {/* Viewfinder Crosshair & Scale Target Guide */}
                      <div className="my-auto flex flex-col items-center justify-center relative">
                        {/* Ulcer Target Zone */}
                        <div className="w-32 h-24 border-2 border-dashed border-red-400/80 rounded-3xl flex items-center justify-center relative">
                          <span className="text-[10px] text-red-300 font-bold bg-black/70 px-2 py-0.5 rounded">
                            Align Ulcer Here
                          </span>
                        </div>

                        {/* 20mm Calibrant Target Marker Guide */}
                        <div className="w-14 h-14 border-2 border-dashed border-blue-400 rounded-full flex items-center justify-center mt-3 bg-blue-900/30">
                          <span className="text-[8px] text-blue-300 font-bold text-center leading-none">
                            20mm Sticker
                          </span>
                        </div>
                      </div>

                      {/* Bottom Viewfinder Instruction */}
                      <div className="text-center z-10">
                        <p className="text-[10px] text-slate-300 font-medium bg-black/70 py-1 px-2 rounded-lg">
                          Keep camera parallel to skin surface
                        </p>
                      </div>

                      {/* Shutter Animation Overlay */}
                      {isCapturing && (
                        <div className="absolute inset-0 bg-white animate-ping z-30 flex items-center justify-center"></div>
                      )}
                    </div>

                    {/* Camera Shutter Bar */}
                    <div className="flex items-center justify-between px-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="text-[11px] text-slate-400 font-semibold"
                      >
                        Cancel
                      </button>

                      {/* Shutter Button */}
                      <button
                        type="button"
                        onClick={handleCapture}
                        disabled={isCapturing}
                        className="w-14 h-14 rounded-full border-4 border-white bg-red-600 hover:bg-red-500 active:scale-95 transition-all flex items-center justify-center shadow-lg"
                      >
                        <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xs">📸</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        className="text-[11px] text-blue-400 font-semibold"
                      >
                        Upload
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 4: AI Quality & Dimension Review ─────────────────── */}
                {step === 4 && (
                  <div className="space-y-3 animate-fadeIn text-xs">
                    <div className="bg-[#17254A] p-2.5 rounded-xl border border-[#273B6B] flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-white">OpenCV AI Segmentation</h3>
                        <p className="text-[9px] text-emerald-400 font-medium">Calibrant: 20.0mm circular detected</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowOverlay(!showOverlay)}
                        className="px-2.5 py-1 rounded bg-blue-600 text-white font-bold text-[10px] shadow"
                      >
                        {showOverlay ? 'Hide Overlay' : 'Show Overlay'}
                      </button>
                    </div>

                    {/* Simulated Image with Segmentation Mask */}
                    <div className="h-44 bg-[#080D1A] rounded-xl border border-[#23355E] relative overflow-hidden flex items-center justify-center">
                      <div className="w-36 h-28 bg-gradient-to-br from-red-900/60 to-yellow-900/40 rounded-full border-2 border-red-500 flex flex-col items-center justify-center relative shadow-inner">
                        {showOverlay && (
                          <div className="absolute inset-0 rounded-full bg-red-500/30 flex flex-col items-center justify-center p-2">
                            <span className="text-[9px] font-black text-white bg-black/80 px-1.5 py-0.5 rounded">
                              Area: 2.57 cm²
                            </span>
                            <span className="text-[8px] font-bold text-yellow-300 mt-0.5">
                              L: 24.1mm · W: 13.8mm
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Calibrant Sticker in Image */}
                      <div className="absolute bottom-3 right-4 w-9 h-9 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-[8px] font-bold text-white shadow">
                        20mm
                      </div>
                    </div>

                    {/* Metric Cards */}
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="bg-[#111C38] p-1.5 rounded-lg border border-[#23355E]">
                        <span className="text-[9px] text-slate-400 block">Length</span>
                        <strong className="text-xs text-white">24.1 mm</strong>
                      </div>
                      <div className="bg-[#111C38] p-1.5 rounded-lg border border-[#23355E]">
                        <span className="text-[9px] text-slate-400 block">Width</span>
                        <strong className="text-xs text-white">13.8 mm</strong>
                      </div>
                      <div className="bg-[#111C38] p-1.5 rounded-lg border border-[#23355E]">
                        <span className="text-[9px] text-slate-400 block">Surface Area</span>
                        <strong className="text-xs text-emerald-400 font-bold">2.57 cm²</strong>
                      </div>
                    </div>

                    {/* Tissue Classification */}
                    <div className="bg-[#111C38] p-2 rounded-lg border border-[#23355E] space-y-1">
                      <span className="text-[10px] font-bold text-slate-300 block">Tissue Composition:</span>
                      <div className="w-full h-2 rounded-full bg-slate-800 flex overflow-hidden">
                        <div className="bg-red-500 h-full" style={{ width: '68%' }}></div>
                        <div className="bg-yellow-400 h-full" style={{ width: '24%' }}></div>
                        <div className="bg-slate-900 h-full" style={{ width: '8%' }}></div>
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400">
                        <span className="text-red-400 font-semibold">68% Granulation</span>
                        <span className="text-yellow-400 font-semibold">24% Slough</span>
                        <span className="text-slate-400 font-semibold">8% Necrotic</span>
                      </div>
                    </div>

                    <div className="pt-1 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setStep(3)}
                        className="flex-1 py-2 bg-[#1C2C52] text-slate-300 font-semibold rounded-xl text-xs"
                      >
                        Retake
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep(5)}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow flex items-center justify-center gap-1"
                      >
                        ✓ Submit Record
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 5: Cloud Sync Complete ───────────────────────────── */}
                {step === 5 && (
                  <div className="space-y-4 animate-fadeIn text-center my-auto">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center text-2xl mx-auto shadow-lg">
                      ✓
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-white">Record Synchronized!</h3>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-[240px] mx-auto">
                        Wound dimensions and clinical photographs uploaded to Hospital Hub (`10.109.27.73:8000`).
                      </p>
                    </div>

                    <div className="bg-[#111C38] p-3 rounded-xl border border-[#23355E] text-left text-[11px] space-y-1.5 font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Patient MRN:</span>
                        <span className="text-white font-bold">PAT_KGP_01</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Calibrated Area:</span>
                        <span className="text-emerald-400 font-bold">2.57 cm²</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">DPDP SHA-256:</span>
                        <span className="text-blue-300 text-[9px] truncate max-w-[130px]">8f3b...9a12</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <Link
                        to="/patients/PAT_KGP_01"
                        className="block w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow"
                      >
                        View in Doctor Dashboard →
                      </Link>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="block w-full py-2 bg-[#142142] hover:bg-[#1A2C56] text-slate-300 font-semibold text-xs rounded-xl border border-[#223561]"
                      >
                        Register Next Patient
                      </button>
                    </div>
                  </div>
                )}

              </div>

              {/* Android Navigation Bar */}
              <div className="h-6 bg-[#080D1A] flex items-center justify-center gap-12 text-slate-600 text-xs">
                <span>◀</span>
                <span>●</span>
                <span>■</span>
              </div>

            </div>
          </div>
        </div>

        {/* Right: Technical Architecture & Field Protocol Guide */}
        <div className="lg:col-span-6 space-y-4 text-xs">
          
          <div className="bg-[#111C38] border border-[#23355E] rounded-xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📡</span> Live Mobile API Network Telemetry
            </h3>
            <p className="text-slate-400 text-xs mt-1">
              Data transmitted from the mobile app to the local FastAPI backend (`http://10.109.27.73:8000`).
            </p>

            <div className="mt-4 bg-[#0A0E1A] p-3.5 rounded-lg border border-[#1E2E54] font-mono text-[11px] text-blue-300 overflow-x-auto space-y-1">
              <p><span className="text-slate-500">POST</span> /api/v1/mobile/upload-wound-photo</p>
              <p><span className="text-slate-500">Host:</span> 10.109.27.73:8000</p>
              <p><span className="text-slate-500">Payload:</span> &#123;</p>
              <p className="pl-4">"patient_id": "PAT_KGP_01",</p>
              <p className="pl-4">"operator_id": "ASHA_WB_0042",</p>
              <p className="pl-4">"photo_type": "measurement",</p>
              <p className="pl-4">"calibrant_sticker_mm": 20.0,</p>
              <p className="pl-4">"consent_timestamp": "2026-09-02T16:15:00Z"</p>
              <p>&#125;</p>
            </div>
          </div>

          <div className="bg-[#111C38] border border-[#23355E] rounded-xl p-5 shadow-lg space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📖</span> Field Photography Protocol for ASHA Workers
            </h3>
            <ul className="space-y-2 text-slate-300 text-xs">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">1.</span>
                <span><strong>Sticker Placement:</strong> Stick the 20mm blue calibrant circle on healthy intact skin within 2-5cm of the ulcer margin.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">2.</span>
                <span><strong>Distance & Angle:</strong> Hold the camera ~25cm away, directly perpendicular to prevent perspective distortion.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">3.</span>
                <span><strong>Lighting:</strong> Ensure even ambient lighting without direct harsh flashlight glare.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-bold">4.</span>
                <span><strong>DPDP Compliance:</strong> Patient digital consent is captured before camera shutter activation.</span>
              </li>
            </ul>
          </div>

          <div className="bg-[#111C38] border border-[#23355E] rounded-xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-white">Physical Android Device Testing</h4>
              <p className="text-[11px] text-slate-400">Install the standalone release APK on your POCO phone.</p>
            </div>
            <a
              href="http://10.109.27.73:9090/DiabetesCareAI.apk"
              download
              className="px-3 py-1.5 rounded-lg bg-[#1C2C52] hover:bg-[#253966] text-white font-bold text-xs border border-[#2D4378]"
            >
              Get APK
            </a>
          </div>

        </div>

      </div>
    </div>
  );
}
