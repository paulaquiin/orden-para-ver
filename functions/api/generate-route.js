export async function onRequest(context) {
  // Solo aceptamos peticiones POST
  if (context.request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const ip = context.request.headers.get("CF-Connecting-IP") || "anonymous";
  const today = new Date().toISOString().split('T')[0];
  const kvKey = `usage:${ip}:${today}`;

  try {
    // 1. Verificar límite en KV (Servidor)
    if (context.env.USAGE_KV) {
      const currentUsage = await context.env.USAGE_KV.get(kvKey);
      if (currentUsage && parseInt(currentUsage) >= 6) {
        return new Response(JSON.stringify({ 
          error: "Has agotado tus 6 consultas diarias por IP. ¡Vuelve mañana!" 
        }), {
          status: 429,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    const { genres, timePreference, avoidSagas } = await context.request.json();
    const API_KEY = context.env.GOOGLE_AI_KEY || context.env.VITE_GOOGLE_AI_KEY;

    if (!API_KEY) {
      return new Response(JSON.stringify({ error: "API Key not configured in environment" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const avoidText = avoidSagas && avoidSagas.length > 0 ? `Importante: Excluye estrictamente las sagas con estos IDs: ${avoidSagas.join(", ")}. Sugiere algo diferente.` : `Añade cierto grado de aleatoriedad para no recomendar siempre la misma si hay alternativas válidas.`;

    let prompt = "";
    if (timePreference === "Vistazo rápido") {
        prompt = `Actúa como un experto de "Orden para Ver". El usuario busca géneros: ${genres.join(", ")}.
        Crea un Top 9 de las 9 películas individuales más esenciales, famosas y aclamadas de este/os género/s de toda la historia del cine.
        Devuelve ÚNICAMENTE un objeto JSON válido con la forma exacta:
        {"type": "top9", "movies": [{"title": "Título de la película", "year": "2010", "reason": "Motivo corto"}]}
        Sin explicaciones extras ni markdown delimitador, solo el JSON nativo.`;
    } else {
        prompt = `Actúa como un experto de "Orden para Ver". El usuario busca géneros: ${genres.join(", ")} y prefiere este tipo de experiencia: ${timePreference}. 
        Elige UNA única saga de nuestro catálogo que mejor se adapte.
        ${avoidText}
        Catálogo disponible:
        [{"id": 404609, "type": "collection_id", "name": "John Wick"}, {"id": 9485, "type": "collection_id", "name": "Fast & Furious"}, {"id": 87359, "type": "collection_id", "name": "Misión Imposible"}, {"id": 328, "type": "collection_id", "name": "Jurassic Park"}, {"id": 86311, "type": "collection_id", "name": "Marvel MCU"}, {"id": 10, "type": "collection_id", "name": "Star Wars"}, {"id": 263, "type": "collection_id", "name": "Batman"}, {"id": 726871, "type": "collection_id", "name": "Dune"}, {"id": 531241, "type": "collection_id", "name": "Spider-Man"}, {"id": 1399, "type": "tv_id", "name": "Juego de Tronos"}, {"id": 71912, "type": "tv_id", "name": "The Witcher"}, {"id": 76479, "type": "tv_id", "name": "The Boys"}, {"id": 66732, "type": "tv_id", "name": "Stranger Things"}, {"id": 94605, "type": "tv_id", "name": "Arcane"}, {"id": 136315, "type": "tv_id", "name": "The Bear"}, {"id": 5724, "type": "tv_id", "name": "Doctor Who"}, {"id": 37854, "type": "tv_id", "name": "One Piece"}, {"id": 84958, "type": "tv_id", "name": "Loki"}]
        Devuelve ÚNICAMENTE un objeto JSON válido con las claves "type" (string) y "id" (number) de la saga elegida. Sin explicaciones ni markdown delimitador, solo el JSON nativo.`;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Google AI API Error: ${data.error.message || data.error.status || "Unknown error"}`);
    }
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No recommendation was generated. The AI returned an empty response.");
    }
    
    const aiText = data.candidates[0].content.parts[0].text;

    // 2. Incrementar uso en KV tras éxito
    if (context.env.USAGE_KV) {
      const currentCount = await context.env.USAGE_KV.get(kvKey) || 0;
      await context.env.USAGE_KV.put(kvKey, (parseInt(currentCount) + 1).toString(), { expirationTtl: 86400 });
    }

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
