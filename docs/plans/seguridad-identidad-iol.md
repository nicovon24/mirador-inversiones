# Plan de identidad, aislamiento de datos e integración IOL

Fecha: 2026-10-20. Estado: implementación local y corte de seguridad productivo realizados; activación privada pendiente de configuración Google y migración productiva.

Este documento comenzó como análisis de Astra high y sigue registrando sus decisiones. El estado actual de ejecución se detalla al final. El workspace contiene cambios previos del usuario, incluidos archivos sin seguimiento, que se preservaron.

Decisión confirmada: login Mirador con Google OIDC y acceso privado limitado exclusivamente a `fervon96@gmail.com` y `nicovon24@gmail.com`. Son dos cuentas individuales. Esta lista reemplaza cualquier correo mencionado anteriormente. Cada persona debe autenticarse con Google y acreditar el correo verificado; su inclusión en la lista no asigna datos antiguos ni el rol OWNER.

## 1. Resultado esperado

Mirador tiene cuentas y sesiones propias con autenticación Google. Solo los dos correos autorizados pueden darse de alta e iniciar sesión para usar Investigación, Portafolio, Favoritos, Alertas y Ajustes, sin necesitar cuenta IOL. Conectar IOL es una operación opcional posterior al login de Mirador y solo incorpora la cartera de esa persona mediante OAuth.

| Actor | Acceso |
| --- | --- |
| Público sin sesión | Inicio, Mercados, instrumentos, Aprender y Glosario; sus APIs exclusivamente de datos públicos |
| USER autenticado | Secciones públicas y privadas; únicamente sus listas, posiciones, alertas, notificaciones, preferencias y conexión IOL |
| OWNER autenticado | Lo anterior y operaciones de configuración global expresamente enumeradas, como registrar el webhook del bot |
| Proceso de sistema | Cron/webhook con autenticación propia y permisos específicos; sin impersonar un usuario |

OWNER no habilita leer carteras de otras personas. El rol inicial se asigna mediante un procedimiento operativo explícito a una identidad verificada; ningún registro público recibe OWNER por ser el primero.

## 2. Evidencias y límites del diagnóstico

Se revisaron `AGENTS.md`, `package.json`, esquema y migraciones Prisma, sesión, queries/actions, integración IOL, navegación y Telegram. La versión instalada declarada es Next.js 16.3.8 y Prisma 7.10.0. Se consultaron las guías locales de Next:

- `node_modules/next/dist/docs/01-app/02-guides/authentication.md`.
- `node_modules/next/dist/docs/01-app/02-guides/data-security.md`.
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.
- `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md`.
- `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md`.

Hallazgos:

1. `src/app/(app)/portfolio/page.tsx` activa un fallback global cuando no hay conexión OAuth y existen credenciales de entorno. Ese camino consulta cartera y efectivo sin exigir una sesión Mirador.
2. `src/lib/market/iol.ts` implementa password grant y guarda tokens globales en memoria; `src/lib/market/index.ts` también usa ese adaptador para mercado público.
3. `User` representa actualmente una identidad anónima de navegador. `getOrCreateIdentity()` crea usuarios al conectar IOL; no hay login propio. Su limpieza borra identidades sin conexión ni sesión vigente.
4. `Watchlist`, `Position`, `Alert`, `Notification` y `Setting` no tienen propietario. Queries y mutaciones operan globalmente, incluso borrados por instrumento y marcado de notificaciones.
5. El layout compartido, Inicio e Investigación consumen datos privados. Proteger solo las URLs privadas dejaría otras vías de exposición.
6. Telegram tiene preferencias singleton y código de vinculación global; el evaluador reúne todas las alertas y envía al mismo chat.
7. `disconnectIol()` elimina el usuario, sus sesiones y su conexión. Eso sería destructivo para una cuenta Mirador real.
8. Ya existen PKCE, estado OAuth de un uso, tokens cifrados, conexión por `userId` y allowlist MCP de lectura. Esas garantías deben conservarse.
9. La protección Basic local aparece en archivos sin seguimiento. No equivale a identidad individual y no constituye evidencia de protección desplegada.
10. El coordinador reporta respuestas 200 sin cookies en las rutas privadas de producción y una descripción de cartera IOL conectada. No se consultaron carteras desde este análisis.

