import React, { useState, useMemo } from 'react';
import { DerivationCase } from '../utils/waveformDerivations';
import { useTheme } from '../context/ThemeContext';
import { Layers, Eye, Sparkles } from 'lucide-react';

interface AnnotatedWaveformPlotProps {
  derivationCase: DerivationCase;
  Vrms: number;
  alphaDeg: number;
  R: number;
  L: number;
  freq: number;
}

interface ThreePhasePoint {
  deg: number;
  va: number;
  vb: number;
  vc: number;
  vp: number;
  vn: number;
  vo: number;
  switchP: string;
  switchN: string;
  phaseP: string;
  phaseN: string;
}

export const AnnotatedWaveformPlot: React.FC<AnnotatedWaveformPlotProps> = ({
  derivationCase,
  Vrms,
  alphaDeg,
  R,
  L,
  freq,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const is3Ph = derivationCase.category === '3-phase';
  const [viewMode3Ph, setViewMode3Ph] = useState<'dual' | 'envelopes' | 'rectified'>('dual');
  const [hoveredDeg, setHoveredDeg] = useState<number | null>(null);

  const Vm = Math.sqrt(2) * Vrms;
  const Vm_LL = Math.sqrt(3) * Vm;

  // Compute live derivation metrics
  const calcResult = useMemo(() => {
    return derivationCase.calculateValues({
      Vrms,
      alphaDeg,
      R,
      L,
      freq,
    });
  }, [derivationCase, Vrms, alphaDeg, R, L, freq]);

  const betaDeg = calcResult.betaCalc ?? 180;
  const gammaDeg = calcResult.gammaCalc ?? Math.max(0, betaDeg - alphaDeg);

  // SVG Geometry Config
  const width = 840;
  const padLeft = 64;
  const padRight = 36;
  const padTop = 36;
  const padBottom = 42;
  const plotW = width - padLeft - padRight;

  const scaleX = (deg: number) => padLeft + (deg / 720) * plotW;
  const unscaleX = (svgX: number) => {
    const clamped = Math.max(padLeft, Math.min(width - padRight, svgX));
    return ((clamped - padLeft) / plotW) * 720;
  };

  // ---------------------------------------------------------------------------
  // 3-PHASE RECTIFIER DATA GENERATION
  // ---------------------------------------------------------------------------
  const threePhaseData = useMemo(() => {
    if (!is3Ph) return null;

    const numSteps = 720;
    const pts: ThreePhasePoint[] = [];

    for (let i = 0; i <= numSteps; i++) {
      const deg = i;
      const rad = (deg * Math.PI) / 180;

      // Symmetrical 3-phase sinusoidal voltages (phase-to-neutral)
      const va = Vm * Math.sin(rad);
      const vb = Vm * Math.sin(rad - (2 * Math.PI) / 3);
      const vc = Vm * Math.sin(rad + (2 * Math.PI) / 3);

      let vp = 0;
      let vn = 0;
      let switchP = '';
      let switchN = '';
      let phaseP = 'A';
      let phaseN = 'B';

      // 1. Determine UPPER RAIL Conducting Phase (vp)
      if (derivationCase.waveformType === '3ph-fb-diode') {
        // Uncontrolled 6-pulse diode bridge (alpha = 0)
        if (va >= vb && va >= vc) {
          vp = va;
          switchP = 'D1 (Phase A)';
          phaseP = 'A';
        } else if (vb >= vc) {
          vp = vb;
          switchP = 'D3 (Phase B)';
          phaseP = 'B';
        } else {
          vp = vc;
          switchP = 'D5 (Phase C)';
          phaseP = 'C';
        }
      } else {
        // Controlled SCR bridge, Semi-converter, or 3-Phase Half-Wave
        // Natural crossover of Phase A is at 30° (pi/6). Fired at 30° + alpha.
        const topShift = (((deg - 30 - alphaDeg) % 360) + 360) % 360;
        if (topShift < 120) {
          vp = va;
          switchP = 'S1 (Phase A)';
          phaseP = 'A';
        } else if (topShift < 240) {
          vp = vb;
          switchP = 'S3 (Phase B)';
          phaseP = 'B';
        } else {
          vp = vc;
          switchP = 'S5 (Phase C)';
          phaseP = 'C';
        }
      }

      // 2. Determine LOWER RAIL Conducting Phase (vn)
      if (derivationCase.waveformType === '3ph-hw') {
        // 3-Phase Half-Wave has neutral return (vn = 0)
        vn = 0;
        switchN = 'Neutral (N)';
        phaseN = 'N';
      } else if (derivationCase.waveformType === '3ph-fb-diode') {
        // Uncontrolled diode bridge bottom group (alpha = 0)
        if (va <= vb && va <= vc) {
          vn = va;
          switchN = 'D4 (Phase A)';
          phaseN = 'A';
        } else if (vb <= vc) {
          vn = vb;
          switchN = 'D6 (Phase B)';
          phaseN = 'B';
        } else {
          vn = vc;
          switchN = 'D2 (Phase C)';
          phaseN = 'C';
        }
      } else if (derivationCase.waveformType === '3ph-semi') {
        // 3-Phase Semi-Converter: Bottom switches are DIODES (natural commutation alpha = 0)
        // Natural crossover for minimum potential: Phase B (-30° to 90°), Phase C (90° to 210°), Phase A (210° to 330°)
        const botShift = (((deg - 90) % 360) + 360) % 360;
        if (botShift < 120) {
          vn = vc;
          switchN = 'D2 (Phase C)';
          phaseN = 'C';
        } else if (botShift < 240) {
          vn = va;
          switchN = 'D4 (Phase A)';
          phaseN = 'A';
        } else {
          vn = vb;
          switchN = 'D6 (Phase B)';
          phaseN = 'B';
        }
      } else {
        // 3-Phase Fully Controlled SCR Bridge: Bottom SCRs fired with delay alpha
        // Bottom group natural commutations at 90° (C), 210° (A), 330° (B)
        const botShift = (((deg - 90 - alphaDeg) % 360) + 360) % 360;
        if (botShift < 120) {
          vn = vc;
          switchN = 'S2 (Phase C)';
          phaseN = 'C';
        } else if (botShift < 240) {
          vn = va;
          switchN = 'S4 (Phase A)';
          phaseN = 'A';
        } else {
          vn = vb;
          switchN = 'S6 (Phase B)';
          phaseN = 'B';
        }
      }

      // 3. Instantaneous Output Voltage vo(t)
      let vo = 0;
      if (derivationCase.waveformType === '3ph-hw') {
        vo = L <= 0.5 ? Math.max(0, vp) : vp;
      } else if (derivationCase.waveformType === '3ph-semi') {
        // Freewheeling diodes prevent negative excursion
        vo = Math.max(0, vp - vn);
      } else if (derivationCase.waveformType === '3ph-fb-diode') {
        vo = Math.max(0, vp - vn);
      } else {
        // 3ph-fb-ctrl
        const diff = vp - vn;
        if (L <= 0.5 && diff < 0) {
          // Pure resistive load: thyristors extinguish when current drops to zero
          vo = 0;
        } else {
          // Inductive continuous conduction: vo swings negative until next thyristor pair fires
          vo = diff;
        }
      }

      pts.push({ deg, va, vb, vc, vp, vn, vo, switchP, switchN, phaseP, phaseN });
    }

    return pts;
  }, [is3Ph, derivationCase.waveformType, Vm, alphaDeg, L]);

  // ---------------------------------------------------------------------------
  // SINGLE-PHASE DATA GENERATION (FALLBACK)
  // ---------------------------------------------------------------------------
  const singlePhaseData = useMemo(() => {
    if (is3Ph) return null;

    const numSteps = 720;
    const pts: { deg: number; vs: number; vo: number }[] = [];

    for (let i = 0; i <= numSteps; i++) {
      const deg = i;
      const rad = (deg * Math.PI) / 180;
      const vs = Vm * Math.sin(rad);

      let vo = 0;
      const modCycle = deg % 360;
      const mod180 = deg % 180;

      switch (derivationCase.waveformType) {
        case '1ph-hw-r':
        case '1ph-hw-fwd': {
          if (modCycle >= alphaDeg && modCycle < 180) {
            vo = Vm * Math.sin(rad);
          } else {
            vo = 0;
          }
          break;
        }

        case '1ph-hw-rl': {
          const effBetaHW = Math.min(360 + alphaDeg, betaDeg);
          if (modCycle >= alphaDeg && modCycle < effBetaHW) {
            vo = Vm * Math.sin(rad);
          } else if (effBetaHW > 360 && modCycle < effBetaHW - 360) {
            vo = Vm * Math.sin(rad);
          } else {
            vo = 0;
          }
          break;
        }

        case '1ph-fb-cont': {
          if (modCycle >= alphaDeg && modCycle < 180 + alphaDeg) {
            vo = Vm * Math.sin(rad);
          } else {
            vo = -Vm * Math.sin(rad);
          }
          break;
        }

        case '1ph-fb-r':
        case '1ph-semi': {
          if (mod180 >= alphaDeg && mod180 < 180) {
            vo = Math.abs(Vm * Math.sin(rad));
          } else {
            vo = 0;
          }
          break;
        }

        case '1ph-fb-disc': {
          const effBeta = Math.min(180 + alphaDeg, betaDeg);
          if (modCycle >= alphaDeg && modCycle < effBeta) {
            vo = Vm * Math.sin(rad);
          } else if (modCycle >= 180 + alphaDeg && modCycle < 180 + effBeta) {
            vo = -Vm * Math.sin(rad);
          } else if (effBeta > 180 && modCycle < effBeta - 180) {
            vo = -Vm * Math.sin(rad);
          } else {
            vo = 0;
          }
          break;
        }

        default:
          vo = Math.abs(vs);
      }

      pts.push({ deg, vs, vo });
    }

    return pts;
  }, [is3Ph, derivationCase.waveformType, Vm, alphaDeg, betaDeg]);

  // ---------------------------------------------------------------------------
  // INTEGRATION PERIOD INTERVAL CALCULATION (MATHEMATICALLY EXACT)
  // ---------------------------------------------------------------------------
  const integrationInterval = useMemo(() => {
    if (is3Ph) {
      if (derivationCase.waveformType === '3ph-hw') {
        // 3-Phase Half-Wave: Repetition period T0 = 120° (2pi/3)
        // Conduction of Phase A: from 30° + alpha to 150° + alpha
        const start = 30 + alphaDeg;
        const end = 30 + alphaDeg + 120;
        return {
          startDeg: start,
          endDeg: end,
          periodDeg: 120,
          label: 'T₀ = 120° (2π/3)',
          latexExpr: '\\int_{30^\\circ+\\alpha}^{150^\\circ+\\alpha} v_a \\, d(\\omega t)',
          startLabel: '30°+α',
          endLabel: '150°+α',
        };
      } else {
        // 3-Phase 6-Pulse (Controlled, Semi, Diode): Repetition period T0 = 60° (pi/3)
        // Conduction of S1(A) & S6(B): from 30° + alpha to 90° + alpha
        const start = 30 + alphaDeg;
        const end = 30 + alphaDeg + 60;
        return {
          startDeg: start,
          endDeg: end,
          periodDeg: 60,
          label: 'T₀ = 60° (π/3)',
          latexExpr: '\\int_{30^\\circ+\\alpha}^{90^\\circ+\\alpha} [v_p - v_n] \\, d(\\omega t)',
          startLabel: '30°+α',
          endLabel: '90°+α',
        };
      }
    } else {
      // Single-Phase
      let start = alphaDeg;
      let end = alphaDeg + 180;
      if (derivationCase.betaSymbol && betaDeg > 0) {
        end = betaDeg;
      } else if (
        derivationCase.waveformType === '1ph-hw-r' ||
        derivationCase.waveformType === '1ph-fb-r' ||
        derivationCase.waveformType === '1ph-semi'
      ) {
        end = 180;
      }
      return {
        startDeg: start,
        endDeg: end,
        periodDeg: derivationCase.periodVal ? (derivationCase.periodVal * 180) / Math.PI : 180,
        label: `T₀ = ${derivationCase.period.replace('\\', '')}`,
        latexExpr: `\\int_{\\alpha}^{${end}^\\circ} v_o \\, d(\\omega t)`,
        startLabel: 'α',
        endLabel: derivationCase.betaSymbol ? 'β' : 'π',
      };
    }
  }, [is3Ph, derivationCase, alphaDeg, betaDeg]);

  // Hover details
  const hoveredPoint = useMemo(() => {
    if (hoveredDeg === null) return null;
    const clampedDeg = Math.round(Math.max(0, Math.min(720, hoveredDeg)));
    if (is3Ph && threePhaseData) {
      return threePhaseData[clampedDeg] || null;
    }
    if (!is3Ph && singlePhaseData) {
      return singlePhaseData[clampedDeg] || null;
    }
    return null;
  }, [hoveredDeg, is3Ph, threePhaseData, singlePhaseData]);

  // ---------------------------------------------------------------------------
  // RENDER 3-PHASE WAVEFORM VISUALIZER
  // ---------------------------------------------------------------------------
  if (is3Ph && threePhaseData) {
    // Coordinate scalers for Phase Potentials plot (Upper)
    const upperH = viewMode3Ph === 'envelopes' ? 360 : 215;
    const upperPlotH = upperH - padTop - padBottom;
    const upperZeroY = padTop + upperPlotH * 0.5;
    const maxPhaseV = Vm * 1.35;
    const scaleYPhase = (v: number) => upperZeroY - (v / maxPhaseV) * (upperPlotH * 0.46);

    // Coordinate scalers for Rectified Vo plot (Lower)
    const lowerH = viewMode3Ph === 'rectified' ? 360 : 185;
    const lowerPlotH = lowerH - padTop - padBottom;
    const maxVoV = Vm_LL * 1.25;
    const lowerZeroY = padTop + lowerPlotH * 0.78;
    const scaleYVo = (v: number) => lowerZeroY - (v / maxVoV) * (lowerPlotH * 0.7);

    // Build SVG paths for 3-Phase Sinusoids
    let pathVaD = '';
    let pathVbD = '';
    let pathVcD = '';
    let pathVpD = '';
    let pathVnD = '';
    let pathRoomD = '';
    let pathVoD = '';

    // Room path forward along vp (0 to 720)
    for (let i = 0; i <= 720; i++) {
      const pt = threePhaseData[i];
      const x = scaleX(pt.deg);
      const yVa = scaleYPhase(pt.va);
      const yVb = scaleYPhase(pt.vb);
      const yVc = scaleYPhase(pt.vc);
      const yVp = scaleYPhase(pt.vp);
      const yVo = scaleYVo(pt.vo);

      if (i === 0) {
        pathVaD += `M ${x.toFixed(1)} ${yVa.toFixed(1)}`;
        pathVbD += `M ${x.toFixed(1)} ${yVb.toFixed(1)}`;
        pathVcD += `M ${x.toFixed(1)} ${yVc.toFixed(1)}`;
        pathVpD += `M ${x.toFixed(1)} ${yVp.toFixed(1)}`;
        pathRoomD += `M ${x.toFixed(1)} ${yVp.toFixed(1)}`;
        pathVoD += `M ${x.toFixed(1)} ${yVo.toFixed(1)}`;
      } else {
        pathVaD += ` L ${x.toFixed(1)} ${yVa.toFixed(1)}`;
        pathVbD += ` L ${x.toFixed(1)} ${yVb.toFixed(1)}`;
        pathVcD += ` L ${x.toFixed(1)} ${yVc.toFixed(1)}`;
        pathVpD += ` L ${x.toFixed(1)} ${yVp.toFixed(1)}`;
        pathRoomD += ` L ${x.toFixed(1)} ${yVp.toFixed(1)}`;
        pathVoD += ` L ${x.toFixed(1)} ${yVo.toFixed(1)}`;
      }
    }

    // Room path backward along vn (720 down to 0)
    for (let i = 720; i >= 0; i--) {
      const pt = threePhaseData[i];
      const x = scaleX(pt.deg);
      const yVn = scaleYPhase(pt.vn);
      pathRoomD += ` L ${x.toFixed(1)} ${yVn.toFixed(1)}`;
      if (i === 720) {
        pathVnD += `M ${x.toFixed(1)} ${yVn.toFixed(1)}`;
      } else {
        pathVnD += ` L ${x.toFixed(1)} ${yVn.toFixed(1)}`;
      }
    }
    pathRoomD += ' Z';

    // Caliper measurement coordinates at pulse midpoint
    const caliperDeg = 60 + alphaDeg;
    const caliperPt = threePhaseData[caliperDeg] || threePhaseData[60];
    const caliperX = scaleX(caliperPt.deg);
    const caliperYTop = scaleYPhase(caliperPt.vp);
    const caliperYBot = scaleYPhase(caliperPt.vn);

    // Hatch width and position for integration period
    const hatchX1 = scaleX(integrationInterval.startDeg);
    const hatchX2 = scaleX(integrationInterval.endDeg);
    const hatchW = Math.max(0, hatchX2 - hatchX1);

    const vdcY = scaleYVo(calcResult.Vdc);
    const vrmsY = scaleYVo(calcResult.Vrms);

    return (
      <div
        id="annotated-3phase-waveform-card"
        className={`flex flex-col border rounded-xl overflow-hidden shadow-xl transition-colors duration-200 ${
          isLight ? 'bg-white border-slate-200 shadow-slate-200/50' : 'bg-slate-950 border-slate-800'
        }`}
      >
        {/* Header with Title, Mode Switcher, and Quick Metrics */}
        <div
          className={`flex flex-wrap items-center justify-between px-4 py-2.5 border-b gap-3 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/90 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                  3Φ Waveform Analysis:
                </span>
                <span className={`text-xs font-mono font-bold ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                  v_o = v_p - v_n
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                    isLight ? 'bg-amber-100 text-amber-900' : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {integrationInterval.label}
                </span>
              </div>
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1.5 text-xs">
            <div
              className={`flex items-center p-0.5 rounded-lg border text-[11px] ${
                isLight ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800'
              }`}
            >
              <button
                id="btn-3ph-view-dual"
                onClick={() => setViewMode3Ph('dual')}
                className={`px-2.5 py-1 rounded font-semibold transition flex items-center gap-1.5 ${
                  viewMode3Ph === 'dual'
                    ? isLight
                      ? 'bg-amber-500 text-white font-bold shadow-xs'
                      : 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Dual Synchronized View
              </button>
              <button
                id="btn-3ph-view-envelopes"
                onClick={() => setViewMode3Ph('envelopes')}
                className={`px-2.5 py-1 rounded font-semibold transition flex items-center gap-1.5 ${
                  viewMode3Ph === 'envelopes'
                    ? isLight
                      ? 'bg-amber-500 text-white font-bold shadow-xs'
                      : 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Phase Potentials & Envelopes
              </button>
              <button
                id="btn-3ph-view-rectified"
                onClick={() => setViewMode3Ph('rectified')}
                className={`px-2.5 py-1 rounded font-semibold transition flex items-center gap-1.5 ${
                  viewMode3Ph === 'rectified'
                    ? isLight
                      ? 'bg-amber-500 text-white font-bold shadow-xs'
                      : 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Rectified Output (v_o)
              </button>
            </div>
          </div>
        </div>

        {/* Informative Callout Banner Explaining the Envelope Theory */}
        <div
          className={`px-4 py-2 text-xs border-b flex items-center justify-between flex-wrap gap-2 ${
            isLight ? 'bg-amber-50/70 border-amber-200/80 text-amber-950' : 'bg-amber-950/20 border-amber-500/20 text-amber-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
              Textbook Principle
            </span>
            <span>
              The <strong>highlighted region between envelopes</strong> is the instantaneous load voltage:{' '}
              <span className="font-mono font-bold">v_o(ωt) = v_p(ωt) - v_n(ωt)</span>. The upper rail conducts the maximum phase, and the lower rail conducts the minimum phase.
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              V_dc = {calcResult.Vdc.toFixed(1)}V
            </span>
            <span>•</span>
            <span className="text-cyan-600 dark:text-cyan-400 font-bold">
              V_rms = {calcResult.Vrms.toFixed(1)}V
            </span>
          </div>
        </div>

        {/* SVG Container: Synchronized Dual or Single Canvas */}
        <div
          className={`relative w-full p-2 flex flex-col items-center gap-2 overflow-x-auto ${
            isLight ? 'bg-slate-50/60' : 'bg-slate-950'
          }`}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const svgX = ((e.clientX - rect.left) / rect.width) * width;
            setHoveredDeg(unscaleX(svgX));
          }}
          onMouseLeave={() => setHoveredDeg(null)}
        >
          {/* ================================================================= */}
          {/* TIER 1: THREE-PHASE VOLTAGES & CONDUCTING ENVELOPES */}
          {/* ================================================================= */}
          {(viewMode3Ph === 'dual' || viewMode3Ph === 'envelopes') && (
            <div className="w-full max-w-[880px] relative">
              <div className="absolute top-1.5 left-2 z-10 flex items-center gap-2 pointer-events-none">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shadow-xs ${
                    isLight ? 'bg-white/90 border-slate-200 text-slate-700' : 'bg-slate-900/90 border-slate-700 text-slate-300'
                  }`}
                >
                  Phase Potentials & Conducting Envelopes (v_a, v_b, v_c)
                </span>
              </div>

              <svg viewBox={`0 0 ${width} ${upperH}`} className="w-full select-none overflow-visible">
                <defs>
                  {/* Subtle Gradient for the Room between Envelopes */}
                  <linearGradient id="roomGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={isLight ? '0.28' : '0.38'} />
                    <stop offset="50%" stopColor="#f59e0b" stopOpacity={isLight ? '0.18' : '0.24'} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={isLight ? '0.25' : '0.35'} />
                  </linearGradient>

                  {/* Shaded Integration Hatch */}
                  <pattern id="hatch3Ph" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="8"
                      stroke={isLight ? '#0284c7' : '#38bdf8'}
                      strokeWidth="1.5"
                      strokeOpacity={isLight ? '0.18' : '0.28'}
                    />
                  </pattern>
                </defs>

                {/* Horizontal Reference Lines */}
                {[-1, -0.5, 0, 0.5, 1].map((frac, idx) => {
                  const y = scaleYPhase(frac * Vm);
                  return (
                    <g key={idx}>
                      <line
                        x1={padLeft}
                        y1={y}
                        x2={width - padRight}
                        y2={y}
                        stroke={
                          frac === 0
                            ? isLight
                              ? '#94a3b8'
                              : '#475569'
                            : isLight
                            ? '#e2e8f0'
                            : '#1e293b'
                        }
                        strokeWidth={frac === 0 ? 1.5 : 1}
                        strokeDasharray={frac === 0 ? undefined : '3,3'}
                      />
                      <text
                        x={padLeft - 8}
                        y={y + 3.5}
                        textAnchor="end"
                        fontSize="9.5"
                        fill={frac === 0 ? (isLight ? '#475569' : '#94a3b8') : isLight ? '#94a3b8' : '#475569'}
                        fontFamily="monospace"
                      >
                        {frac === 0 ? '0V' : `${(frac * Vm).toFixed(0)}V`}
                      </text>
                    </g>
                  );
                })}

                {/* Shaded Integration Period Interval on Phase Canvas */}
                {hatchW > 0 && (
                  <rect
                    x={hatchX1}
                    y={padTop}
                    width={hatchW}
                    height={upperPlotH}
                    fill="url(#hatch3Ph)"
                    className="pointer-events-none"
                  />
                )}

                {/* HIGHLIGHTED ROOM BETWEEN MAXIMUM AND MINIMUM CONDUCTING PHASES */}
                <path
                  id="path-conducting-room"
                  d={pathRoomD}
                  fill="url(#roomGrad)"
                  stroke={isLight ? 'rgba(245, 158, 11, 0.4)' : 'rgba(245, 158, 11, 0.6)'}
                  strokeWidth={1}
                />

                {/* The 3 Phase Input Sinusoids (thin dashed/solid background lines) */}
                {/* Phase A: Coral/Red */}
                <path
                  d={pathVaD}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  strokeDasharray="4,2"
                  opacity={isLight ? 0.45 : 0.45}
                />
                {/* Phase B: Gold/Amber */}
                <path
                  d={pathVbD}
                  fill="none"
                  stroke="#eab308"
                  strokeWidth={1.5}
                  strokeDasharray="4,2"
                  opacity={isLight ? 0.45 : 0.45}
                />
                {/* Phase C: Blue/Sky */}
                <path
                  d={pathVcD}
                  fill="none"
                  stroke="#0ea5e9"
                  strokeWidth={1.5}
                  strokeDasharray="4,2"
                  opacity={isLight ? 0.45 : 0.45}
                />

                {/* Upper Conducting Envelope vp (Thick glowing Amber curve) */}
                <path
                  id="path-conducting-vp"
                  d={pathVpD}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  filter={isLight ? 'drop-shadow(0 0 3px rgba(245, 158, 11, 0.4))' : 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.6))'}
                />

                {/* Lower Conducting Envelope vn (Thick glowing Indigo curve) */}
                <path
                  id="path-conducting-vn"
                  d={pathVnD}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth={3}
                  filter={isLight ? 'drop-shadow(0 0 3px rgba(99, 102, 241, 0.4))' : 'drop-shadow(0 0 6px rgba(99, 102, 241, 0.6))'}
                />

                {/* Caliper Indicator at Illustrative Angle (Showing Room = vo) */}
                <g transform={`translate(${caliperX}, 0)`}>
                  {/* Caliper Line */}
                  <line
                    x1={0}
                    y1={caliperYTop}
                    x2={0}
                    y2={caliperYBot}
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="3,2"
                  />
                  {/* Top Arrowhead / Cap */}
                  <circle cx={0} cy={caliperYTop} r={3.5} fill="#f59e0b" />
                  {/* Bottom Arrowhead / Cap */}
                  <circle cx={0} cy={caliperYBot} r={3.5} fill="#6366f1" />
                  {/* Caliper Badge */}
                  <g transform={`translate(10, ${(caliperYTop + caliperYBot) / 2 - 10})`}>
                    <rect
                      x={0}
                      y={0}
                      width={140}
                      height={20}
                      rx={4}
                      fill={isLight ? '#ffffff' : '#0f172a'}
                      stroke="#f59e0b"
                      strokeWidth={1.2}
                    />
                    <text
                      x={70}
                      y={13.5}
                      textAnchor="middle"
                      fontSize="9.5"
                      fontWeight="bold"
                      fill={isLight ? '#b45309' : '#fde68a'}
                      fontFamily="monospace"
                    >
                      Room: Δv = v_p - v_n = v_o
                    </text>
                  </g>
                </g>

                {/* Vertical Integration Interval Boundaries */}
                <line
                  x1={hatchX1}
                  y1={padTop}
                  x2={hatchX1}
                  y2={padTop + upperPlotH}
                  stroke={isLight ? '#0284c7' : '#38bdf8'}
                  strokeWidth={1.5}
                  strokeDasharray="3,2"
                />
                <line
                  x1={hatchX2}
                  y1={padTop}
                  x2={hatchX2}
                  y2={padTop + upperPlotH}
                  stroke={isLight ? '#0284c7' : '#38bdf8'}
                  strokeWidth={1.5}
                  strokeDasharray="3,2"
                />

                {/* Integration Boundary Badges */}
                <g transform={`translate(${hatchX1 - 24}, ${padTop - 22})`}>
                  <rect
                    x={0}
                    y={0}
                    width={48}
                    height={16}
                    rx={3}
                    fill={isLight ? '#e0f2fe' : '#0c4a6e'}
                    stroke={isLight ? '#0284c7' : '#38bdf8'}
                    strokeWidth={1}
                  />
                  <text
                    x={24}
                    y={11.5}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="bold"
                    fill={isLight ? '#0369a1' : '#bae6fd'}
                    fontFamily="monospace"
                  >
                    {integrationInterval.startLabel}
                  </text>
                </g>
                <g transform={`translate(${hatchX2 - 24}, ${padTop - 22})`}>
                  <rect
                    x={0}
                    y={0}
                    width={48}
                    height={16}
                    rx={3}
                    fill={isLight ? '#e0f2fe' : '#0c4a6e'}
                    stroke={isLight ? '#0284c7' : '#38bdf8'}
                    strokeWidth={1}
                  />
                  <text
                    x={24}
                    y={11.5}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="bold"
                    fill={isLight ? '#0369a1' : '#bae6fd'}
                    fontFamily="monospace"
                  >
                    {integrationInterval.endLabel}
                  </text>
                </g>

                {/* Angle Markers on X-Axis */}
                {[0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720].map((deg) => {
                  const x = scaleX(deg);
                  return (
                    <g key={deg}>
                      <line
                        x1={x}
                        y1={padTop + upperPlotH}
                        x2={x}
                        y2={padTop + upperPlotH + 5}
                        stroke={isLight ? '#cbd5e1' : '#334155'}
                        strokeWidth={1}
                      />
                      <text
                        x={x}
                        y={padTop + upperPlotH + 15}
                        textAnchor="middle"
                        fontSize="9"
                        fill={isLight ? '#64748b' : '#94a3b8'}
                        fontFamily="monospace"
                      >
                        {deg}°
                      </text>
                    </g>
                  );
                })}

                {/* Synchronized Cursor Line on Tier 1 */}
                {hoveredPoint && (
                  <g>
                    <line
                      x1={scaleX(hoveredPoint.deg)}
                      y1={padTop}
                      x2={scaleX(hoveredPoint.deg)}
                      y2={padTop + upperPlotH}
                      stroke={isLight ? '#0f172a' : '#ffffff'}
                      strokeWidth={1}
                      strokeDasharray="2,2"
                      opacity={0.8}
                    />
                    <circle
                      cx={scaleX(hoveredPoint.deg)}
                      cy={scaleYPhase((hoveredPoint as ThreePhasePoint).vp)}
                      r={4.5}
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                    <circle
                      cx={scaleX(hoveredPoint.deg)}
                      cy={scaleYPhase((hoveredPoint as ThreePhasePoint).vn)}
                      r={4.5}
                      fill="#6366f1"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  </g>
                )}
              </svg>
            </div>
          )}

          {/* ================================================================= */}
          {/* TIER 2: RECTIFIED OUTPUT VOLTAGE v_o(ωt) = v_p - v_n */}
          {/* ================================================================= */}
          {(viewMode3Ph === 'dual' || viewMode3Ph === 'rectified') && (
            <div className="w-full max-w-[880px] relative border-t pt-2 mt-1">
              <div className="absolute top-3 left-2 z-10 flex items-center gap-2 pointer-events-none">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shadow-xs ${
                    isLight ? 'bg-white/90 border-slate-200 text-amber-800' : 'bg-slate-900/90 border-slate-700 text-amber-300'
                  }`}
                >
                  Rectified DC Output Voltage: v_o(ωt) = v_p(ωt) - v_n(ωt)
                </span>
              </div>

              <svg viewBox={`0 0 ${width} ${lowerH}`} className="w-full select-none overflow-visible">
                {/* Horizontal Zero Line and Reference Grid */}
                <line
                  x1={padLeft}
                  y1={lowerZeroY}
                  x2={width - padRight}
                  y2={lowerZeroY}
                  stroke={isLight ? '#94a3b8' : '#475569'}
                  strokeWidth={1.5}
                />
                <text
                  x={padLeft - 8}
                  y={lowerZeroY + 3.5}
                  textAnchor="end"
                  fontSize="9.5"
                  fill={isLight ? '#475569' : '#94a3b8'}
                  fontFamily="monospace"
                >
                  0V
                </text>

                {/* Vm_LL scale marker */}
                <line
                  x1={padLeft}
                  y1={scaleYVo(Vm_LL)}
                  x2={width - padRight}
                  y2={scaleYVo(Vm_LL)}
                  stroke={isLight ? '#e2e8f0' : '#1e293b'}
                  strokeWidth={1}
                  strokeDasharray="3,3"
                />
                <text
                  x={padLeft - 8}
                  y={scaleYVo(Vm_LL) + 3.5}
                  textAnchor="end"
                  fontSize="9"
                  fill={isLight ? '#94a3b8' : '#475569'}
                  fontFamily="monospace"
                >
                  {Vm_LL.toFixed(0)}V
                </text>

                {/* Shaded Integration Hatch across Output Pulse [30°+α, 90°+α] */}
                {hatchW > 0 && (
                  <rect
                    x={hatchX1}
                    y={padTop}
                    width={hatchW}
                    height={lowerPlotH}
                    fill="url(#hatch3Ph)"
                    className="pointer-events-none"
                  />
                )}

                {/* Overhead Integration Bracket on Output Plot */}
                {hatchW > 0 && (
                  <g transform={`translate(${hatchX1}, ${padTop - 8})`}>
                    <line x1={0} y1={0} x2={hatchW} y2={0} stroke="#0284c7" strokeWidth={1.75} />
                    <line x1={0} y1={-3} x2={0} y2={3} stroke="#0284c7" strokeWidth={1.75} />
                    <line x1={hatchW} y1={-3} x2={hatchW} y2={3} stroke="#0284c7" strokeWidth={1.75} />
                    <text
                      x={hatchW / 2}
                      y={-6}
                      textAnchor="middle"
                      fontSize="9"
                      fontWeight="bold"
                      fill={isLight ? '#0369a1' : '#38bdf8'}
                      fontFamily="monospace"
                    >
                      Integration Period {integrationInterval.label}
                    </text>
                  </g>
                )}

                {/* Rectified DC Output Waveform vo */}
                <path
                  d={pathVoD}
                  fill="none"
                  stroke={isLight ? '#d97706' : '#f59e0b'}
                  strokeWidth={2.75}
                  filter={isLight ? 'drop-shadow(0 0 3px rgba(217, 119, 6, 0.4))' : 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.5))'}
                />

                {/* Average Voltage V_dc Horizontal Reference Line */}
                <line
                  x1={padLeft}
                  y1={vdcY}
                  x2={width - padRight}
                  y2={vdcY}
                  stroke={isLight ? '#2563eb' : '#3b82f6'}
                  strokeWidth={1.75}
                  strokeDasharray="6,3"
                />
                <g transform={`translate(${width - padRight - 76}, ${vdcY - 9})`}>
                  <rect
                    x={0}
                    y={0}
                    width={76}
                    height={18}
                    rx={4}
                    fill={isLight ? '#ecfdf5' : '#064e3b'}
                    stroke={isLight ? '#3b82f6' : '#3b82f6'}
                    strokeWidth={1}
                  />
                  <text
                    x={38}
                    y={12}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="bold"
                    fill={isLight ? '#1d4ed8' : '#93c5fd'}
                    fontFamily="monospace"
                  >
                    V_dc = {calcResult.Vdc.toFixed(1)}V
                  </text>
                </g>

                {/* RMS Voltage V_rms Horizontal Reference Line */}
                <line
                  x1={padLeft}
                  y1={vrmsY}
                  x2={width - padRight}
                  y2={vrmsY}
                  stroke={isLight ? '#0891b2' : '#06b6d4'}
                  strokeWidth={1.5}
                  strokeDasharray="4,4"
                />
                <g transform={`translate(${padLeft + 10}, ${vrmsY - 9})`}>
                  <rect
                    x={0}
                    y={0}
                    width={84}
                    height={18}
                    rx={4}
                    fill={isLight ? '#ecfeff' : '#083344'}
                    stroke={isLight ? '#06b6d4' : '#06b6d4'}
                    strokeWidth={1}
                  />
                  <text
                    x={42}
                    y={12}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="bold"
                    fill={isLight ? '#0e7490' : '#67e8f9'}
                    fontFamily="monospace"
                  >
                    V_rms = {calcResult.Vrms.toFixed(1)}V
                  </text>
                </g>

                {/* Angle Markers on Bottom Axis */}
                {[0, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720].map((deg) => {
                  const x = scaleX(deg);
                  return (
                    <g key={deg}>
                      <line
                        x1={x}
                        y1={lowerZeroY}
                        x2={x}
                        y2={lowerZeroY + 5}
                        stroke={isLight ? '#cbd5e1' : '#334155'}
                        strokeWidth={1}
                      />
                      <text
                        x={x}
                        y={lowerZeroY + 16}
                        textAnchor="middle"
                        fontSize="9.5"
                        fill={isLight ? '#64748b' : '#94a3b8'}
                        fontFamily="monospace"
                      >
                        {deg === 0 ? '0' : deg === 360 ? '2π' : deg === 720 ? '4π' : `${deg}°`}
                      </text>
                    </g>
                  );
                })}

                {/* Synchronized Cursor Line on Tier 2 */}
                {hoveredPoint && (
                  <g>
                    <line
                      x1={scaleX(hoveredPoint.deg)}
                      y1={padTop}
                      x2={scaleX(hoveredPoint.deg)}
                      y2={lowerZeroY}
                      stroke={isLight ? '#0f172a' : '#ffffff'}
                      strokeWidth={1}
                      strokeDasharray="2,2"
                      opacity={0.8}
                    />
                    <circle
                      cx={scaleX(hoveredPoint.deg)}
                      cy={scaleYVo(hoveredPoint.vo)}
                      r={5}
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  </g>
                )}
              </svg>
            </div>
          )}
        </div>

        {/* Footer with Color Legend and Live Cursor Inspection Data */}
        <div
          className={`flex flex-wrap items-center justify-between px-4 py-2.5 border-t text-xs gap-3 ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900/90 border-slate-800 text-slate-300'
          }`}
        >
          {/* Legend Items */}
          <div className="flex flex-wrap items-center gap-3.5">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-3.5 h-1 rounded-sm bg-amber-500"></span>
              v_p (Max Phase)
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-3.5 h-1 rounded-sm bg-indigo-500"></span>
              v_n (Min Phase)
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-3 h-3 rounded-xs bg-amber-400/30 border border-amber-500"></span>
              Room between (v_o)
            </span>
            <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>v_a
              <span className="w-2 h-2 rounded-full bg-yellow-500 ml-1"></span>v_b
              <span className="w-2 h-2 rounded-full bg-sky-500 ml-1"></span>v_c
            </span>
            <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
              <span className="w-3.5 h-0.5 rounded-sm bg-emerald-500"></span>
              V_dc
            </span>
            <span className="flex items-center gap-1.5 font-medium text-cyan-700 dark:text-cyan-400">
              <span className="w-3.5 h-0.5 rounded-sm bg-cyan-500"></span>
              V_rms
            </span>
          </div>

          {/* Real-time Cursor Readout */}
          {hoveredPoint && (
            <div
              className={`flex items-center gap-2.5 font-mono text-[11px] px-3 py-1 rounded border ${
                isLight
                  ? 'bg-white border-slate-200 text-slate-800 shadow-xs'
                  : 'bg-slate-950 border-slate-800 text-slate-200'
              }`}
            >
              <span>
                ωt: <strong className="text-amber-600 dark:text-amber-400">{hoveredPoint.deg}°</strong>
              </span>
              <span>
                Top ({((hoveredPoint as ThreePhasePoint).phaseP)}):{' '}
                <strong className="text-amber-600 dark:text-amber-400">
                  {(hoveredPoint as ThreePhasePoint).vp.toFixed(1)}V
                </strong>
              </span>
              <span>
                Bot ({((hoveredPoint as ThreePhasePoint).phaseN)}):{' '}
                <strong className="text-indigo-600 dark:text-indigo-400">
                  {(hoveredPoint as ThreePhasePoint).vn.toFixed(1)}V
                </strong>
              </span>
              <span className="border-l pl-2">
                v_o: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{hoveredPoint.vo.toFixed(1)}V</strong>
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER SINGLE-PHASE WAVEFORM VISUALIZER
  // ---------------------------------------------------------------------------
  const singleHeight = 360;
  const singleZeroY = padTop + (singleHeight - padTop - padBottom) * 0.55;
  const scaleYSingle = (v: number) => singleZeroY - (v / (Vm * 1.35)) * ((singleHeight - padTop - padBottom) * 0.45);

  let pathVsD = '';
  let pathVoSingleD = '';
  if (singlePhaseData) {
    singlePhaseData.forEach((pt, idx) => {
      const x = scaleX(pt.deg);
      const yVs = scaleYSingle(pt.vs);
      const yVo = scaleYSingle(pt.vo);
      if (idx === 0) {
        pathVsD += `M ${x.toFixed(1)} ${yVs.toFixed(1)}`;
        pathVoSingleD += `M ${x.toFixed(1)} ${yVo.toFixed(1)}`;
      } else {
        pathVsD += ` L ${x.toFixed(1)} ${yVs.toFixed(1)}`;
        pathVoSingleD += ` L ${x.toFixed(1)} ${yVo.toFixed(1)}`;
      }
    });
  }

  const hatchX1_1Ph = scaleX(integrationInterval.startDeg);
  const hatchX2_1Ph = scaleX(integrationInterval.endDeg);
  const hatchW_1Ph = Math.max(0, hatchX2_1Ph - hatchX1_1Ph);
  const vdcYSingle = scaleYSingle(calcResult.Vdc);
  const vrmsYSingle = scaleYSingle(calcResult.Vrms);

  return (
    <div
      id="annotated-1phase-waveform-card"
      className={`flex flex-col border rounded-xl overflow-hidden shadow-xl transition-colors duration-200 ${
        isLight ? 'bg-white border-slate-200 shadow-slate-200/50' : 'bg-slate-950 border-slate-800'
      }`}
    >
      {/* Top Banner with Quick Metrics */}
      <div
        className={`flex flex-wrap items-center justify-between px-4 py-2.5 border-b gap-2 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/90 border-slate-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
          <span className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
            Annotated Output Voltage: <span className="font-mono text-amber-600 dark:text-amber-400">v_o(ωt)</span>
          </span>
          <span
            className={`text-[11px] px-2 py-0.5 rounded font-mono ${
              isLight ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
            }`}
          >
            {integrationInterval.label}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border ${
              isLight
                ? 'bg-amber-50 text-amber-800 border-amber-200 font-semibold'
                : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
            }`}
          >
            <span className="font-bold">V_dc:</span>
            <span>{calcResult.Vdc.toFixed(1)} V</span>
          </div>
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border ${
              isLight
                ? 'bg-cyan-50 text-cyan-800 border-cyan-200 font-semibold'
                : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300'
            }`}
          >
            <span className="font-bold">V_rms:</span>
            <span>{calcResult.Vrms.toFixed(1)} V</span>
          </div>
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border ${
              isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>Form Factor (FF):</span>
            <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{calcResult.formFactor.toFixed(3)}</span>
          </div>
        </div>
      </div>

      {/* Main Single Phase Canvas */}
      <div
        className={`relative w-full overflow-x-auto p-2 flex justify-center ${isLight ? 'bg-slate-50/50' : 'bg-slate-950'}`}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const svgX = ((e.clientX - rect.left) / rect.width) * width;
          setHoveredDeg(unscaleX(svgX));
        }}
        onMouseLeave={() => setHoveredDeg(null)}
      >
        <svg viewBox={`0 0 ${width} 360`} className="w-full max-w-[880px] select-none">
          <defs>
            <pattern id="hatch1Ph" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="8"
                stroke={isLight ? '#0284c7' : '#38bdf8'}
                strokeWidth="1.5"
                strokeOpacity={isLight ? '0.15' : '0.2'}
              />
            </pattern>
          </defs>

          {/* Grid Lines */}
          {[-1, -0.5, 0, 0.5, 1].map((frac, idx) => {
            const y = scaleYSingle(frac * Vm);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke={frac === 0 ? (isLight ? '#94a3b8' : '#475569') : isLight ? '#e2e8f0' : '#1e293b'}
                  strokeWidth={frac === 0 ? 1.5 : 1}
                  strokeDasharray={frac === 0 ? undefined : '3,3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize="9.5"
                  fill={frac === 0 ? (isLight ? '#475569' : '#94a3b8') : isLight ? '#94a3b8' : '#475569'}
                  fontFamily="monospace"
                >
                  {frac === 0 ? '0V' : `${(frac * Vm).toFixed(0)}V`}
                </text>
              </g>
            );
          })}

          {/* Shaded Integration Bracket Interval */}
          {hatchW_1Ph > 0 && (
            <rect
              x={hatchX1_1Ph}
              y={padTop}
              width={hatchW_1Ph}
              height={360 - padTop - padBottom}
              fill="url(#hatch1Ph)"
              className="pointer-events-none"
            />
          )}

          {/* Source Voltage vs */}
          <path
            d={pathVsD}
            fill="none"
            stroke={isLight ? '#0284c7' : '#38bdf8'}
            strokeWidth={1.5}
            strokeDasharray="4,4"
            opacity={isLight ? 0.35 : 0.4}
          />

          {/* Rectified Output Vo */}
          <path
            d={pathVoSingleD}
            fill="none"
            stroke={isLight ? '#d97706' : '#f59e0b'}
            strokeWidth={2.75}
            filter={isLight ? 'drop-shadow(0 0 3px rgba(217, 119, 6, 0.4))' : 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.5))'}
          />

          {/* Average Voltage Line */}
          <line
            x1={padLeft}
            y1={vdcYSingle}
            x2={width - padRight}
            y2={vdcYSingle}
            stroke={isLight ? '#2563eb' : '#3b82f6'}
            strokeWidth={1.75}
            strokeDasharray="6,3"
          />
          <g transform={`translate(${width - padRight - 68}, ${vdcYSingle - 9})`}>
            <rect
              x={0}
              y={0}
              width={68}
              height={18}
              rx={4}
              fill={isLight ? '#ecfdf5' : '#064e3b'}
              stroke="#3b82f6"
              strokeWidth={1}
            />
            <text
              x={34}
              y={12}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="bold"
              fill={isLight ? '#1d4ed8' : '#93c5fd'}
              fontFamily="monospace"
            >
              V_dc = {calcResult.Vdc.toFixed(1)}V
            </text>
          </g>

          {/* RMS Line */}
          <line
            x1={padLeft}
            y1={vrmsYSingle}
            x2={width - padRight}
            y2={vrmsYSingle}
            stroke={isLight ? '#0891b2' : '#06b6d4'}
            strokeWidth={1.5}
            strokeDasharray="4,4"
          />
          <g transform={`translate(${padLeft + 10}, ${vrmsYSingle - 9})`}>
            <rect
              x={0}
              y={0}
              width={76}
              height={18}
              rx={4}
              fill={isLight ? '#ecfeff' : '#083344'}
              stroke="#06b6d4"
              strokeWidth={1}
            />
            <text
              x={38}
              y={12}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="bold"
              fill={isLight ? '#0e7490' : '#67e8f9'}
              fontFamily="monospace"
            >
              V_rms = {calcResult.Vrms.toFixed(1)}V
            </text>
          </g>

          {/* Markers */}
          {[0, 90, 180, 270, 360, 450, 540, 630, 720].map((deg) => {
            const x = scaleX(deg);
            return (
              <g key={deg}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={360 - padBottom}
                  stroke={isLight ? '#cbd5e1' : '#334155'}
                  strokeWidth={1}
                  strokeDasharray="2,2"
                />
                <text
                  x={x}
                  y={360 - padBottom + 16}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill={isLight ? '#64748b' : '#94a3b8'}
                  fontFamily="monospace"
                >
                  {deg}°
                </text>
              </g>
            );
          })}

          {/* Alpha Marker */}
          {alphaDeg > 0 && (
            <g transform={`translate(${scaleX(alphaDeg)}, ${padTop})`}>
              <line x1={0} y1={0} x2={0} y2={360 - padTop - padBottom} stroke="#d97706" strokeWidth={1.75} strokeDasharray="3,3" />
              <g transform="translate(-16, 360 - padTop - padBottom + 4)">
                <rect x={0} y={0} width={32} height={18} rx={4} fill={isLight ? '#fef3c7' : '#78350f'} stroke="#d97706" strokeWidth={1} />
                <text x={16} y={12} textAnchor="middle" fontSize="10" fontWeight="bold" fill={isLight ? '#92400e' : '#fde68a'} fontFamily="monospace">
                  α={alphaDeg}°
                </text>
              </g>
            </g>
          )}

          {/* Hover Indicator */}
          {hoveredPoint && (
            <g>
              <line
                x1={scaleX(hoveredPoint.deg)}
                y1={padTop}
                x2={scaleX(hoveredPoint.deg)}
                y2={360 - padBottom}
                stroke={isLight ? '#0284c7' : '#ffffff'}
                strokeWidth={1}
                strokeDasharray="2,2"
              />
              <circle
                cx={scaleX(hoveredPoint.deg)}
                cy={scaleYSingle(hoveredPoint.vo)}
                r={5}
                fill="#f59e0b"
                stroke="#ffffff"
                strokeWidth={1.5}
              />
            </g>
          )}
        </svg>
      </div>

      {/* Legend & Hover Info */}
      <div
        className={`flex flex-wrap items-center justify-between px-4 py-2.5 border-t text-xs gap-3 ${
          isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900/90 border-slate-800 text-slate-300'
        }`}
      >
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-3.5 h-1 rounded-sm bg-amber-500"></span>
            v_o(ωt) Output Voltage
          </span>
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="w-3.5 h-0.5 rounded-sm bg-sky-500"></span>
            v_s(ωt) AC Input
          </span>
          <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
            <span className="w-3.5 h-0.5 rounded-sm bg-emerald-500"></span>
            V_dc
          </span>
          <span className="flex items-center gap-1.5 font-medium text-cyan-700 dark:text-cyan-400">
            <span className="w-3.5 h-0.5 rounded-sm bg-cyan-500"></span>
            V_rms
          </span>
        </div>

        {hoveredPoint && (
          <div
            className={`flex items-center gap-3 font-mono text-[11px] px-3 py-1 rounded border ${
              isLight ? 'bg-white border-slate-200 text-slate-800 shadow-xs' : 'bg-slate-950 border-slate-800 text-slate-200'
            }`}
          >
            <span>
              ωt: <strong className="text-amber-600 dark:text-amber-400">{hoveredPoint.deg}°</strong>
            </span>
            <span>
              v_o: <strong className="text-amber-600 dark:text-amber-400">{hoveredPoint.vo.toFixed(1)} V</strong>
            </span>
            {!is3Ph && 'vs' in hoveredPoint && (
              <span>
                v_s: <strong className="text-sky-600 dark:text-sky-400">{(hoveredPoint as { vs: number }).vs.toFixed(1)} V</strong>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
