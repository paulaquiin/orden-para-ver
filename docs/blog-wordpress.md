# Blog de WordPress y Monitor SEO

## Configuración acordada

- WordPress y fuente de verdad: `https://api.ordenparaver.net`.
- Frontend público: `https://ordenparaver.net`.
- Único idioma activo y de origen: `es`.
- Índice: `/blog/`; artículos: `/blog/{slug}/`.
- Configuración compartida: `config/blog.js`. No contiene secretos.
- Monitor SEO publica en este WordPress. El frontend consultará únicamente artículos publicados de esta instalación.

## Diagnóstico reproducible

```sh
npm run check:wordpress
```

Requiere Node.js 22.12 o posterior y acceso a Internet. Realiza exclusivamente
peticiones públicas GET y OPTIONS, sin autenticación ni escrituras. No muestra
contenido HTML, credenciales ni valores de campos meta en los logs.

Comprueba HTTPS con validación TLS, identidad de la instalación, esquema REST,
campos públicos, listado ligero con `status=publish`, `seo_locale=es`, `_embed`
y cabeceras de paginación. Cuando hay una muestra española, consulta su detalle
por slug y revisa idioma, contenido, imagen, categorías y JSON de puntos clave.
La muestra se limita a la primera página; no constituye una auditoría de todos
los artículos ni demuestra por sí sola el filtrado de una colección multilingüe.

Códigos de salida del script Node (`node scripts/check-wordpress.js`):

- `0`: conexión y muestra compatibles con las comprobaciones.
- `1`: error de conexión, HTTP o respuesta incompatible.
- `2`: conexión correcta, pero quedan requisitos del contrato sin verificar.

El comando de npm también termina con código distinto de cero cuando quedan
pendientes; algunas versiones de npm normalizan ese código a `1`. El mensaje
final distingue una conexión correcta con pendientes de un error de conexión.

Una respuesta HTTP 200 a `seo_locale` no prueba que el filtro funcione: WordPress
puede ignorar parámetros desconocidos. El diagnóstico consulta también el
esquema, detecta idiomas ajenos en la muestra y no da por validado un conector
cuando no hay publicaciones.

## Resultado comprobado el 18 de octubre de 2026

- DNS y HTTPS operativos.
- `GET /wp-json/`: HTTP 200, instalación `API | Ordenparaver`, URL y home del
  dominio correcto, namespace `wp/v2` disponible.
- `OPTIONS /wp-json/wp/v2/posts`: HTTP 200.
- `GET /wp-json/wp/v2/posts?status=publish&seo_locale=es&...`: HTTP 200, `[]`,
  `X-WP-Total: 0`, `X-WP-TotalPages: 0`.
- Consulta global sin filtro de idioma: también 0 artículos publicados.
- El esquema no anuncia `seo_locale`; el único campo meta anunciado es
  `footnotes`. No anuncia `seo_control_*` ni `replyswipe_*`.
- `yoast_head_json` no aparece en el esquema; Yoast es opcional y habrá valores
  alternativos en el frontend.

La conexión con WordPress está validada. Todavía no se puede confirmar desde
la API pública que SEO Control Connector esté instalado/activo y exponiendo
el contrato solicitado. Tampoco hay un artículo real para validar ese contrato.
La identidad corresponde a ordenparaver; que esta instalación se use
exclusivamente para este proyecto debe mantenerse al conectar Monitor SEO.

## Pendientes detectados en la revisión inicial (18 de octubre)

1. Comprobar en la administración de este WordPress que SEO Control Connector
   1.2.4 o posterior está instalado y activo, y que expone el filtro y los campos
   REST descritos en la guía. No se ha modificado WordPress desde este proyecto.
2. Conectar el proyecto de Monitor SEO con `https://api.ordenparaver.net` y
   publicar una muestra real en español con imagen destacada, categoría y
   puntos clave. Conservar los slugs al migrar los artículos Markdown actuales.
3. Repetir el diagnóstico y comprobar la muestra. No hace falta publicar
   traducciones: solo está activo español.

## Implementación y verificación del 20 de octubre de 2026

La API devuelve ahora un artículo publicado en español: id `25`, slug
`orden-lectura-libros-personaje-universo-compartido`. La respuesta incluye imagen
destacada con alt, categoría `Libros` (id `4`), idioma explícito y cuatro puntos
clave válidos. Los campos `seo_control_*` y `replyswipe_*` están expuestos.