No está demostrada la causa de la diferencia entre aproximadamente 25 M mostrados y aproximadamente 10 M esperados. Hay dos fuentes de riesgo a investigar: el efectivo legacy podría contener patrimonio total, y el mapeo MCP suma `t0..t3` suponiendo plazos no acumulativos. Esa suposición aparece también en un test; el test no prueba el contrato del proveedor.

## 3. P0: contención de la exposición

Ejecutar antes de habilitar nuevas cuentas:

1. Identificar el proyecto, equipo, dominio y repositorio efectivos de producción mediante configuración y metadatos. Hay una discrepancia reportada entre remoto `track-inversiones` y builds `mirador-inversiones`. No desplegar suponiendo que son el mismo destino.
2. Cortar el acceso global a IOL: retirar el fallback del portafolio y el proveedor password grant del selector de mercado. Al faltar OAuth del usuario, mostrar sus posiciones manuales y la opción de conectar IOL.
3. Mientras no exista autenticación y ownership completos, cerrar lecturas/mutaciones privadas desde el servidor, incluida personalización de Inicio/layout, acciones y rutas indirectas. Puede responder mantenimiento temporal 503 para el área privada. Mantener públicos los módulos de mercado y aprendizaje.
4. Desactivar temporalmente envíos de alertas globales y vinculación Telegram global si no pueden migrarse en el mismo corte. El refresh público de fundamentales puede seguir con autenticación de sistema.
5. Eliminar `IOL_USERNAME` y `IOL_PASSWORD` de archivos locales de entorno y variantes que existan, `.env.example`, documentación, Docker/Compose y variables Vercel Development, Preview y Production, incluidas variantes por rama. Inspeccionar nombres/alcances y confirmar ausencia sin mostrar valores.
6. Construir y desplegar el código de contención al destino verificado; confirmar dominio productivo y URLs de despliegues anteriores que sigan siendo accesibles. Quitar variables no cambia builds antiguos ni garantiza que tokens globales en procesos existentes desaparezcan.
7. Revocar el acceso legacy del bróker mediante los controles disponibles y la participación del titular cuando sea necesaria; no imprimir tokens ni entrar a la cuenta usando credenciales almacenadas. Registrar como pendiente cualquier revocación que requiera acción humana.

No eliminar `IOL_SESSION_SECRET` ni el callback OAuth por similitud de nombres. No activar un fallback alternativo con credenciales globales. No hacer rollback hacia una versión que vuelva a exponer la cartera.

Criterio de salida P0: un visitante puede ver mercado público, pero no recibe datos financieros privados ni puede ejecutar mutaciones privadas; ninguna ruta usa password grant IOL.

## 4. P1: login Google, lista de acceso y contrato de sesión

Método decidido: Google OIDC mediante una biblioteca mantenida compatible con Next 16 y Prisma 7. La implementación elegirá y verificará esa biblioteca; no habrá formulario de contraseña Mirador ni alta pública alternativa.

Lista de acceso exacta, evaluada exclusivamente en servidor:

- `fervon96@gmail.com`.
- `nicovon24@gmail.com`.

Controles OIDC: flujo de código con callback fijo registrado, scopes `openid email` y `profile` solo si se necesita. Validar state ligado al navegador y nonce ligado al intento; rechazar intentos vencidos o reutilizados. Verificar firma del ID token con claves oficiales, issuer Google permitido, audience del cliente configurado para ese entorno y expiración. Exigir `email_verified === true`. Usar `sub` como identificador estable de Google; el email no reemplaza esa identidad. Estos controles se basan en la [documentación oficial de Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect).

Política Mirador: después de validar OIDC, comparar el correo verificado normalizado a minúsculas con los dos valores completos. No ampliar la lista quitando puntos, eliminando sufijos `+`, aceptando dominios completos ni usando `login_hint` como autorización. Un correo escrito en formulario, query, header o localStorage no acredita acceso. La comprobación sucede antes de persistir una cuenta o crear una sesión; confirmar que los hooks de la biblioteca respeten ese orden.

