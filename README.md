
# Control de Cartera - Sistema Inteligente (v1.0.1)

Plataforma premium para la gestión de carteras de inversión con análisis cognitivo mediante Gemini 3.

## 🚀 Instalación y Guía de Uso

1.  **Requisitos**: Node.js v18+ y una API Key de Google Gemini.
2.  **Configuración**:
    *   Crea un archivo `.env` en el root.
    *   Define `API_KEY=tu_llave_aqui`.
3.  **Ejecución**:
    *   `npm install`
    *   `npm start`
4.  **Acceso Demo**:
    *   Email: `demo@cartera.com`
    *   Password: `Cartera#Secure2026!`

## 💎 Características del MVP

*   **IA Financiera**: Integración nativa con Gemini 3 para recomendaciones tácticas basadas en el perfil de riesgo (Conservador, Moderado, Agresivo).
*   **Gestión de Liquidez**: Sincronización automática de saldos en efectivo (CASH) tras cada operación de compra o venta.
*   **Timeline de Activos**: Historial exacto de movimientos, promedios ponderados y snapshots de precios.
*   **Alertas Multi-canal**: Notificaciones simuladas vía Email y Push del navegador para caídas de mercado o concentración excesiva.

## ⚖️ Reglas de Negocio Implementadas

1.  **Límite de Control**: El sistema valida un máximo de **150 símbolos únicos** para garantizar tiempos de respuesta óptimos de la IA.
2.  **Costo Medio (Avg Cost)**: Se utiliza la fórmula de promedio ponderado: `((Cant. Actual * Costo Prom. Ant.) + (Cant. Nueva * Precio Nuevo)) / Cant. Total`.
3.  **Motor de Riesgo**: Basado en 4 pilares: Concentración (>20%), Volatilidad de activos (Crypto vs ETF), Tendencia de 7 días y Fundamentales (PEG Ratio).
4.  **Sincronización de Precios**: Simulación de actualización masiva con fluctuación realista (+/- 2%).

## 🛠️ Notas de Desarrollo

*   **Database Inspector**: Ubicado en `/dev/db` para validar el estado de `localStorage` en tiempo real.
*   **Manejo de Errores**: Todas las pantallas incluyen estados de carga y "Empty States" refinados para una experiencia de usuario fluida.
*   **Responsive**: Interfaz adaptable diseñada primero para desktop pero optimizada para tablets y móviles.
