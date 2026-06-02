
import { GoogleGenAI, Type } from "@google/genai";
import { Asset, RiskProfile, PriceSnapshot, AssetFundamentals } from "../types";
import { PortfolioService } from "./portfolioService";
import { RiskEngine } from "./riskEngine";

export interface AIRecommendationResponse {
  portfolio_summary: {
    risk_level: string;
    main_drivers: string[];
    cash_recommendation: string[];
  };
  assets: {
    symbol: string;
    action: 'HOLD' | 'REDUCE' | 'INCREASE' | 'REVIEW';
    confidence: number;
    reasons: string[];
    risks: string[];
    next_steps: string[];
  }[];
  questions: string[];
}

export interface InvestorComparisonResponse {
  individual_analyses: {
    investor_id: string;
    similarity_score: number;
    style_analysis: string;
    application_context: string;
    educational_portfolio: {
      asset: string;
      weight: number;
      reason: string;
    }[];
  }[];
  matching_investor_id: string;
  comparison_table: {
    metric: string;
    user_portfolio: string;
    investor_1: string;
    investor_2: string;
    investor_3: string;
  }[];
}

export interface BuffettAnalysisResponse {
  symbol: string;
  name: string;
  verdict: 'BUY' | 'WAIT' | 'AVOID';
  buffett_score: number; // 0-100
  analysis: {
    peg_ratio: { value: number | string; interpretation: string };
    moving_averages: {
      ma8: { value: number; status: 'ABOVE' | 'BELOW' };
      ma50: { value: number; status: 'ABOVE' | 'BELOW' };
      ma200: { value: number; status: 'ABOVE' | 'BELOW' };
      interpretation: string;
    };
    market_sentiment: {
      status: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
      rsi_estimate: number;
      interpretation: string;
    };
    valuation: {
      fair_value: number;
      margin_of_safety: number; // percentage
      interpretation: string;
    };
    cash_flow: {
      value_per_share: number;
      growth_trend: string;
      interpretation: string;
    };
  };
  final_recommendation: string;
  buffett_wisdom: string;
}

