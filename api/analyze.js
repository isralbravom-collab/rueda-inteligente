export const config = { runtime: 'edge' }

const SYSTEM = `Eres un entrenador de ciclismo científico, empático y directo.
Respondes SIEMPRE en español. Basas tus análisis en evidencia científica:
Escala RPE de Borg (1982), modelo polarizado de Seiler (2010), TSS/ATL/CTL de Foster (2001),
nutrición deportiva de Burke (2011), periodización de Bompa (2018).
Nunca uses bullet points. Responde en párrafo corrido, máximo 160 palabras.`

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: corsHeaders })
  }

  const { prompt, maxTokens = 400 } = body

  const GROQ_KEY = process.env.GROQ_API_KEY
  if (!GROQ_KEY) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY no configurada en Vercel. Ve a Settings → Environment Variables.' }), { status: 500, headers: corsHeaders })
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: maxTokens,
        temperature: 0.7,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt },
        ],
      }),
    })

    const data = await groqRes.json()

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message }), { status: 400, headers: corsHeaders })
    }

    const text = data.choices?.[0]?.message?.content || 'Sin respuesta.'
    return new Response(JSON.stringify({ text }), { status: 200, headers: corsHeaders })

  } catch (e) {
    return new Response(JSON.stringify({ error: 'Error conectando con Groq: ' + e.message }), { status: 500, headers: corsHeaders })
  }
}
