
import React, { useState } from 'react';
import { 
  Brain, Sparkles, Loader2, Zap, ArrowUpCircle, ArrowDownCircle, 
  MinusCircle, HelpCircle, CheckCircle2, ShieldAlert, Target, Info,
  AlertTriangle, Users, BarChart3, GraduationCap, ChevronRight,
  TrendingUp, Activity, PieChart, Search, TrendingDown, DollarSign,
  Briefcase
} from 'lucide-react';
import { Asset, User, AssetFundamentals, PriceSnapshot, Position, Broker, LegendaryInvestor } from '../types';
import { 
  getAIRecommendations, 
  AIRecommendationResponse, 
  getLegendaryComparison, 
  InvestorComparisonResponse,
  getBuffettAnalysis,
  BuffettAnalysisResponse
} from '../services/geminiService';
import { TOP_10_INVESTORS } from '../constants';

interface AiRecommendationsProps {
  assets: Asset[];
  positions: Position[];
  brokers: Broker[];
  user: User;
  fundamentals: AssetFundamentals[];
  snapshots: PriceSnapshot[];
}

type TabType = 'recommendations' | 'comparison' | 'buffett';

export const AiRecommendations: React.FC<AiRecommendationsProps> = ({
  assets, positions, brokers, user, fundamentals, snapshots
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('recommendations');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AIRecommendationResponse | null>(null);
  const [comparisonResult, setComparisonResult] = useState<InvestorComparisonResponse | null>(null);
  const [buffettResult, setBuffettResult] = useState<BuffettAnalysisResponse | null>(null);
  const [language, setLanguage] = useState<'es' | 'en'>('es');
  const [selectedInvestorIds, setSelectedInvestorIds] = useState<string[]>([]);
  const [selectedForPortfolio, setSelectedForPortfolio] = useState<string | null>(null);
  const [buffettSymbol, setBuffettSymbol] = useState<string>('');

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const analysis = await getAIRecommendations(
        assets, 
        positions, 
        brokers, 
        user.riskProfile, 
        fundamentals, 
        snapshots,
        language
      );
      setResult(analysis);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runComparison = async () => {
    if (selectedInvestorIds.length !== 3) return;
    setIsAnalyzing(true);
    try {
      const selectedInvestors = TOP_10_INVESTORS.filter(inv => selectedInvestorIds.includes(inv.id));
      const comparison = await getLegendaryComparison(
        assets,
        positions,
        brokers,
        selectedInvestors,
        language
      );
      setComparisonResult(comparison);
      // Default selected for portfolio to the matching one or the first one
      setSelectedForPortfolio(comparison.matching_investor_id || selectedInvestorIds[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runBuffettAnalysis = async () => {
    if (!buffettSymbol) return;
    setIsAnalyzing(true);
    try {
      const asset = assets.find(a => a.symbol.toUpperCase() === buffettSymbol.toUpperCase());
      const fund = fundamentals.find(f => f.assetId === asset?.id);
      const assetSnaps = snapshots.filter(s => s.assetId === asset?.id);
      
      const analysis = await getBuffettAnalysis(
        buffettSymbol,
        asset,
        fund,
        assetSnaps,
        language
      );
      setBuffettResult(analysis);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleInvestor = (id: string) => {
    setSelectedInvestorIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : prev.length < 3 ? [...prev, id] : prev
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Brain className="text-indigo-600" size={40} />
            Asesoría con IA
          </h1>
          <p className="text-slate-500 mt-2 text-lg">
            Análisis profundo y comparativas legendarias con Gemini 3.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Tab Selector */}
          <div className="bg-white p-1 rounded-2xl border flex items-center shadow-sm">
            <button 
              onClick={() => setActiveTab('recommendations')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 ${activeTab === 'recommendations' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Sparkles size={14} />
              {language === 'es' ? 'RECOMENDACIONES' : 'RECOMMENDATIONS'}
            </button>
            <button 
              onClick={() => setActiveTab('comparison')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 ${activeTab === 'comparison' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Users size={14} />
              {language === 'es' ? 'COMPARATIVA LEYENDAS' : 'LEGEND COMPARISON'}
            </button>
            <button 
              onClick={() => setActiveTab('buffett')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 ${activeTab === 'buffett' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Target size={14} />
              {language === 'es' ? 'ANÁLISIS BUFFETT' : 'BUFFETT ANALYSIS'}
            </button>
          </div>

          {/* Language Selector */}
          <div className="bg-white p-1 rounded-2xl border flex items-center shadow-sm">
            <button 
              onClick={() => setLanguage('es')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${language === 'es' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              ESP
            </button>
            <button 
              onClick={() => setLanguage('en')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${language === 'en' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              ENG
            </button>
          </div>
        </div>
      </header>

      {activeTab === 'recommendations' ? (
        <>
          {/* Action Button */}
          <div className="flex justify-center">
            <button 
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-5 rounded-[2.5rem] font-black flex items-center gap-3 transition-all shadow-2xl shadow-indigo-200 active:scale-95 disabled:opacity-50"
            >
              {isAnalyzing ? <Loader2 className="animate-spin" size={24} /> : <Sparkles size={24} />}
              {isAnalyzing ? (language === 'es' ? 'Analizando...' : 'Analyzing...') : (language === 'es' ? 'Generar Recomendaciones Tácticas' : 'Get Tactical Recommendations')}
            </button>
          </div>

          {/* Disclaimer Section */}
          <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2rem] flex flex-col md:flex-row items-center gap-6 shadow-sm">
            <div className="bg-white p-4 rounded-2xl text-amber-600 shadow-sm border border-amber-100 shrink-0">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-amber-900 font-black text-sm uppercase tracking-wider">
                {language === 'es' ? 'Aviso de Responsabilidad' : 'Disclaimer'}
              </h3>
              <p className="text-amber-800 text-sm font-medium leading-relaxed">
                {language === 'es' 
                  ? 'Las recomendaciones generadas por la IA son únicamente sugerencias basadas en datos algorítmicos y no constituyen asesoramiento financiero profesional. El usuario es el único responsable de sus decisiones.'
                  : 'AI-generated recommendations are suggestions based on algorithmic data and do not constitute professional financial advice. The user is solely responsible for their investment decisions.'}
              </p>
            </div>
          </div>

          {!result && !isAnalyzing && (
            <div className="py-24 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mb-6">
                <Brain size={40} />
              </div>
              <h3 className="text-xl font-bold text-slate-400 mb-2">
                {language === 'es' ? '¿Listo para optimizar tu cartera?' : 'Ready to optimize your portfolio?'}
              </h3>
              <p className="text-slate-400 max-w-md mx-auto italic">
                {language === 'es' 
                  ? 'Pulsa el botón superior para enviar tu composición actual a Gemini 3 y recibir consejos tácticos personalizados.'
                  : 'Press the button above to send your current composition to Gemini 3 and receive personalized tactical advice.'}
              </p>
            </div>
          )}

          {isAnalyzing && (
            <div className="py-24 text-center space-y-6">
              <div className="inline-block relative">
                <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <Brain className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">
                  {language === 'es' ? 'Procesando Estrategia' : 'Processing Strategy'}
                </h3>
                <p className="text-slate-400 text-sm animate-pulse">
                  {language === 'es' ? 'Consultando modelos financieros avanzados...' : 'Consulting advanced financial models...'}
                </p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-500">
              {/* Summary Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 bg-indigo-600 text-white p-8 rounded-[3rem] shadow-xl shadow-indigo-100 relative overflow-hidden group">
                  <Zap className="absolute -right-4 -top-4 w-32 h-32 text-white/10 group-hover:scale-110 transition-transform duration-700" />
                  <div className="relative z-10">
                    <p className="text-indigo-200 text-[10px] font-black uppercase tracking-[0.2em] mb-2">
                      {language === 'es' ? 'Diagnóstico Global' : 'Global Diagnosis'}
                    </p>
                    <h2 className="text-3xl font-black mb-6 uppercase tracking-tight">{result.portfolio_summary.risk_level}</h2>
                    
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <ShieldAlert size={20} className="text-indigo-300" />
                        <span className="text-sm font-bold text-indigo-50">
                          {language === 'es' ? 'Principales Drivers' : 'Key Drivers'}
                        </span>
                      </div>
                      <ul className="space-y-2">
                        {result.portfolio_summary.main_drivers.map((d, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs font-medium bg-white/10 p-2 rounded-xl border border-white/10">
                            <CheckCircle2 size={14} className="mt-0.5 text-indigo-300 shrink-0" />
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border shadow-sm">
                  <h3 className="font-black text-slate-800 text-lg uppercase tracking-wider mb-6 flex items-center gap-3">
                    <Target className="text-indigo-600" />
                    {language === 'es' ? 'Estrategia de Liquidez' : 'Cash Strategy'}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {result.portfolio_summary.cash_recommendation.map((rec, i) => (
                      <div key={i} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                          <Zap size={20} />
                        </div>
                        <p className="text-sm font-bold text-slate-600 leading-relaxed">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Asset Recommendations Grid */}
              <div className="space-y-6">
                <h3 className="font-black text-slate-800 text-xl uppercase tracking-wider px-2">
                  {language === 'es' ? 'Acciones por Activo' : 'Asset Actions'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {result.assets.map((rec, i) => (
                    <div key={i} className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden flex flex-col group hover:shadow-lg transition-all border-b-4 hover:border-b-indigo-500">
                      <div className="p-6 border-b bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-slate-800 shadow-sm border text-xs">
                            {rec.symbol.slice(0, 2)}
                          </div>
                          <h4 className="font-black text-slate-900">{rec.symbol}</h4>
                        </div>
                        <ActionBadge action={rec.action} language={language} />
                      </div>

                      <div className="p-6 flex-1 space-y-6">
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              {language === 'es' ? 'Confianza IA' : 'AI Confidence'}
                            </p>
                            <span className="text-[10px] font-black text-indigo-600">{(rec.confidence * 100).toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${rec.confidence * 100}%` }} />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Zap size={10} className="text-indigo-500" /> {language === 'es' ? 'Motivos' : 'Reasons'}
                          </p>
                          <ul className="space-y-1.5">
                            {rec.reasons.map((r, ri) => (
                              <li key={ri} className="text-xs font-bold text-slate-600 flex items-center gap-2">
                                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <ShieldAlert size={10} className="text-rose-500" /> {language === 'es' ? 'Riesgos' : 'Risks'}
                          </p>
                          <ul className="space-y-1.5">
                            {rec.risks.map((r, ri) => (
                              <li key={ri} className="text-xs font-medium text-slate-500 italic flex items-center gap-2">
                                <span className="w-1 h-1 bg-rose-200 rounded-full" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="p-6 bg-indigo-50/50 border-t space-y-3">
                         <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                           {language === 'es' ? 'Siguientes Pasos' : 'Next Steps'}
                         </p>
                         <div className="space-y-2">
                            {rec.next_steps.map((step, si) => (
                              <div key={si} className="flex items-center gap-2 text-[11px] font-bold text-indigo-600">
                                 <CheckCircle2 size={12} />
                                 {step}
                              </div>
                            ))}
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Questions */}
              {result.questions.length > 0 && (
                <div className="bg-slate-900 text-white p-10 rounded-[3.5rem] shadow-2xl">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-indigo-500 rounded-2xl">
                      <HelpCircle size={28} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black tracking-tight">
                        {language === 'es' ? 'Preguntas para Reflexionar' : 'Questions to Consider'}
                      </h3>
                      <p className="text-slate-400 font-medium">
                        {language === 'es' ? 'Gemini sugiere considerar estos puntos estratégicos.' : 'Gemini suggests considering these strategic points.'}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {result.questions.map((q, i) => (
                      <div key={i} className="p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-colors">
                        <p className="text-sm font-medium leading-relaxed italic">"{q}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-12">
          {/* Investor Selection */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  {language === 'es' ? 'Selecciona 3 Leyendas' : 'Select 3 Legends'}
                </h3>
                <p className="text-slate-500 font-medium">
                  {language === 'es' ? `Has seleccionado ${selectedInvestorIds.length} de 3` : `Selected ${selectedInvestorIds.length} of 3`}
                </p>
              </div>
              <button 
                onClick={runComparison}
                disabled={isAnalyzing || selectedInvestorIds.length !== 3}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-3xl font-black flex items-center gap-3 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 disabled:scale-100 active:scale-95"
              >
                {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <Users size={20} />}
                {language === 'es' ? 'Comparar Cartera' : 'Compare Portfolio'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {TOP_10_INVESTORS.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => toggleInvestor(inv.id)}
                  className={`p-6 rounded-[2rem] border-2 transition-all text-left flex flex-col gap-3 group relative overflow-hidden ${
                    selectedInvestorIds.includes(inv.id) 
                      ? 'border-indigo-600 bg-indigo-50 shadow-lg shadow-indigo-100' 
                      : 'border-slate-100 bg-white hover:border-indigo-200'
                  }`}
                >
                  {selectedInvestorIds.includes(inv.id) && (
                    <div className="absolute top-4 right-4 text-indigo-600">
                      <CheckCircle2 size={20} />
                    </div>
                  )}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
                    selectedInvestorIds.includes(inv.id) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                  }`}>
                    {inv.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 leading-tight">{inv.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{inv.style}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {isAnalyzing && (
            <div className="py-24 text-center space-y-6">
              <div className="inline-block relative">
                <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <Users className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">
                  {language === 'es' ? 'Analizando Estilos de Inversión' : 'Analyzing Investment Styles'}
                </h3>
                <p className="text-slate-400 text-sm animate-pulse">
                  {language === 'es' ? 'Comparando métricas con los más grandes de la historia...' : 'Comparing metrics with history\'s greatest...'}
                </p>
              </div>
            </div>
          )}

          {comparisonResult && (
            <div className="space-y-12 animate-in slide-in-from-bottom-8 duration-700">
              {/* Similarity Analysis & Application Context for selected legend */}
              {(() => {
                const currentAnalysis = comparisonResult.individual_analyses.find(a => a.investor_id === selectedForPortfolio);
                if (!currentAnalysis) return null;
                const investor = TOP_10_INVESTORS.find(i => i.id === selectedForPortfolio);

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 bg-slate-900 text-white p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
                      <div className="absolute -right-10 -bottom-10 opacity-10">
                        <TrendingUp size={240} />
                      </div>
                      <div className="relative z-10 space-y-8">
                        <div>
                          <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">
                            {language === 'es' ? 'Afinidad de Estilo' : 'Style Affinity'}
                          </p>
                          <div className="flex items-end gap-2">
                            <span className="text-7xl font-black leading-none">{(currentAnalysis.similarity_score * 100).toFixed(0)}</span>
                            <span className="text-3xl font-black text-indigo-400 mb-2">%</span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center gap-3 text-indigo-400">
                            <Users size={20} />
                            <span className="text-sm font-black uppercase tracking-wider">
                              {language === 'es' ? 'Análisis de Estilo' : 'Style Analysis'}
                            </span>
                          </div>
                          <h3 className="text-3xl font-black tracking-tight">
                            {investor?.name || 'Desconocido'}
                          </h3>
                          <p className="text-slate-400 text-sm font-medium leading-relaxed italic">
                            {currentAnalysis.style_analysis}
                          </p>
                          {comparisonResult.matching_investor_id === selectedForPortfolio && (
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                              <CheckCircle2 size={12} />
                              {language === 'es' ? 'MAYOR AFINIDAD' : 'BEST MATCH'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-2 bg-white p-10 rounded-[3.5rem] border shadow-sm space-y-8">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                          <GraduationCap size={28} />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                            {language === 'es' ? 'Cómo aplicar este estilo' : 'How to apply this style'}
                          </h3>
                          <p className="text-slate-500 font-medium">
                            {language === 'es' ? 'Consejos prácticos para tu contexto actual.' : 'Practical advice for your current context.'}
                          </p>
                        </div>
                      </div>
                      <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                        <p className="text-slate-700 font-bold leading-relaxed text-lg">
                          {currentAnalysis.application_context}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Deep Comparison Table */}
              <section className="space-y-6">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3 px-2">
                  <BarChart3 className="text-indigo-600" />
                  {language === 'es' ? 'Tabla Comparativa Profunda' : 'Deep Comparison Table'}
                </h3>
                <div className="bg-white rounded-[3rem] border shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b">
                          <th className="p-8">{language === 'es' ? 'Métrica' : 'Metric'}</th>
                          <th className="p-8 text-indigo-600 bg-indigo-50/50">{language === 'es' ? 'Tu Cartera' : 'Your Portfolio'}</th>
                          {selectedInvestorIds.map((id, idx) => (
                            <th key={id} className="p-8">
                              {TOP_10_INVESTORS.find(inv => inv.id === id)?.name || `Inversor ${idx + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {comparisonResult.comparison_table.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-8 font-black text-slate-900 text-sm">{row.metric}</td>
                            <td className="p-8 font-bold text-indigo-600 bg-indigo-50/30 text-sm">{row.user_portfolio}</td>
                            <td className="p-8 text-slate-600 text-sm font-medium">{row.investor_1}</td>
                            <td className="p-8 text-slate-600 text-sm font-medium">{row.investor_2}</td>
                            <td className="p-8 text-slate-600 text-sm font-medium">{row.investor_3}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* Educational Portfolio Section */}
              <section className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                      <GraduationCap className="text-indigo-600" />
                      {language === 'es' ? 'Portafolio Educativo Inspirado' : 'Inspired Educational Portfolio'}
                    </h3>
                    <p className="text-slate-500 font-medium mt-1">
                      {language === 'es' ? 'Ejemplo de composición basado en una leyenda (Solo fines educativos).' : 'Sample composition based on a legend (Educational purposes only).'}
                    </p>
                  </div>
                  
                  <div className="flex bg-white p-1 rounded-2xl border shadow-sm">
                    {selectedInvestorIds.map(id => (
                      <button
                        key={id}
                        onClick={() => setSelectedForPortfolio(id)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${
                          selectedForPortfolio === id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {TOP_10_INVESTORS.find(inv => inv.id === id)?.name.split(' ')[1] || 'Inversor'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-[3rem] border shadow-sm space-y-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-lg">
                        {TOP_10_INVESTORS.find(i => i.id === selectedForPortfolio)?.name[0]}
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-900">
                          {TOP_10_INVESTORS.find(i => i.id === selectedForPortfolio)?.name}
                        </h4>
                        <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                          {TOP_10_INVESTORS.find(i => i.id === selectedForPortfolio)?.style}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {comparisonResult.individual_analyses.find(a => a.investor_id === selectedForPortfolio)?.educational_portfolio.map((item, i) => (
                        <div key={i} className="group">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center font-black text-[10px] text-slate-500">
                                {item.asset}
                              </div>
                              <span className="font-black text-slate-800">{item.asset}</span>
                            </div>
                            <span className="font-black text-indigo-600">{item.weight}%</span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 transition-all duration-1000" 
                              style={{ width: `${item.weight}%` }} 
                            />
                          </div>
                          <p className="mt-2 text-[10px] text-slate-400 font-medium italic opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-indigo-600 text-white p-10 rounded-[3.5rem] shadow-xl shadow-indigo-100 relative overflow-hidden flex flex-col justify-center">
                    <PieChart className="absolute -right-12 -top-12 w-64 h-64 text-white/10" />
                    <div className="relative z-10 space-y-6">
                      <h4 className="text-3xl font-black tracking-tight leading-tight">
                        {language === 'es' ? '¿Por qué esta estructura?' : 'Why this structure?'}
                      </h4>
                      <p className="text-indigo-100 text-lg font-medium leading-relaxed">
                        {TOP_10_INVESTORS.find(i => i.id === selectedForPortfolio)?.description}
                      </p>
                      <div className="pt-6 flex flex-wrap gap-3">
                        {TOP_10_INVESTORS.find(i => i.id === selectedForPortfolio)?.preferredSectors.map((s, i) => (
                          <span key={i} className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-[10px] font-black uppercase tracking-widest">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      )}

      {activeTab === 'buffett' && (
        <div className="space-y-12 animate-in fade-in duration-700">
          {/* Asset Selection for Buffett Analysis */}
          <section className="bg-white p-8 rounded-[3rem] border shadow-sm space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-amber-50 rounded-3xl text-amber-600">
                  <Target size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    {language === 'es' ? 'Análisis de Oportunidades (Estilo Buffett)' : 'Opportunity Analysis (Buffett Style)'}
                  </h3>
                  <p className="text-slate-500 font-medium">
                    {language === 'es' ? 'Analiza activos externos o de tu cartera con datos en tiempo real.' : 'Analyze external assets or your portfolio with real-time data.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-amber-500 transition-colors" size={18} />
                  <input 
                    type="text"
                    placeholder={language === 'es' ? 'Símbolo (ej: NVDA, TSLA)' : 'Symbol (e.g. NVDA, TSLA)'}
                    value={buffettSymbol}
                    onChange={(e) => setBuffettSymbol(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && runBuffettAnalysis()}
                    className="pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all w-full md:w-64"
                  />
                </div>
                <button 
                  onClick={runBuffettAnalysis}
                  disabled={isAnalyzing || !buffettSymbol}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 transition-all shadow-xl shadow-amber-100 disabled:opacity-50 active:scale-95"
                >
                  {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                  {language === 'es' ? 'Analizar Activo' : 'Analyze Asset'}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-full mb-1">
                  {language === 'es' ? 'Sugerencias de Mercado:' : 'Market Suggestions:'}
                </p>
                {['NVDA', 'TSLA', 'META', 'GOOGL', 'AMZN', 'NFLX'].map(sym => (
                  <button
                    key={sym}
                    onClick={() => setBuffettSymbol(sym)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all ${
                      buffettSymbol === sym 
                        ? 'bg-amber-500 border-amber-500 text-white shadow-md' 
                        : 'bg-white border-slate-100 text-slate-400 hover:border-amber-200 hover:text-amber-600'
                    }`}
                  >
                    {sym}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest w-full mb-1">
                  {language === 'es' ? 'De tu cartera:' : 'From your portfolio:'}
                </p>
                {assets.map(asset => (
                  <button
                    key={asset.id}
                    onClick={() => setBuffettSymbol(asset.symbol)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black border transition-all ${
                      buffettSymbol === asset.symbol 
                        ? 'bg-amber-500 border-amber-500 text-white shadow-md' 
                        : 'bg-white border-slate-100 text-slate-400 hover:border-amber-200 hover:text-amber-600'
                    }`}
                  >
                    {asset.symbol}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {isAnalyzing && (
            <div className="py-24 text-center space-y-6">
              <div className="inline-block relative">
                <div className="w-24 h-24 border-4 border-amber-100 border-t-amber-500 rounded-full animate-spin"></div>
                <Target className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-500" size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800">
                  {language === 'es' ? 'Consultando al Oráculo de Omaha' : 'Consulting the Oracle of Omaha'}
                </h3>
                <p className="text-slate-400 text-sm animate-pulse">
                  {language === 'es' ? 'Analizando PEG, medias móviles y flujos de caja...' : 'Analyzing PEG, moving averages and cash flows...'}
                </p>
              </div>
            </div>
          )}

          {buffettResult && !isAnalyzing && (
            <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-700">
              {/* Verdict Header */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className={`lg:col-span-1 p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden text-white ${
                  buffettResult.verdict === 'BUY' ? 'bg-emerald-600' : 
                  buffettResult.verdict === 'WAIT' ? 'bg-amber-500' : 'bg-rose-600'
                }`}>
                  <div className="absolute -right-10 -bottom-10 opacity-10">
                    <Briefcase size={240} />
                  </div>
                  <div className="relative z-10 space-y-8">
                    <div>
                      <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.3em] mb-4">
                        {language === 'es' ? 'Veredicto Buffett' : 'Buffett Verdict'}
                      </p>
                      <h2 className="text-6xl font-black leading-none tracking-tighter">
                        {buffettResult.verdict}
                      </h2>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black uppercase tracking-widest text-white/70">
                          {language === 'es' ? 'Puntuación de Valor' : 'Value Score'}
                        </span>
                        <span className="text-2xl font-black">{buffettResult.buffett_score}/100</span>
                      </div>
                      <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white" style={{ width: `${buffettResult.buffett_score}%` }} />
                      </div>
                      <p className="text-white/90 text-sm font-bold leading-relaxed italic">
                        "{buffettResult.buffett_wisdom}"
                      </p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 bg-white p-10 rounded-[3.5rem] border shadow-sm flex flex-col justify-center space-y-6">
                   <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-2xl text-slate-800 border">
                        {buffettResult.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight">{buffettResult.name} ({buffettResult.symbol})</h3>
                        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
                          {language === 'es' ? 'Análisis Fundamental y Técnico' : 'Fundamental & Technical Analysis'}
                        </p>
                      </div>
                   </div>
                   <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                      <p className="text-slate-700 font-bold leading-relaxed text-lg">
                        {buffettResult.final_recommendation}
                      </p>
                   </div>
                </div>
              </div>

              {/* Detailed Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* PEG Ratio */}
                <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-slate-900 uppercase tracking-wider text-xs flex items-center gap-2">
                      <TrendingUp size={16} className="text-indigo-500" /> PEG Ratio
                    </h4>
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-black text-xs">
                      {buffettResult.analysis.peg_ratio.value}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">
                    {buffettResult.analysis.peg_ratio.interpretation}
                  </p>
                </div>

                {/* Moving Averages */}
                <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-4">
                  <h4 className="font-black text-slate-900 uppercase tracking-wider text-xs flex items-center gap-2">
                    <Activity size={16} className="text-emerald-500" /> {language === 'es' ? 'Medias Móviles' : 'Moving Averages'}
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'MA8', val: buffettResult.analysis.moving_averages.ma8 },
                      { label: 'MA50', val: buffettResult.analysis.moving_averages.ma50 },
                      { label: 'MA200', val: buffettResult.analysis.moving_averages.ma200 }
                    ].map(ma => (
                      <div key={ma.label} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                        <p className="text-[10px] font-black text-slate-400 mb-1">{ma.label}</p>
                        <p className={`text-xs font-black ${ma.val.status === 'ABOVE' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {ma.val.status === 'ABOVE' ? '↑' : '↓'}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">
                    {buffettResult.analysis.moving_averages.interpretation}
                  </p>
                </div>

                {/* Market Sentiment */}
                <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-slate-900 uppercase tracking-wider text-xs flex items-center gap-2">
                      <PieChart size={16} className="text-amber-500" /> {language === 'es' ? 'Sentimiento' : 'Sentiment'}
                    </h4>
                    <span className={`px-3 py-1 rounded-lg font-black text-xs ${
                      buffettResult.analysis.market_sentiment.status === 'OVERSOLD' ? 'bg-emerald-50 text-emerald-600' :
                      buffettResult.analysis.market_sentiment.status === 'OVERBOUGHT' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-600'
                    }`}>
                      {buffettResult.analysis.market_sentiment.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-400">RSI Est:</span>
                    <span className="text-xs font-black text-slate-900">{buffettResult.analysis.market_sentiment.rsi_estimate}</span>
                  </div>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">
                    {buffettResult.analysis.market_sentiment.interpretation}
                  </p>
                </div>

                {/* Valuation */}
                <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-slate-900 uppercase tracking-wider text-xs flex items-center gap-2">
                      <DollarSign size={16} className="text-emerald-500" /> {language === 'es' ? 'Valor Justo' : 'Fair Value'}
                    </h4>
                    <span className="text-lg font-black text-slate-900">${buffettResult.analysis.valuation.fair_value}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {language === 'es' ? 'Margen de Seguridad' : 'Margin of Safety'}
                    </span>
                    <span className={`text-xs font-black ${buffettResult.analysis.valuation.margin_of_safety > 20 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {buffettResult.analysis.valuation.margin_of_safety}%
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">
                    {buffettResult.analysis.valuation.interpretation}
                  </p>
                </div>

                {/* Cash Flow */}
                <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-slate-900 uppercase tracking-wider text-xs flex items-center gap-2">
                      <Zap size={16} className="text-indigo-500" /> {language === 'es' ? 'Flujo de Caja' : 'Cash Flow'}
                    </h4>
                    <span className="text-xs font-black text-indigo-600">{buffettResult.analysis.cash_flow.growth_trend}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-400">{language === 'es' ? 'Por Acción:' : 'Per Share:'}</span>
                    <span className="text-xs font-black text-slate-900">${buffettResult.analysis.cash_flow.value_per_share}</span>
                  </div>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">
                    {buffettResult.analysis.cash_flow.interpretation}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Warning Footer */}
      <footer className="mt-12 p-8 bg-slate-100 border border-slate-200 rounded-[2.5rem] flex items-center gap-4">
        <div className="bg-white p-3 rounded-2xl text-slate-400 shadow-sm border border-slate-200">
          <Info size={24} />
        </div>
        <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-wider">
          {language === 'es' 
            ? 'AVISO LEGAL: El Asesor IA utiliza modelos de inteligencia artificial para generar ideas. Estas recomendaciones no constituyen asesoramiento financiero profesional. Toda inversión conlleva riesgo de pérdida de capital.'
            : 'LEGAL NOTICE: The AI Advisor uses artificial intelligence models to generate ideas. These recommendations do not constitute professional financial advice. All investments carry capital loss risks.'}
        </p>
      </footer>
    </div>
  );
};

const ActionBadge = ({ action, language }: { action: string, language: 'es' | 'en' }) => {
  const config = {
    HOLD: { 
      color: 'text-amber-600 bg-amber-50 border-amber-100', 
      icon: <MinusCircle size={14} />, 
      label: language === 'es' ? 'MANTENER' : 'HOLD' 
    },
    REDUCE: { 
      color: 'text-rose-600 bg-rose-50 border-rose-100', 
      icon: <ArrowDownCircle size={14} />, 
      label: language === 'es' ? 'REDUCIR' : 'REDUCE' 
    },
    INCREASE: { 
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100', 
      icon: <ArrowUpCircle size={14} />, 
      label: language === 'es' ? 'AUMENTAR' : 'INCREASE' 
    },
    REVIEW: { 
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100', 
      icon: <HelpCircle size={14} />, 
      label: language === 'es' ? 'REVISAR' : 'REVIEW' 
    }
  }[action] || { color: 'text-slate-600 bg-slate-50 border-slate-100', icon: <Info size={14} />, label: action };

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-xl text-[10px] font-black tracking-widest border ${config.color}`}>
      {config.icon}
      {config.label}
    </div>
  );
};
