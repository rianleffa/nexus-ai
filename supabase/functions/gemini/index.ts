// ==============================================================================
// NEXUS PDS — Supabase Edge Function: Google Gemini Gateway
// ==============================================================================
// Esta Edge Function executa no servidor (Deno / Supabase Edge Runtime),
// garantindo que a chave GEMINI_API_KEY nunca seja exposta no navegador.
// ==============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Regex de segurança para impedir vazamento de chaves em mensagens de erro
function sanitizeError(errorText: string, apiKey?: string): string {
  let sanitized = errorText;
  if (apiKey) {
    sanitized = sanitized.split(apiKey).join('[PROTECTED_API_KEY]');
  }
  // Remove padrões comuns de API keys
  sanitized = sanitized.replace(/AIza[0-9A-Za-z-_]{35}/g, '[PROTECTED_API_KEY]');
  sanitized = sanitized.replace(/AQ\.[0-9A-Za-z-_]{40,}/g, '[PROTECTED_API_KEY]');
  return sanitized;
}

serve(async (req: Request) => {
  // Tratamento de CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!apiKey || apiKey.trim() === '') {
      return new Response(
        JSON.stringify({
          success: false,
          errorType: 'INVALID_KEY',
          error: 'GEMINI_API_KEY não foi configurada nas variáveis de ambiente do servidor.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const { prompt, systemInstruction, tools, model = 'gemini-flash-latest' } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          errorType: 'EMPTY_RESPONSE',
          error: 'Prompt de entrada não foi fornecido.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Monta o payload para a API REST do Google Gemini
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody: Record<string, any> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 2048,
      },
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    if (tools && Array.isArray(tools) && tools.length > 0) {
      requestBody.tools = tools;
    }

    // Chamada segura para a API do Google Gemini
    const geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!geminiRes.ok) {
      const errorText = await geminiRes.text();
      const sanitized = sanitizeError(errorText, apiKey);

      if (geminiRes.status === 401 || geminiRes.status === 403) {
        return new Response(
          JSON.stringify({
            success: false,
            errorType: 'INVALID_KEY',
            error: 'Chave de API do Gemini inválida ou sem permissão.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: geminiRes.status }
        );
      }

      if (geminiRes.status === 429) {
        return new Response(
          JSON.stringify({
            success: false,
            errorType: 'RATE_LIMIT',
            error: 'Limite de requisições da API do Gemini atingido (Quota exceeded). Aguarde alguns instantes.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          errorType: 'API_ERROR',
          error: `Erro retornado pela API do Gemini (HTTP ${geminiRes.status}): ${sanitized}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: geminiRes.status }
      );
    }

    const data = await geminiRes.json();

    const candidate = data.candidates?.[0];
    if (!candidate || !candidate.content) {
      return new Response(
        JSON.stringify({
          success: false,
          errorType: 'EMPTY_RESPONSE',
          error: 'A API do Gemini retornou uma resposta vazia.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const textPart = candidate.content.parts?.find((p: any) => p.text)?.text;
    const functionCallPart = candidate.content.parts?.find((p: any) => p.functionCall)?.functionCall;

    return new Response(
      JSON.stringify({
        success: true,
        text: textPart || '',
        functionCall: functionCallPart || null,
        rawCandidate: candidate,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        errorType: 'NETWORK_ERROR',
        error: sanitizeError(err?.message || 'Falha de conexão interna na Edge Function.'),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