export const getAIRecommendations = async (
  assets: Asset[], 
  positions: any[], 
  brokers: any[], 
  profile: RiskProfile,
  fundamentals: AssetFundamentals[],
  snapshots: PriceSnapshot[],
  language: 'es' | 'en' = 'es'
): Promise<AIRecommendationResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const summary = PortfolioService.getSummary(assets, positions, brokers);
  
  const assetAnalysis = summary.assetDetails.map(a => {
    const fund = fundamentals.find(f => f.assetId === a.id);
    const risk = RiskEngine.calculateAssetRisk(a, summary.totalNetWorth, fund, snapshots);
    return {
      symbol: a.symbol,
      tipo: a.assetType,
      sector: a.sector,
      quantity: a.quantity,
      avgCost: a.avgCost,
      currentPrice: a.currentPrice,
      pnl: a.pnl,
      pnlPercent: a.pnlPercent,
      riskScore: risk.score,
      weight: (a.totalValue / summary.totalNetWorth) * 100
    };
  });

  const payload = {
    portfolio_summary: {
      totalValue: summary.totalNetWorth,
      allocation: summary.allocationByType,
      totalProfit: summary.totalProfitPercent,
      cashAvailable: summary.totalCash
    },
    assets: assetAnalysis,
    userPreference: { riskProfile: profile }
  };

  const languageInstruction = language === 'es' 
    ? "TODA LA RESPUESTA DEBE ESTAR EN ESPAÑOL. Usa un tono profesional pero cercano." 
    : "THE ENTIRE RESPONSE MUST BE IN ENGLISH. Use a professional and precise financial tone.";

  const systemInstruction = `You are an elite financial advisor. Analyze the user's portfolio and provide tactical recommendations.
  CRITICAL RULES:
  1. ${languageInstruction}
  2. Be critical about over-exposure (over 20% in one asset).
  3. Evaluate PEG ratio if available.
  4. For Cryptos, be cautious unless the profile is Aggressive.
  5. The response must be pure JSON, no markdown, following the provided schema.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze this portfolio: ${JSON.stringify(payload)}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            portfolio_summary: {
              type: Type.OBJECT,
              properties: {
                risk_level: { type: Type.STRING },
                main_drivers: { type: Type.ARRAY, items: { type: Type.STRING } },
                cash_recommendation: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ['risk_level', 'main_drivers', 'cash_recommendation']
            },
            assets: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  symbol: { type: Type.STRING },
                  action: { type: Type.STRING, enum: ['HOLD', 'REDUCE', 'INCREASE', 'REVIEW'] },
                  confidence: { type: Type.NUMBER },
                  reasons: { type: Type.ARRAY, items: { type: Type.STRING } },
                  risks: { type: Type.ARRAY, items: { type: Type.STRING } },
                  next_steps: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['symbol', 'action', 'confidence', 'reasons', 'risks', 'next_steps']
              }
            },
            questions: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['portfolio_summary', 'assets', 'questions']
        }
      }
    });

    return JSON.parse(response.text || '{}') as AIRecommendationResponse;
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return {
      portfolio_summary: {
        risk_level: language === 'es' ? "Análisis no disponible" : "Analysis Unavailable",
        main_drivers: [language === 'es' ? "Error de conexión con IA" : "AI connection error"],
        cash_recommendation: [language === 'es' ? "Mantener liquidez" : "Maintain liquidity"]
      },
      assets: assets.map(a => ({
        symbol: a.symbol,
        action: 'HOLD',
        confidence: 0.5,
        reasons: [language === 'es' ? "No se pudo procesar el análisis" : "Could not process analysis"],
        risks: [language === 'es' ? "Desconocidos" : "Unknown"],
        next_steps: [language === 'es' ? "Reintentar más tarde" : "Try again later"]
      })),
      questions: [language === 'es' ? "¿Deseas reintentar?" : "Would you like to try again?"]
    };
  }
};

export const getLegendaryComparison = async (
  assets: Asset[],
  positions: any[],
  brokers: any[],
  selectedInvestors: any[],
  language: 'es' | 'en' = 'es'
): Promise<InvestorComparisonResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const summary = PortfolioService.getSummary(assets, positions, brokers);

  const payload = {
    userPortfolio: {
      totalValue: summary.totalNetWorth,
      allocationByType: summary.allocationByType,
      allocationBySector: summary.allocationBySector,
      riskProfile: summary.totalProfitPercent > 0 ? 'Moderate' : 'Conservative', // Simplified
      volatility: 'Medium' // Simplified
    },
    legendaryInvestors: selectedInvestors
  };

  const languageInstruction = language === 'es' 
    ? "TODA LA RESPUESTA DEBE ESTAR EN ESPAÑOL." 
    : "THE ENTIRE RESPONSE MUST BE IN ENGLISH.";

  const systemInstruction = `You are a world-class portfolio strategist. Compare the user's portfolio with the selected legendary investors.
  CRITICAL RULES:
  1. ${languageInstruction}
  2. Provide an individual analysis for EACH of the 3 selected investors.
  3. Identify which investor style most closely matches the user's current allocation in matching_investor_id.
  4. Provide a deep comparison table with metrics like Risk, Volatility, Preferred Sectors, and Diversification.
  5. For each investor, create an educational sample portfolio (not a recommendation) inspired by them.
  6. The response must be pure JSON, no markdown.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `Compare this portfolio with these legends: ${JSON.stringify(payload)}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            individual_analyses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  investor_id: { type: Type.STRING },
                  similarity_score: { type: Type.NUMBER },
                  style_analysis: { type: Type.STRING },
                  application_context: { type: Type.STRING },
                  educational_portfolio: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        asset: { type: Type.STRING },
                        weight: { type: Type.NUMBER },
                        reason: { type: Type.STRING }
                      },
                      required: ['asset', 'weight', 'reason']
                    }
                  }
                },
                required: ['investor_id', 'similarity_score', 'style_analysis', 'application_context', 'educational_portfolio']
              }
            },
            matching_investor_id: { type: Type.STRING },
            comparison_table: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  metric: { type: Type.STRING },
                  user_portfolio: { type: Type.STRING },
                  investor_1: { type: Type.STRING },
                  investor_2: { type: Type.STRING },
                  investor_3: { type: Type.STRING }
                },
                required: ['metric', 'user_portfolio', 'investor_1', 'investor_2', 'investor_3']
              }
            }
          },
          required: ['individual_analyses', 'matching_investor_id', 'comparison_table']
        }
      }
    });

    return JSON.parse(response.text || '{}') as InvestorComparisonResponse;
  } catch (error) {
    console.error("Gemini Comparison Error:", error);
    throw error;
  }
};

export const getBuffettAnalysis = async (
  symbol: string,
  assetData?: Partial<Asset>,
  fundamentals?: AssetFundamentals,
  snapshots?: PriceSnapshot[],
  language: 'es' | 'en' = 'es'
): Promise<BuffettAnalysisResponse> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const payload = {
    symbol,
    currentPrice: assetData?.currentPrice,
    fundamentals,
    recentPrices: snapshots?.slice(-30).map(s => ({ date: s.priceDate, price: s.price }))
  };

  const languageInstruction = language === 'es' 
    ? "TODA LA RESPUESTA DEBE ESTAR EN ESPAÑOL. Actúa como Warren Buffett." 
    : "THE ENTIRE RESPONSE MUST BE IN ENGLISH. Act as Warren Buffett.";

  const systemInstruction = `You are Warren Buffett, the legendary value investor. Analyze the requested asset using your principles and technical variables.
  CRITICAL VARIABLES TO ANALYZE:
  1. PEG Ratio (Growth vs Valuation).
  2. Moving Averages (8, 50, 200 periods) - determine trend.
  3. Market Sentiment (RSI/Overbought/Oversold).
  4. Fair Value & Margin of Safety.
  5. Cash Flow per Share.
  
  RULES:
  1. ${languageInstruction}
  2. Be conservative. If the margin of safety is low, recommend WAIT or AVOID.
  3. Use Buffett-style wisdom in the 'buffett_wisdom' field.
  4. The response must be pure JSON, no markdown.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `Analyze this asset (use Google Search for real-time data if local data is missing): ${JSON.stringify(payload)}`,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            symbol: { type: Type.STRING },
            name: { type: Type.STRING },
            verdict: { type: Type.STRING, enum: ['BUY', 'WAIT', 'AVOID'] },
            buffett_score: { type: Type.NUMBER },
            analysis: {
              type: Type.OBJECT,
              properties: {
                peg_ratio: {
                  type: Type.OBJECT,
                  properties: {
                    value: { type: Type.STRING },
                    interpretation: { type: Type.STRING }
                  },
                  required: ['value', 'interpretation']
                },
                moving_averages: {
                  type: Type.OBJECT,
                  properties: {
                    ma8: { 
                      type: Type.OBJECT, 
                      properties: { value: { type: Type.NUMBER }, status: { type: Type.STRING } },
                      required: ['value', 'status']
                    },
                    ma50: { 
                      type: Type.OBJECT, 
                      properties: { value: { type: Type.NUMBER }, status: { type: Type.STRING } },
                      required: ['value', 'status']
                    },
                    ma200: { 
                      type: Type.OBJECT, 
                      properties: { value: { type: Type.NUMBER }, status: { type: Type.STRING } },
                      required: ['value', 'status']
                    },
                    interpretation: { type: Type.STRING }
                  },
                  required: ['ma8', 'ma50', 'ma200', 'interpretation']
                },
                market_sentiment: {
                  type: Type.OBJECT,
                  properties: {
                    status: { type: Type.STRING },
                    rsi_estimate: { type: Type.NUMBER },
                    interpretation: { type: Type.STRING }
                  },
                  required: ['status', 'rsi_estimate', 'interpretation']
                },
                valuation: {
                  type: Type.OBJECT,
                  properties: {
                    fair_value: { type: Type.NUMBER },
                    margin_of_safety: { type: Type.NUMBER },
                    interpretation: { type: Type.STRING }
                  },
                  required: ['fair_value', 'margin_of_safety', 'interpretation']
                },
                cash_flow: {
                  type: Type.OBJECT,
                  properties: {
                    value_per_share: { type: Type.NUMBER },
                    growth_trend: { type: Type.STRING },
                    interpretation: { type: Type.STRING }
                  },
                  required: ['value_per_share', 'growth_trend', 'interpretation']
                }
              },
              required: ['peg_ratio', 'moving_averages', 'market_sentiment', 'valuation', 'cash_flow']
            },
            final_recommendation: { type: Type.STRING },
            buffett_wisdom: { type: Type.STRING }
          },
          required: ['symbol', 'name', 'verdict', 'buffett_score', 'analysis', 'final_recommendation', 'buffett_wisdom']
        }
      }
    });

    return JSON.parse(response.text || '{}') as BuffettAnalysisResponse;
  } catch (error) {
    console.error("Gemini Buffett Analysis Error:", error);
    throw error;
  }
};
