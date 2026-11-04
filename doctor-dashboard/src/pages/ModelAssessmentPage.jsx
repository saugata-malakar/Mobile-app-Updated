import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

export default function ModelAssessmentPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [base64Image, setBase64Image] = useState(null);
  const [pixelsPerMm, setPixelsPerMm] = useState(10.0);
  const [activeTab, setActiveTab] = useState('overlay'); // 'overlay', 'mask', 'comparison'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setPreviewUrl(dataUrl);
      setBase64Image(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const runModelInference = async () => {
    if (!base64Image) {
      setError('Please upload or select an ulcer photo first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE}/api/v1/wound/segment`, {
        image_base64: base64Image,
        pixels_per_mm: parseFloat(pixelsPerMm) || 10.0,
        conf_threshold: 0.15,
      });

      if (response.data && response.data.success) {
        setResult(response.data);
        setActiveTab('overlay');
      } else {
        setError('Model processed the image but did not detect wound contours. Try adjusting sensitivity or optical scale.');
      }
    } catch (err) {
      console.error('Inference error:', err);
      setError(
        err.response?.data?.detail ||
          'Failed to connect to FastAPI backend at port 8000. Ensure START_SERVER.bat is running on your PC.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-[#111C38] border border-[#23355E] rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h1 className="text-xl font-bold text-white tracking-tight">
              AI Wound Segmentation & Model Assessment Workstation
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 uppercase">
              YOLO11 + SAM2 Active
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            Clinical evaluation workstation for doctors and researchers to upload patient photographs, inspect boundary outlines, and assess morphometric accuracy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-[#0C152E] border border-[#23355E] text-xs text-slate-300">
            Engine: <span className="text-emerald-400 font-semibold">SAM2 Global-Local</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Upload & Controls on Left, Outputs on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Input & Controls */}
        <div className="lg:col-span-5 space-y-4">
          {/* File Upload Box */}
          <div className="bg-[#111C38] border border-[#23355E] rounded-xl p-5 space-y-4 shadow-md">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>📁</span> Upload Clinical Wound Photograph
            </h2>

            <div className="border-2 border-dashed border-[#23355E] hover:border-blue-500/60 rounded-xl p-6 text-center transition-colors bg-[#0C152E]">
              <input
                type="file"
                id="wound-file-input"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="wound-file-input" className="cursor-pointer block space-y-2">
                <div className="text-3xl">📸</div>
                <div className="text-xs font-semibold text-blue-400 hover:text-blue-300">
                  Click to Browse or Drag & Drop Photo
                </div>
                <div className="text-[11px] text-slate-500">
                  Supports JPG, PNG, WEBP, AVIF, HEIC
                </div>
              </label>
            </div>

            {selectedFile && (
              <div className="flex items-center justify-between text-xs bg-[#090F20] p-2.5 rounded-lg border border-[#23355E]">
                <span className="text-slate-300 truncate max-w-[200px]">{selectedFile.name}</span>
                <span className="text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</span>
              </div>
            )}

            {/* Calibration Controls */}
            <div className="space-y-3 pt-2 border-t border-[#23355E]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  📏 Optical Calibration Scale:
                </label>
                <span className="text-xs font-bold text-blue-400">{pixelsPerMm} px/mm</span>
              </div>
              <input
                type="range"
                min="2.0"
                max="30.0"
                step="0.5"
                value={pixelsPerMm}
                onChange={(e) => setPixelsPerMm(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#23355E] rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-[10px] text-slate-500">
                Default 10.0 px/mm standard (~20mm sticker in 512×512 frame).
              </p>
            </div>

            {/* Run Button */}
            <button
              onClick={runModelInference}
              disabled={loading || !base64Image}
              className={`w-full py-3 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md ${
                loading || !base64Image
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Running YOLO11 & SAM2 Pipeline...
                </>
              ) : (
                <>
                  <span>⚡</span> Segment Wound & Calculate Metrics
                </>
              )}
            </button>

            {error && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-300">
                ⚠️ {error}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Visualizer & Metrics */}
        <div className="lg:col-span-7 space-y-4">
          {/* Visualizer Card */}
          <div className="bg-[#111C38] border border-[#23355E] rounded-xl overflow-hidden shadow-md">
            {/* View Tabs */}
            <div className="flex border-b border-[#23355E] bg-[#0C152E]">
              <button
                onClick={() => setActiveTab('overlay')}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                  activeTab === 'overlay'
                    ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-950/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🎯 Marked Boundary Overlay
              </button>
              <button
                onClick={() => setActiveTab('mask')}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                  activeTab === 'mask'
                    ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-950/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ⬛ Binary Segmentation Mask
              </button>
              <button
                onClick={() => setActiveTab('original')}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                  activeTab === 'original'
                    ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-950/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📷 Original Photograph
              </button>
            </div>

            {/* Canvas / Image Display */}
            <div className="h-[360px] bg-[#060B18] flex items-center justify-center p-3 relative">
              {loading && (
                <div className="text-center space-y-2">
                  <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-xs text-slate-300 font-semibold">Running dual-stream SAM2 inference...</p>
                </div>
              )}

              {!loading && activeTab === 'overlay' && result?.annotated_b64 && (
                <img
                  src={`data:image/jpeg;base64,${result.annotated_b64}`}
                  alt="Boundary Overlay"
                  className="max-h-full max-w-full object-contain rounded-lg"
                />
              )}

              {!loading && activeTab === 'mask' && result?.mask_b64 && (
                <img
                  src={`data:image/png;base64,${result.mask_b64}`}
                  alt="Binary Mask"
                  className="max-h-full max-w-full object-contain rounded-lg"
                />
              )}

              {!loading && (activeTab === 'original' || (!result && previewUrl)) && previewUrl && (
                <img
                  src={previewUrl}
                  alt="Original"
                  className="max-h-full max-w-full object-contain rounded-lg"
                />
              )}

              {!loading && !result && !previewUrl && (
                <div className="text-center text-slate-500 space-y-2">
                  <div className="text-4xl opacity-50">🦶</div>
                  <p className="text-xs">No image loaded. Upload a patient wound photo on the left to begin.</p>
                </div>
              )}
            </div>

            {/* Legend / Status Footer */}
            <div className="p-3 bg-[#0C152E] border-t border-[#23355E] text-[11px] text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span>Dual-tone boundary outline: Outer Red (4px) + Inner Bright Yellow (2px)</span>
              </div>
              {result && (
                <span className="text-emerald-400 font-semibold">
                  Detected {result.num_lesions} lesion margin(s)
                </span>
              )}
            </div>
          </div>

          {/* Morphometrics & Tissue Breakdown */}
          {result && (
            <div className="bg-[#111C38] border border-[#23355E] rounded-xl p-5 space-y-4 shadow-md">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📊</span> Calibrated Clinical Morphometrics
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#0C152E] p-3 rounded-lg border border-[#23355E]">
                  <div className="text-[10px] text-slate-400 font-medium">Ulcer Surface Area</div>
                  <div className="text-lg font-extrabold text-emerald-400 mt-1">
                    {result.area_cm2.toFixed(3)} <span className="text-xs font-normal text-slate-400">cm²</span>
                  </div>
                </div>

                <div className="bg-[#0C152E] p-3 rounded-lg border border-[#23355E]">
                  <div className="text-[10px] text-slate-400 font-medium">Max Feret Length</div>
                  <div className="text-lg font-extrabold text-amber-400 mt-1">
                    {result.length_mm.toFixed(1)} <span className="text-xs font-normal text-slate-400">mm</span>
                  </div>
                </div>

                <div className="bg-[#0C152E] p-3 rounded-lg border border-[#23355E]">
                  <div className="text-[10px] text-slate-400 font-medium">Orthogonal Width</div>
                  <div className="text-lg font-extrabold text-amber-400 mt-1">
                    {result.width_mm.toFixed(1)} <span className="text-xs font-normal text-slate-400">mm</span>
                  </div>
                </div>

                <div className="bg-[#0C152E] p-3 rounded-lg border border-[#23355E]">
                  <div className="text-[10px] text-slate-400 font-medium">Confidence</div>
                  <div className="text-lg font-extrabold text-blue-400 mt-1">
                    {Math.round(result.confidence * 100)}%
                  </div>
                </div>
              </div>

              {/* Tissue Composition */}
              {result.tissue && (
                <div className="bg-[#0C152E] p-3 rounded-lg border border-[#23355E] space-y-2">
                  <div className="text-xs font-semibold text-slate-300">
                    🥩 Tissue Bed Composition Analysis:
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-rose-400 font-medium">
                      🔴 Granulation: <span className="text-white font-bold">{result.tissue.granulation_pct ?? 0}%</span>
                    </div>
                    <div className="text-amber-400 font-medium">
                      🟡 Slough: <span className="text-white font-bold">{result.tissue.slough_pct ?? 0}%</span>
                    </div>
                    <div className="text-slate-400 font-medium">
                      ⚫ Necrotic: <span className="text-white font-bold">{result.tissue.necrotic_pct ?? 0}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