Primer login autorizado: crear atómicamente una cuenta Mirador con vínculo Google único por proveedor y `sub`, rol USER y datos privados vacíos. Login posterior: recuperar esa misma cuenta por vínculo Google y volver a comprobar correo autorizado y estado habilitado. Los dos sujetos Google conservan IDs, sesiones y datos independientes. No enlazar automáticamente por email con identidades legacy ni con una cuenta que tenga otro `sub`.

Correo no autorizado, ausente o no verificado: denegar alta y sesión, limpiar el intento OIDC y mostrar “Esta cuenta no tiene acceso a Mirador”, con opción de elegir otra cuenta Google o volver a Inicio. No mostrar la lista de correos autorizados en el error. Un intento fallido no puede quedar presentado como un cambio exitoso de cuenta; cualquier sesión previa válida conserva su identidad original hasta logout o un nuevo login autorizado.

La lista se revalida también al resolver la sesión Mirador: retirar un correo de la configuración debe bloquear sus sesiones existentes, sin depender de que vuelva a Google. Configuración ausente o inválida cierra el acceso privado. El registro de usuarios de prueba en Google, si aplica a la configuración de consentimiento, complementa esta política; no sustituye su control en el servidor Mirador.

Contrato de servidor a fijar antes de dividir tareas:

- `getCurrentUser(): Promise<{ id, role } | null>` valida sesión y estado de cuenta contra la base.
- `requireUser()` devuelve el mismo DTO o un error de autenticación tipado.
- `requireRole("OWNER")` exige sesión válida y rol confirmado en servidor.
- Páginas traducen ausencia de sesión a `/login?returnTo=...`; APIs a 401 y acciones a un resultado tipado. `returnTo` acepta solo rutas locales autorizadas.
- No exponer helpers de acceso privado que acepten un `userId` suministrado por el cliente. El actor se obtiene de la sesión en cada punto de entrada.

Modelo de cuenta: identificador interno estable, vínculo Google único por proveedor y `sub`, email verificado normalizado, rol USER por defecto, estado de cuenta y campos que requiera la biblioteca elegida. OWNER requiere designación explícita y autenticación verificada; ninguno de los dos correos obtiene ese rol automáticamente.

Mantener sesiones opacas y revocables en servidor. Puede conservarse la propiedad actual de almacenar el hash del token de sesión. Cookies HttpOnly, Secure en producción, SameSite adecuado y expiración explícita. Rotar sesión al autenticar y cambiar privilegios; revocar al cerrar sesión o inhabilitar la cuenta. Una conexión IOL puede vencer sin cerrar la sesión Mirador. El ID token de Google no sustituye la sesión Mirador ni concede acceso a IOL; no persistir tokens Google para acceso offline que la aplicación no necesita.

Eliminar la creación automática de identidad al conectar IOL y la limpieza que borra usuarios por falta de IOL. Invalidar sesiones anónimas existentes mediante una versión/nombre nuevo o un marcador de autenticación; la presencia de la cookie antigua nunca prueba login propio.

Aplicar protección CSRF/origen en mutaciones según biblioteca y Next, validación Zod, mensajes de error que no enumeren cuentas y límites de intentos con almacenamiento apto para múltiples instancias. No usar exclusivamente memoria de un proceso para el límite de login de producción.

Configuración propuesta de autenticación, con nombres finales adaptados a la biblioteca:

| Variable/elemento | Política |
| --- | --- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Cliente Google por entorno; secreto solo servidor |
| `AUTH_SECRET` | Secreto propio de autenticación, independiente del cifrado IOL |
| `APP_ORIGIN` y callback Google | Origen fijo y callback exacto de la biblioteca; nunca derivados de un Host arbitrario |
| `AUTH_ALLOWED_EMAILS` | Exactamente `fervon96@gmail.com,nicovon24@gmail.com`; validación servidor y denegación si falta o está mal configurada |
| Development | Cliente/callback localhost explícitos, base y secreto propios; misma lista de acceso |
| Preview | Cliente y base aislados, dominio de preview estable con callback exacto; si no hay callback configurado, login deshabilitado |
| Production | Cliente/callback HTTPS del dominio productivo confirmado, base y secreto productivos; misma lista de acceso |