`seo_locale` sigue sin anunciarse en OPTIONS, pero una consulta real para `en`
devuelve cero artículos y la consulta española devuelve el artículo publicado.
La falta del parámetro en el esquema ya no se considera por sí sola un fallo.
El cliente activa la compatibilidad antigua **solo** al observar otro idioma en
una respuesta filtrada. Nunca descarga toda la colección por anticipado.

Se han comprobado con datos reales el índice español, el detalle y sitemap.
También se ha ejecutado el renderizador para inglés sin publicaciones en una
configuración aislada de verificación: responde 200, estado vacío y `noindex`
tanto en HTML como en la cabecera HTTP. **Inglés no se ha activado ni se ha
añadido una ruta pública:** el único idioma del proyecto sigue siendo español.

En Cloudflare local, índice, artículo, categoría `/blog/categoria/4/` y sitemap
responden HTTP 200; artículo inexistente y rutas de blog inválidas devuelven 404.

## Arquitectura y rutas

- `server/blog/content.js`: cliente de WordPress, paginación, compatibilidad
  antigua y familias de traducción. Solo usa el backend de `config/blog.js`.
- `server/blog/html.js`: texto plano con entidades decodificadas y sanitización
  de contenido con lista permitida. No permite iframes, scripts, eventos ni formularios.
- `server/blog/render.js`: componentes de índice, artículo, categorías y estados;
  metadatos Yoast con alternativas, canonical público y hreflang de versiones reales.
- `server/blog/handler.js`: renderizado en servidor, códigos HTTP, sitemap y robots.
- `functions/blog/`: rutas Cloudflare `/blog/`, `/blog/{slug}/` y
  `/blog/categoria/{id}/`. Paginación mediante `?page=N`.
- `functions/api/revalidate-blog.js`: receptor de eventos de Monitor SEO.
- `blog-shell.html` y `src/blog.*`: diseño y assets compilados por Vite.
- `public/_routes.json`: limita las invocaciones a las rutas dinámicas.

Las consultas de listados y sitemap no piden `content`. El detalle lo pide por
slug, exige publicación e idioma correctos, y devuelve 404 si no coinciden.
Las categorías provienen solo de términos con `taxonomy === 'category'` en
`_embedded['wp:term']`. Las familias validan source_id, idioma y publicación de
cada versión. No hay selector con un solo idioma ni enlaces a borradores.

Los metadatos canónicos usan siempre `ordenparaver.net`, aunque Yoast señale al
backend. Las vistas locales y de otros dominios de preview incluyen `noindex`.
`/sitemap.xml` incluye las páginas principales y los artículos publicados; un
fallo de WordPress devuelve 503 y no publica un sitemap vacío.

## Actualización y revalidación

Esta versión usa **SSR sin caché persistente de contenido**. Las peticiones a
WordPress llevan `cache: 'no-store'` y las respuestas HTML/XML/eventos incluyen
`Cache-Control`, `CDN-Cache-Control` y `Cloudflare-CDN-Cache-Control: no-store`.
Solo los assets del diseño pueden almacenarse en caché. No configures una regla
de Cloudflare que fuerce caché ignorando estas cabeceras en las rutas dinámicas.

Por tanto, no existe una copia almacenada de índice, artículo, categoría,
sitemap o hreflang que deba purgarse, ni se necesita reconstruir al publicar.
Cada visita deriva todos esos datos del WordPress actual, también después de
retirar una publicación. No se usa una purga local que deje otros centros de
datos con contenido antiguo. El coste es una consulta a WordPress por visita;
si más adelante se añade caché, deberá añadirse invalidación compartida antes
de activarla.

El endpoint `POST https://ordenparaver.net/api/revalidate-blog` valida el evento,
proyecto, sitio y token, comprueba la publicación mediante lectura fresca y
devuelve `strategy: 'ssr-no-store'`, `published` y las rutas afectadas. Acepta
`post.published` y `post.scheduled`; **ambos consultan únicamente `publish`**.
Un artículo programado no se muestra antes de su publicación efectiva.
No afirma haber purgado ninguna caché externa de WordPress o de terceros.

Campos esperados en el JSON:

```json
{
  "type": "post.published",
  "postId": 25,
  "locale": "es",
  "projectId": "97bac6fa-f320-4809-b936-ffb11e085b22",
  "siteUrl": "https://api.ordenparaver.net"
}
```

