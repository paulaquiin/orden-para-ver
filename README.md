# Orden para ver | Explora Cronologías de Cine y Series

**Orden para ver** es una plataforma web diseñada para ayudar a los fans a dominar el orden cronológico y de estreno de sus franquicias favoritas. Desde el Universo Cinematográfico de Marvel hasta la lejana galaxia de Star Wars, esta herramienta ofrece guías actualizadas y precisas.

🚀 **Web en vivo:** [ordenparaver.net](https://ordenparaver.net)

## Características principales

- **Cronologías Detalladas:** Accede a listas completas organizadas por orden de estreno u orden cronológico real dentro de la ficción.
- **Generador de Rutas:** ¿No sabes por dónde empezar? Utiliza nuestro generador personalizado para encontrar tu próximo maratón.
- **Búsqueda Avanzada:** Encuentra rápidamente cualquier saga o universo cinematográfico entre más de 500 opciones disponibles.
- **Actualizaciones Constantes:** Mantente al día con los últimos estrenos y novedades de cada franquicia.
- **Sagas literarias:** Busca series de libros y consulta sus entregas principales en orden de lectura mediante Hardcover.

## Tecnologías utilizadas

Este proyecto está construido con un enfoque moderno y ligero:

- **Core:** HTML5 Semántico y JavaScript (ES6+).
- **Estilos:** CSS3 personalizado (Vanilla CSS) para una experiencia fluida y rápida.
- **Herramientas de construcción:** [Vite](https://vitejs.dev/) para un desarrollo ágil.
- **Backend/API:** Cloudflare Functions para la lógica de generación de rutas y búsqueda.
- **Tipografía:** [Outfit](https://fonts.google.com/specimen/Outfit) vía Google Fonts.

## Desarrollo local

Si deseas ejecutar el proyecto en tu entorno local:

1. Instala las dependencias:
   ```bash
   npm install
   ```

2. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

   La página de libros necesita las funciones locales de Cloudflare. Si ya
   existe `.dev.vars`, añade allí `HARDCOVER_TOKEN2`. Si no existe, copia
   `.dev.vars.example` como `.dev.vars`, sustituye el valor de ejemplo y usa:

   ```bash
   npm run dev:ai
   ```

   Este comando genera la web y la sirve con las funciones de Cloudflare en
   `http://127.0.0.1:8788`. Si cambias el código, detenlo y ejecútalo de nuevo
   para reconstruir la versión local.

   El secreto debe llamarse `HARDCOVER_TOKEN2` (también se admite
   `HARDCOVER_TOKEN` como alternativa). No uses el prefijo `VITE_` y no
   subas el archivo `.dev.vars` al repositorio.

3. Para construir la versión de producción:
   ```bash
   npm run build
   ```

## Configuración de Hardcover en producción

En Cloudflare, abre **Workers & Pages → tu proyecto → Settings → Variables and
Secrets → Add**, crea `HARDCOVER_TOKEN2`, marca el valor como secreto cifrado y
vuelve a desplegar el proyecto. El navegador solo llama a `/api/hardcover`; el
token nunca se envía al cliente.

Si ambos secretos están configurados, se usa `HARDCOVER_TOKEN2` con prioridad.

---
Hecho con ❤️ para amantes del cine y las series.