No compartir cookies de autenticación entre hosts/entornos ni usar la base productiva para pruebas de login. Las pruebas automatizadas usan OIDC simulado sin ampliar la lista de acceso desplegada. La configuración OAuth Google permanece separada de `IOL_SESSION_SECRET` y del callback IOL.

## 5. P1: migración de propietarios sin apropiación de datos

Crear nuevas migraciones; no modificar ni revertir la migración aplicada `20261008003757_iol_login_only`, que quitó campos de cuenta.

1. Realizar respaldo y obtener conteos por tabla, sin volcar información financiera a logs. Ensayar migración en copia aislada.
2. Añadir `ownerId` nullable e índices a Watchlist, Position, Alert y Notification. Setting deja de ser singleton y tiene un registro único por usuario. WatchlistItem puede heredar ownership de su lista, siempre que todas las operaciones verifiquen esa relación.
3. Añadir identidad real y rol sin promover usuarios anónimos. Los registros antiguos sin propietario quedan en cuarentena lógica: `ownerId = null`, inaccesibles a consultas de usuario y excluidos de cron/envíos.
4. Todas las creaciones posteriores exigen ownerId calculado en servidor. Todas las lecturas y mutaciones privadas filtran ese ownerId. Nunca incluir filas sin propietario como “datos por defecto”.
5. No asignar los datos previos al primer signup, al primer OWNER, al primer usuario que conecta IOL ni al navegador que posee una cookie antigua.
6. Ofrecer migración operativa explícita después de confirmar quién es titular de cada conjunto. Ejecutar un mapeo aprobado de registros a usuario real, con conteos antes/después y transacción. Las filas sin prueba de pertenencia permanecen aisladas.
7. Para conexiones IOL anónimas previas, opción preferida: exigir nueva autorización OAuth desde la cuenta Mirador. Cualquier retención/retirada de tokens antiguos se documenta; no asociarlos por coincidencias inferidas.
8. Cuando todos los datos activos tengan dueño, archivar o resolver filas restantes y endurecer constraints. Si se retiene cuarentena nullable durante la transición, añadir pruebas que impidan devolverla; la fase de constraints no debe causar pérdida silenciosa.

Notification conserva su propietario aun si se elimina la alerta. Las notificaciones creadas desde una alerta deben tomar su ownerId y no admitir otro distinto. Los datos compartidos del catálogo Instrument y Fundamentals siguen siendo públicos; un usuario no debe poder sobrescribir libremente metadatos globales mediante el nombre de un favorito.

Modificar seed para sembrar catálogo público y, si corresponde, datos de ejemplo asociados a un usuario de prueba explícito en entorno no productivo. Eliminar la creación implícita de listas y Setting singleton.

## 6. P1: autorización en datos, acciones, páginas y caché