Se admite también `siteUrl: "https://ordenparaver.net"`, con o sin barra final.
Se rechazan otros dominios, rutas, idiomas y proyectos. El cuerpo se limita a 8 KiB.
El evento debe enviar `Authorization: Bearer <token compartido>`.

### Variables de servidor

| Variable | Necesaria | Uso |
| --- | --- | --- |
| `BLOG_REVALIDATION_TOKEN` | Solo para eventos | Secreto compartido con Monitor SEO. |
| `MONITOR_SEO_PROJECT_ID` | Opcional | Si se define, debe coincidir con el ID de `config/blog.js`; otro valor desactiva el receptor con 503. |

La lectura de artículos publicados no requiere credenciales. Los dominios,
idioma y rutas están fijados en `config/blog.js` para este proyecto. El ID de
Monitor SEO facilitado por la usuaria (`97bac6fa-f320-4809-b936-ffb11e085b22`)
ya está configurado allí; no es una credencial.

Configura `BLOG_REVALIDATION_TOKEN` en **Cloudflare Pages → Settings → Variables
and Secrets**, marcado como secreto, y vuelve a desplegar para aplicar el
entorno. Configura el mismo token en Monitor SEO junto a la URL del endpoint;
los eventos deben usar el projectId indicado arriba. No se ha inventado ni
guardado un token de producción. Si falta el token,
el receptor responde 503 y el blog sigue leyendo normalmente. Un token incorrecto
devuelve 401; un evento ajeno o inválido, 400.

Para local, añade esas variables a `.dev.vars` sin reemplazar los secretos que
ya existan. El ejemplo está comentado en `.dev.vars.example`. Nunca uses
prefijo `VITE_`, repositorio ni logs para secretos. Las credenciales con las que
Monitor SEO escribe en WordPress pertenecen a esa herramienta, no a este frontend.

## Desarrollo, pruebas y despliegue

Se requiere Node.js **22.12 o posterior**. Instala con `npm ci`.

```sh
npm run dev
npm run test:blog
npm run check:wordpress
npm run check:blog
npm run build
npm run preview
```

`dev` sirve las rutas SSR mediante el mismo código en Vite y toma las variables
locales de `.dev.vars`. `preview` ejecuta `dist` y las funciones con Wrangler,
como Cloudflare Pages. Un servidor de archivos estáticos o `vite preview` por
sí solo no ejecuta el blog. `dev:ai` construye y arranca ese entorno Cloudflare.

`test:blog` prueba filtro, listado ligero, fallback paginado, slug localizado,
404 por idioma, familias parciales, JSON inválido, sanitización, SEO, categorías,
errores de WordPress, sitemap y seguridad de eventos/programaciones.

Resultado de esta implementación: 23 pruebas aprobadas, build de Vite correcto
y Worker compilado/ejecutado en Wrangler. La auditoría inicial de npm, anterior
a la retirada de las dependencias del blog Markdown, detectó 10 avisos
en dependencias preexistentes (herramientas Vite/Wrangler y YAML del generador
anterior); no señala las nuevas librerías `sanitize-html` y `he`. No se ha
incluido una actualización general de herramientas en este cambio.

`check:blog` verifica el HTML del índice y artículo con datos reales, sitemap y
receptor ejecutado localmente con un token efímero; no envía eventos a producción.
Comprueba también el estado vacío con datos reales de un idioma inactivo (`en`
por defecto, configurable con `npm run check:blog -- --empty-locale=en`). Esa
configuración solo existe durante la prueba, no modifica idiomas ni rutas.

En Cloudflare Pages, conserva `npm run build` como comando y `dist` como salida.
El despliegue debe incluir `functions/` del repositorio; subir solo los archivos
HTML a otro hosting no ejecuta las rutas SSR. No se ha desplegado desde esta sesión:
la comprobación de autenticación de Wrangler indica que no hay sesión activa.

Los cinco artículos Markdown anteriores, sus páginas HTML, el índice y la
plantilla estáticos se han eliminado a petición de la usuaria. También se han
retirado los generadores antiguos y sus dependencias exclusivas. El blog usa
únicamente WordPress; las URLs antiguas devolverán 404 mientras no exista ese
slug publicado allí. No se han publicado artículos ni modificado WordPress.

En la administración de WordPress queda revisar la indexación del dominio
backend para evitar duplicados, manteniendo accesibles API e imágenes. La
implementación del frontend no cambia opciones del WordPress remoto.
