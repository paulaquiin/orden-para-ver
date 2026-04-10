export async function onRequest(context) {
  // Solo aceptamos peticiones POST
  if (context.request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { genres, timePreference } = await context.request.json();
    const API_KEY = context.env.GOOGLE_AI_KEY || context.env.VITE_GOOGLE_AI_KEY;

    if (!API_KEY) {
      return new Response(JSON.stringify({ error: "API Key not configured in environment" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const prompt = `Actúa como un experto cinéfilo y guía de "Orden para Ver". 
    El usuario tiene estos gustos: ${genres.join(", ")}.
    Su disponibilidad de tiempo es: ${timePreference}.
    
    Genera una recomendación personalizada de "ruta de visualización".
    Debes mencionar al menos 2 sagas de las que tenemos disponibles (Marvel MCU, Star Wars, DC, Dune, Doctor Who, Wizarding World, One Piece).
    
    La respuesta debe tener saludarse, explicar por qué esas sagas encajan con sus gustos y darle un orden sugerido. 
    Usa un tono premium, entusiasta y usa Markdown para que quede bien formateado.
    Importante: No inventes sagas que no tenemos. Mantén la respuesta concisa pero emocionante.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    const data = await response.json();
    const aiText = data.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ result: aiText }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