- Centralizar acceso privado en DAL `server-only`. Cada query o action valida actor antes de consultar o modificar. `proxy.ts` es una ayuda para redirección temprana, no la autoridad final.
- Añadir controles de página en Investigación, Portafolio, Favoritos, Alertas y Ajustes. El layout no basta: Next tiene acciones, RSC, navegación y entradas directas independientes.
- Inicio/layout usan DTO público para visitantes. Solo buscan listas, contadores o notificaciones cuando hay usuario autenticado, y esas queries filtran al usuario.
- Para update/delete exigir simultáneamente id y ownerId; para WatchlistItem verificar propietario de la lista. Ausencia y registro de otro usuario deben producir el mismo resultado público.
- `removeFromWatchlist` sin lista específica elimina únicamente de listas del actor. `markNotificationsRead` modifica únicamente sus notificaciones. La lista por defecto y su orden se calculan dentro del usuario.
- Separar ausencia de sesión, falta de autorización y error de infraestructura. Los wrappers actuales que convierten todos los fallos en datos vacíos no deben ocultar fallas de autorización o mutaciones fallidas.
- El refresh de Investigación se autoriza y limita por usuario; cualquier proceso cron usa una función interna explícita de sistema, sin llamar accidentalmente a una query de sesión que no existe en background.
- Datos privados no entran en cachés públicas o claves globales. En primera entrega usar consultas privadas sin caché compartida y HTTP `private, no-store` donde aplique. `React.cache` puede deduplicar dentro del render; no equivale a una caché global.
- Si luego se introduce caché persistente por usuario, verificar autorización antes del acceso, incluir ownerId en claves/tags y definir invalidación por usuario. No cachear tokens ni DTO financieros dentro del shell público.
- Vaciar consultas y estado privado del navegador al salir/cambiar cuenta; separar claves de almacenamiento de costo promedio por usuario autenticado y retirar la clave `legacy`. No importar automáticamente datos de localStorage previo.

`next.config.ts` no activa actualmente Cache Components. No introducir esa migración como parte de seguridad. Si cambia esa configuración, aplicar las guías locales sobre cookies async, Suspense y caché privada antes de modificar renderizado.

## 7. P1: IOL opcional y eliminación completa de legacy

`connectIol` exige `requireUser()` antes de crear la autorización pendiente. El callback comprueba sesión Mirador válida, mismo userId, state/cookie, expiración y consumo único. Cambio de cuenta o logout entre inicio y callback cancela el flujo.

`disconnectIol` elimina únicamente la conexión y autorizaciones pendientes del usuario y, donde el proveedor lo soporte, revoca tokens. Conserva cuenta Mirador, sesión, listas y posiciones. Logout revoca la sesión Mirador y limpia estado local; la retención de conexión OAuth se define explícitamente y no implica poder consultarla sin login.

Mantener cifrado de access/refresh tokens, PKCE, locks de renovación y allowlist de lectura. Tokens, verificadores y códigos nunca aparecen en props, RSC, navegador ni logs. Todas las llamadas privadas obtienen el userId de la sesión validada. Ningún fallback carga otra cuenta si falla OAuth.

Extraer `BrokerHolding`/`BrokerCash` a un módulo neutro de tipos antes de retirar `src/lib/market/iol.ts`. Quitar sus imports y selección en `src/lib/market/index.ts`, consultas legacy, estado global de tokens, variables, textos de ajustes/footer, ejemplos y documentación. Las cotizaciones públicas usan los proveedores públicos existentes; validar que panel, histórico, búsqueda e instrumentos sigan funcionando.

Separar configuración:

- Development: base, secreto de cifrado y callback local propios.
- Preview: base y secreto aislados; callback permitido explícito o integración IOL deshabilitada.
- Production: base, secreto y origen/callback productivos; ningún secreto del bróker en variables `NEXT_PUBLIC_*`.
- Secretos de autenticación, cifrado IOL, cron y webhook tienen propósitos distintos. No reutilizar ni rotar el secreto de cifrado IOL sin un plan para tokens ya cifrados.
- `.env.example` solo contiene nombres y valores de ejemplo; inventario final de variables por nombre/entorno, nunca valores.

## 8. P1: Telegram y procesos de sistema

Sustituir código global por nonce aleatorio, hash almacenado, usuario asociado, expiración breve y consumo único. El webhook valida su secreto y vincula el chat únicamente al dueño del nonce; definir política para un chat ya asociado a otra cuenta. `/stop` desvincula el vínculo correspondiente a ese chat.

El evaluador puede recorrer alertas de todos los usuarios como proceso de sistema, pero crea notificaciones con ownerId de la alerta y agrupa envíos por propietario y su chat. Excluir datos en cuarentena y cuentas inhabilitadas. Mantener control de concurrencia para no duplicar disparos.

