# Guía de Despliegue y Configuración - Control de Cartera

Este proyecto utiliza **Supabase** como backend para la persistencia de datos y **Gemini AI** para la asesoría inteligente.

## Configuración de Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. Ejecuta el contenido de `migration.sql` en el **SQL Editor** de tu proyecto de Supabase.
3. Copia la `URL` y la `Anon Key` desde los ajustes de la API en Supabase.
4. En el archivo `.env` (creado a partir de `.env.example`), define:
   ```env
   VITE_SUPABASE_URL=tu_url_aqui
   VITE_SUPABASE_ANON_KEY=tu_clave_anon_aqui
   ```

## Configuración de IA

1. Obtén una clave de API de Google AI Studio.
2. Agrégala a tu configuración:
   ```env
   GEMINI_API_KEY=tu_clave_gemini_aqui
   ```

## Estructura de Datos (Service Layer)

El acceso a datos se centraliza en `services/supabaseService.ts`, que divide las operaciones en módulos:
- `brokers`: Gestión de intermediarios.
- `assets`: Catálogo maestro de activos.
- `positions`: Tenencias actuales del usuario.
- `priceSnapshots`: Histórico de precios y fuentes manuales.
- `accountAdjustments`: Ajustes de saldo y liquidez.

## Seguridad

La seguridad está garantizada mediante **Row Level Security (RLS)** en Postgres. Los usuarios solo pueden ver y editar sus propios Brokers, Posiciones y Ajustes. Los Activos y Snapshots de precio son de lectura pública para todos los usuarios autenticados.