Registro global del webhook queda para OWNER o configuración de despliegue. Vincular, desvincular y probar Telegram son operaciones individuales. La URL del webhook sale del origen configurado, no del Host recibido. Pruebas de integración usan transporte falso; no enviar mensajes reales durante implementación.

## 9. P2: reconciliación del total del portafolio

Desacoplar este trabajo de la contención; no alterar cifras para alcanzar aproximadamente 10 M.

1. Definir DTO que distinga tenencias, efectivo, patrimonio informado, moneda, país/cuenta, momento y estado parcial. “Total” y “disponible” no son intercambiables.
2. Obtener documentación oficial del contrato y fixtures sanitizados autorizados. Confirmar si `totals` incluye títulos y si `t0..t3` son saldos acumulativos, independientes o vencimientos. No afirmar esa semántica a partir del nombre del campo.
3. Reconstruir el total con componentes identificados: tenencias por moneda + efectivo confirmado + posiciones manuales explícitamente incluidas. El patrimonio informado por el bróker sirve de comparación y no se suma otra vez como efectivo.
4. Revisar duplicados por país/cuenta, instrumentos manuales que representan las mismas tenencias, bonos por lote/nominal, moneda de cotización y conversión ARS/USD. Si hay duplicación manual, dar control explícito de inclusión; no borrar ni deduplicar posiciones por símbolo sin evidencia.
5. Ante saldo de semántica desconocida o fallos parciales, mostrar subtotal de tenencias y estado incompleto; no presentar un total global exacto con cero inventado.
6. Mostrar desglose, fuente, moneda y hora para comparar con IOL al mismo momento. Documentar fórmula y diferencias comprobadas. Pruebas con fixtures sustentan el contrato; reemplazar el test que solo reafirma la suma t0..t3 si el contrato indica otra cosa.

## 10. Delegación por archivos y dependencias

La implementación se delega después de identificar el orquestador Google que el usuario desea. GSD bajo `.gemini/antigravity` es un candidato hallado por el coordinador, no una confirmación de su elección. No iniciar otro orquestador por equivalencia supuesta.

El coordinador conserva contrato transversal, secuencia de migración, configuración remota, `package.json`/lockfile y resolución de integración. Cada tarea recibe diff base y aceptación; ningún agente revierte modificaciones ajenas.

| Tarea | Archivos/responsabilidad exclusiva | Dependencia y aceptación |
| --- | --- | --- |
| A. Datos | `prisma/schema.prisma`, nuevas migraciones, seed y script de migración explícita | Fijar contrato primero; migración ensayada conserva registros y aísla los sin dueño |
| B. Identidad | `src/server/auth/**`, nuevas páginas/componentes auth, rutas auth, pruebas de sesión | A y biblioteca elegida; Google OIDC, alta/login solo de los dos correos verificados, logout independiente de IOL, sesiones antiguas rechazadas |
| C. Autorización y UI | `src/server/queries.ts`, `src/server/actions.ts`, `src/server/research-table.ts`, páginas `(app)`, shell, provider privado, botones favoritos, proxy y pruebas | A/B y DTO neutro de D; autorización e aislamiento A/B en cada entrada; portfolio page pertenece solo a C |
| D. IOL y mercado | `src/server/iol/**`, callback IOL, `src/lib/market/iol.ts`, `src/lib/market/index.ts`, nuevo módulo neutro de tipos y pruebas IOL | B; sin password grant ni fallback; disconnect conserva cuenta y datos |
| E. Telegram | `src/server/evaluate-alerts.ts`, `src/lib/telegram.ts`, rutas cron/webhook, componentes Telegram, nuevo servicio de vínculo y pruebas | A/B; C integra las acciones como wrappers a ese servicio; cero envíos cruzados |
| F. Entornos y despliegue | `src/lib/env.ts`, `.env*` existentes, README, Docker/Compose, metadatos Vercel y despliegue | Coordinador; elimina solo credenciales legacy, conserva OAuth, destino verificado |
| G. Valuación | `src/server/iol/portfolio.ts`, pruebas de mapeo, `src/lib/portfolio*.ts`, componentes de portafolio | Secuencial después de D/C para no compartir archivos activos; contrato de saldo comprobado |
| H. Revisión independiente | Lectura del diff y pruebas de aceptación; informe sin editar archivos de otros | Después de integración; modelo distinto al implementador, foco en sesión/IDOR/caché/migración |

A/B necesitan serializar el contrato y cambios Prisma; C/D/E pueden avanzar después con archivos separados. G toma ownership de archivos de D/C solo cuando esas tareas terminan. F coordina cambios de entorno con todos, sin dejar un build que espere variables eliminadas. La selección de modelos más económicos queda en el orquestador elegido; la revisión de seguridad debe tener contexto nuevo.

## 11. Pruebas y aceptación antes de abrir el acceso privado

Usar dos usuarios ficticios A/B, un OWNER y filas antiguas en cuarentena. Transporte IOL/Telegram falso; ninguna operación de trading.

- Visitante navega las cinco áreas públicas y sus APIs. Las cinco áreas privadas redirigen al login o rechazan acceso antes de consultar datos privados, también en RSC, prefetch y URLs profundas.
- Una cuenta nueva sin IOL accede a sus pantallas privadas vacías y puede crear listas, posiciones y alertas.
- Google permite únicamente los dos correos exactos verificados y crea dos cuentas separadas. Otro correo, `email_verified` falso/ausente, firma/issuer/audience inválidos, token expirado, state/nonce inválidos o replay no crean cuenta ni sesión.
- El login repetido del mismo `sub` conserva su cuenta; el cambio entre las dos cuentas renueva sesión y limpia estado privado. Retirar un correo de la lista bloquea sus sesiones; configuración ausente falla cerrada.
- Correo no autorizado recibe rechazo y opción de cambiar cuenta, sin descubrir la lista permitida. Ninguno de los dos usuarios recibe OWNER, datos legacy ni una conexión IOL automáticamente.
- A no puede leer/modificar/borrar registros de B pasando ids ni mediante variantes de acciones sin id de lista. OWNER tampoco puede acceder a la cartera de B.
- HTML, JSON, RSC, contador, notificaciones, Inicio, búsqueda personalizada y cachés no mezclan A/B. Logout/login B en el mismo navegador no muestra estado ni PPC de A.
- Sesión ausente, caducada, revocada y anónima antigua se rechazan. Los errores de base no conceden acceso.
- OAuth rechaza state repetido/expirado, callback sin sesión, cuenta distinta, returnTo externo y falta de cookie. Desconectar IOL conserva cuenta y posiciones. Herramientas fuera de allowlist no tocan la red.
- Fixtures demuestran que los tokens quedan cifrados; inspección de respuestas/logs no encuentra secretos. No probar con credenciales reales.
- Alertas y Telegram respetan ownerId, consumo de nonce y destinatario; cuarentena nunca envía.
- Migración conserva conteos, no asigna propietario por orden de registro y se puede ensayar/restaurar. Se documenta compatibilidad del rollback.
- Búsqueda de referencias activas elimina `IOL_USERNAME`, `IOL_PASSWORD`, password grant, `hasIol` legacy y cartera global. Las menciones históricas en este plan pueden permanecer; no constituyen configuración.
- Ejecutar pruebas existentes relevantes, nuevas pruebas de autenticación/autorización/migración, lint y build. No dar por aprobado por compilar únicamente.

Despliegue: contención primero; luego migraciones aditivas con área privada cerrada; build integrado en preview aislado; pruebas anónimo/A/B; despliegue al proyecto confirmado; verificación en dominio real; finalmente apertura de login y acceso privado. Evitar que una app vieja con queries globales conviva con nuevos datos multicuenta. Si falla una fase, conservar contención y corregir hacia adelante.

## 12. Ajustes de revisión independiente (Sol high)

Estos requisitos complementan el plan y deben entrar en los criterios de aceptación:

- `completeAuthorization` debe rechazar `sessionUserId === null` dentro del servicio, antes de consumir el flujo o canjear el código. No basta con exigir sesión en el Route Handler. Probar directamente el servicio con sesión ausente y con usuario diferente.
- Preservar la fila `Setting` singleton existente en cuarentena o en una copia de migración. No asignar implícitamente su `telegramChatId`, preferencias o códigos de vinculación a una cuenta nueva. Requerir atribución verificada de preferencias y nueva vinculación Telegram.
- El esquema debe distinguir inequívocamente identidades anónimas legacy de cuentas Mirador autenticables. `getCurrentUser` debe rechazar identidades legacy aunque exista una cookie o sesión anterior. Retirar la limpieza de `getOrCreateIdentity` antes de crear cuentas reales.
- El corte P0 debe estar activo en el proyecto productivo confirmado antes de abrir altas o introducir datos multicuenta. Verificar también los despliegues antiguos accesibles y cerrar su acceso antes de que puedan consultar los datos nuevos.
- La tarea C es dueña de `src/app/(app)/settings/page.tsx`, `src/app/(app)/alerts/page.tsx` y todos los wrappers de `src/server/actions.ts`. La tarea E es dueña del servicio nuevo de vinculación Telegram, del transporte y de los componentes específicos de Telegram que se inventariarán antes de despachar E. C integra sus imports; E no edita esas páginas ni los wrappers.

Plan redactado por Astra high y revisado por Sol high. Esta revisión no constituye implementación ni validación de seguridad del despliegue actual.

## 13. Decisiones pendientes mínimas

1. Confirmar orquestador Google y modelos disponibles para implementar/revisar; este plan no lo ejecuta.
2. Confirmar identidad que recibirá OWNER y pertenencia de registros antiguos antes de cualquier asignación. Hasta entonces quedan aislados; ambos usuarios nuevos tienen rol USER.
3. Preparar clientes/callbacks Google por entorno. El proyecto Vercel `mirador-inversiones` quedó confirmado; GitHub redirige el remoto local `track-inversiones` al mismo repositorio y `main` coincidía con `c49e5ca` antes de publicar este corte.
4. Para cerrar la diferencia del total, disponer del contrato IOL y evidencia sanitizada autorizada; mientras falten, no declarar una causa ni una cifra corregida.

El usuario autorizó la implementación. La ejecución y sus pendientes se registran a continuación.

## 14. Estado de ejecución (2026-10-20)

- Implementados login Google OIDC para los dos correos acordados, sesiones Mirador revocables, separación por `ownerId` en consultas y acciones, conexión IOL por usuario sin password grant, Telegram por usuario y migración aditiva. Los registros viejos permanecen sin propietario.
- Eliminadas `IOL_USERNAME`, `IOL_PASSWORD`, `APP_ACCESS_USER` y `APP_ACCESS_PASSWORD` de la configuración local y de Vercel; la lista de variables de los entornos se verificó sin mostrar valores.
- Se desplegó el corte de seguridad directo al proyecto Vercel `mirador-inversiones`, despliegue `dpl_9paJ7CZADdf9fiNbTVh7prAF8aUi`. El dominio productivo respondió 200 para las áreas públicas y 307 hacia `/login` para las cinco privadas sin sesión; la URL de despliegue anterior probada respondió 302 de protección.
- Prisma aplicó las cinco migraciones correctamente a una base Docker aislada, luego eliminada. TypeScript, build y 140 pruebas pasaron; una prueba con sesiones ficticias A/B confirmó que cada uno ve solo su lista y que la fila legacy no aparece.
- La revisión automática rechazó exportar un respaldo completo de Neon a un archivo local por posible contenido personal y tokens. No se ejecutó esa exportación ni la nueva migración en producción; se solicitó autorización específica para el respaldo.
- El login productivo permanece cerrado porque faltan `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en Vercel. `MIRADOR_APP_URL` ya se cargó en Production y entrará en vigor con el próximo despliegue. La atribución de datos antiguos y el rol OWNER siguen pendientes de confirmar titularidad. La cifra anterior de cartera no se declaró corregida; la pantalla ahora muestra subtotal de tenencias sin sumar `cash.total` ambiguo y avisa sobre posibles duplicados manuales.
