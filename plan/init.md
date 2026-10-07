# App de análisis de inversiones — resumen del video y requerimientos

Oct 6, 2026 · @Nico

El video muestra Vantage, un dashboard web para seguir el mercado, armar listas de favoritos, llevar una cartera cargada a mano y crear alertas de precio. Corre como demo, con cotizaciones simuladas de acciones de EE.UU. Para tu app sirve casi toda la estructura: lo que falta es el universo argentino (CEDEARs, acciones, bonos, dólar MEP/CCL), datos en tiempo real y una ayuda que explique cada dato en lenguaje simple.

## Qué hace la app del video

Vantage es un tracker personal para un inversor individual: muestra el mercado, guarda favoritos y calcula el rendimiento de una cartera. No opera ni se conecta a un bróker. En la grabación (30 segundos, sin audio) todo es demo: los precios son simulados y los datos se guardan en el navegador.

| Pantalla | Qué muestra | Qué se puede hacer |
| --- | --- | --- |
| Overview | Tres tarjetas de índices (S&P 500, Nasdaq, Dow Jones) con valor, variación y mini gráfico. Gráfico del activo elegido con apertura, máximo, mínimo, cierre anterior y volumen. Panel de favoritos, ranking de movimientos y tres noticias. | Elegir un activo de favoritos para cambiar el gráfico. Cambiar rango (1D, 1W, 1M, 3M, 6M, 1Y, ALL). Alternar línea y velas. Pantalla completa. Menú con "crear alerta" y "exportar datos". Pausar el feed en vivo. |
| Markets | Los mismos índices y una tabla de 15 empresas: bolsa, precio, variación, volumen, capitalización y tendencia. | Filtrar por sector (Technology, Consumer, Finance, Energy). Buscar una empresa. Ordenar por columna. Crear alerta desde la campanita de cada fila. |
| Watchlist | Listas de favoritos en pestañas con contador (My watchlist 10, Tech leaders 6) y la misma tabla de Markets. | Crear una lista nueva. Editar los símbolos. Quitar un favorito con la estrella. Crear alerta. |
| Portfolio | Valor total, retorno histórico en dólares y en porcentaje, total invertido. Gráfico de una posición. Tabla de posiciones: cantidad, costo promedio, valor de mercado, retorno y porcentaje de la cartera. | Agregar una posición. Eliminarla. Exportar las posiciones. |
| News & insights | Una nota destacada y una grilla de notas con categoría, fuente y antigüedad. | Filtrar por categoría (Markets, Technology, Economy). Abrir una nota. Botón "Daily briefing". |
| Price alerts | La pantalla no se abre en el video; se ve el contador (3) en el menú y el formulario de creación. | Elegir el activo, la condición ("el precio sube por encima de") y el precio objetivo, que viene precargado un 2% arriba del actual. |

Todas las pantallas comparten un menú lateral con accesos directos a las listas, un buscador global (Ctrl K), campanita de notificaciones, perfil con nombre y email, y un pie con el estado del sistema y la hora de la última actualización.

## Requerimientos funcionales

Son 54: 31 para la primera versión (MVP), 18 para una segunda y 5 para más adelante. La prioridad es una propuesta; cambiala desde el desplegable. La última columna dice si el requerimiento sale del video o es un agregado para el mercado argentino.

### A. Instrumentos y datos de mercado

| ID | Requerimiento | Prioridad | En el video |
| --- | --- | --- | --- |
| RF-01 | Catálogo de instrumentos por tipo: CEDEAR, acción local, bono soberano, obligación negociable, letra y FCI. Cada uno con ticker, nombre, mercado y moneda. | MVP | No (solo acciones de EE.UU.) |
| RF-02 | Cotización por instrumento: último precio, variación del día en monto y porcentaje, apertura, máximo, mínimo, cierre anterior y volumen. | MVP | Sí |
| RF-03 | Histórico de precios por rango: 1 día, 1 semana, 1, 3 y 6 meses, 1 año y todo. | MVP | Sí |
| RF-04 | Actualización periódica de precios, con hora de la última actualización visible y botón para pausar. | MVP | Sí |
| RF-05 | Tarjetas de referencia en el inicio: Merval, dólar MEP, dólar CCL y riesgo país. | MVP | Parcial (usa S&P 500, Nasdaq y Dow Jones) |
| RF-06 | Buscador global por ticker o nombre, con atajo de teclado. | MVP | Sí |
| RF-07 | Selector de moneda de visualización: pesos, dólar MEP o dólar CCL. | V2 | No (todo en USD) |

### B. Explorador de mercado

| ID | Requerimiento | Prioridad | En el video |
| --- | --- | --- | --- |
| RF-08 | Tabla de instrumentos con precio, variación, volumen y tendencia (mini gráfico), ordenable por columna. | MVP | Sí |
| RF-09 | Filtro por tipo de activo (CEDEARs, bonos, acciones) y, dentro de cada tipo, por sector, emisor o ley. | MVP | Parcial (filtra solo por sector) |
| RF-10 | Búsqueda dentro de la tabla. | MVP | Sí |
| RF-11 | Ranking de movimientos: más operados, mayores subas y mayores bajas. | V2 | Sí |
| RF-12 | Acciones por fila: agregar a favoritos y crear alerta. | MVP | Sí |

### C. Detalle y análisis de un instrumento

| ID | Requerimiento | Prioridad | En el video |
| --- | --- | --- | --- |
| RF-13 | Gráfico de precio con vista de línea y de velas, selector de rango, tooltip con fecha y precio, pantalla completa y estadísticas del día debajo. | MVP | Sí |
| RF-50 | Indicadores técnicos básicos sobre el gráfico: medias móviles y volumen. | MVP | No |
| RF-51 | Indicadores técnicos avanzados (RSI, MACD, bandas de Bollinger) y líneas de tendencia dibujadas a mano. | V2 | No |
| RF-52 | Ratios fundamentales de acciones y CEDEARs: PER (P/E), ganancia por acción, rendimiento por dividendo, precio sobre valor libro, ROE y deuda sobre patrimonio. | MVP | No (solo muestra capitalización) |
| RF-14 | Exportar los datos del gráfico a CSV. | V2 | Sí |
| RF-15 | Ficha de CEDEAR: subyacente, ratio de conversión, precio del subyacente en USD, CCL implícito y brecha contra el CCL de referencia. | MVP | No |
| RF-16 | Ficha de bono: TIR, paridad, duration, valor técnico, cupón, ley, moneda de pago, vencimiento y cronograma de pagos. | MVP | No |
| RF-17 | Comparar dos o más instrumentos en un mismo gráfico, con rendimiento en base 100. | V2 | No |
| RF-18 | Curva de rendimientos de bonos: TIR contra duration. | V2 | No |

### D. Favoritos

| ID | Requerimiento | Prioridad | En el video |
| --- | --- | --- | --- |
| RF-19 | Marcar y desmarcar un favorito con la estrella, desde cualquier tabla o ficha. | MVP | Sí |
| RF-20 | Varias listas con nombre propio: crear, renombrar y eliminar. | MVP | Sí |
| RF-21 | Vista de cada lista con la tabla del explorador y contador de símbolos. | MVP | Sí |
| RF-22 | Acceso directo a las listas desde el menú lateral y panel de favoritos en el inicio; al elegir un activo se actualiza el gráfico. | MVP | Sí |
| RF-23 | Listas que mezclan tipos de activo y muestran columnas acordes: TIR para bonos, ratio para CEDEARs. | V2 | No |

### E. Cartera

| ID | Requerimiento | Prioridad | En el video |
| --- | --- | --- | --- |
| RF-24 | Carga manual de posiciones: instrumento, cantidad, precio promedio de compra y fecha. | MVP | Sí (el formulario no se abre) |
| RF-25 | Resumen de la cartera: valor total, total invertido y retorno en monto y porcentaje. | MVP | Sí |
| RF-26 | Tabla de posiciones: cantidad, costo promedio, valor de mercado, retorno y porcentaje de la cartera; eliminar una posición. | MVP | Sí |
| RF-27 | Exportar las posiciones a CSV. | V2 | Sí |
| RF-28 | Distribución de la cartera por tipo de activo y por moneda. | V2 | No |
| RF-29 | Valuación de la cartera en pesos y en dólares (MEP o CCL). | V2 | No |
| RF-30 | Importar las tenencias desde el bróker en lugar de cargarlas a mano. | Más adelante | No (aclara que no hay bróker conectado) |
| RF-31 | Calendario de cobros de cupones y amortizaciones de los bonos en cartera. | Más adelante | No |

### F. Alertas de precio

| ID | Requerimiento | Prioridad | En el video |
| --- | --- | --- | --- |
| RF-32 | Crear una alerta desde una fila, desde el menú del gráfico o desde la pantalla de alertas: instrumento, condición (sube por encima de, baja por debajo de) y valor objetivo precargado cerca del precio actual. | MVP | Sí (solo se ve "sube por encima de") |
| RF-33 | Listado de alertas activas y disparadas, con contador en el menú; editar y eliminar. | MVP | Parcial (se ve el contador, no la pantalla) |
| RF-34 | Notificación dentro de la app cuando una alerta se dispara, con el instrumento, el precio alcanzado y la hora. | MVP | Parcial (se ve la campanita, no un aviso) |
| RF-36 | Notificación por email o push con la app cerrada; exige evaluar las alertas en el servidor. | MVP | No (solo evalúa con la app abierta) |
| RF-35 | Alertas por variación porcentual y, en bonos, por TIR o paridad. | V2 | No |

### G. Noticias

| ID | Requerimiento | Prioridad | En el video |
| --- | --- | --- | --- |
| RF-37 | Feed de noticias con nota destacada, categoría, fuente y antigüedad; filtro por categoría. | V2 | Sí |
| RF-38 | Noticias relacionadas con los instrumentos de favoritos y de la cartera. | Más adelante | No |
| RF-39 | Resumen diario del mercado. | Más adelante | Parcial (se ve el botón "Daily briefing") |

### H. Cuenta y configuración

| ID | Requerimiento | Prioridad | En el video |
| --- | --- | --- | --- |
| RF-40 | Perfil con nombre y email. | MVP | Sí |
| RF-41 | Registro e inicio de sesión, con favoritos, cartera y alertas guardados en servidor. | V2 | No (guarda todo en el navegador) |
| RF-42 | Personalizar el inicio: qué paneles se muestran y en qué orden. | Más adelante | Parcial (se ve el botón "Customize") |
| RF-43 | Preferencias: moneda por defecto, tema claro u oscuro y frecuencia de actualización. | V2 | No (Settings no se abre) |

### I. Ayuda para aprender y decidir

Nada de esto está en el video: es lo que convierte al tracker en una herramienta para decidir sin ser experto.

| ID | Requerimiento | Prioridad | En el video |
| --- | --- | --- | --- |
| RF-44 | Ayuda en cada dato: un ícono junto a cada valor (PER, TIR, paridad, ratio, volumen, variación) que explica en lenguaje simple qué es, cómo se lee y por qué importa. | MVP | No |
| RF-45 | Glosario buscable de términos: CEDEAR, bono, obligación negociable, PER, TIR, duration, MEP, CCL. | MVP | No |
| RF-46 | Ficha "qué es" de cada instrumento en lenguaje simple: qué es, quién lo emite, en qué moneda paga, de qué depende su precio y cuáles son sus riesgos. | MVP | No |
| RF-53 | Sección "Aprender" con guías paso a paso: cómo analizar una acción o un CEDEAR, cómo analizar un bono y cómo leer un gráfico de velas. | MVP | No |
| RF-54 | Análisis guiado de un instrumento: recorre la guía con los datos reales de ese activo y marca qué mirar en cada paso. | V2 | No |
| RF-47 | Lectura en contexto de cada indicador: lo compara con su propio histórico y con instrumentos similares, y lo dice en una frase ("el volumen de hoy duplica el promedio del mes"). | V2 | No |
| RF-48 | Resumen diario de tus favoritos y tu cartera: qué se movió, cuánto y qué noticias lo acompañan. | V2 | No |
| RF-49 | Asistente de preguntas en lenguaje natural sobre un instrumento o sobre tu cartera, con respuestas apoyadas en los datos de la app. | V2 | No |

## Requerimientos no funcionales

| ID | Requerimiento |
| --- | --- |
| RNF-01 | Transparencia del dato: cada cotización muestra su origen, su hora y si tiene demora. |
| RNF-02 | Fuente de datos desacoplada: un adaptador por proveedor, para cambiar de fuente sin tocar la interfaz, y caché para respetar los límites de la API. |
| RNF-03 | Credenciales del proveedor de datos solo en el backend, nunca en el navegador. |
| RNF-04 | Importes con decimales exactos (sin punto flotante) y moneda explícita en cada valor. |
| RNF-05 | Estados de carga, vacío y error en cada panel: sin datos, mercado cerrado o proveedor caído. |
| RNF-06 | Tablas de cientos de instrumentos que ordenan y filtran sin recargar la página. |
| RNF-07 | Interfaz en español con formato numérico argentino (1.234,56). |
| RNF-08 | La ayuda explica y da contexto mostrando en qué se basa. La app no ejecuta operaciones y la decisión queda en tus manos. |
| RNF-09 | Diseño en la línea del video: menú lateral fijo, tarjetas de resumen, tablas con mini gráficos, un panel de gráfico grande y un solo color de acento, con nombre y marca propios. |

## Lo que el video no muestra

Varias partes aparecen solo como botón o ítem de menú, así que sus requerimientos están inferidos y no observados: la pantalla de Price alerts, Settings, Customize, los formularios de "Add position", "Manage watchlist", "Edit symbols" y "New list", los resultados del buscador, el panel de notificaciones y el "Daily briefing". Tampoco se ve la versión mobile.

## Decisiones abiertas

- [x] Uso personal, según lo que contaste: el login y el guardado en servidor (RF-41) quedan fuera del MVP.
- [ ] ¿Qué fuente de datos? Pediste tiempo real: de las dos revisadas, la API de IOL lo da con solo tener cuenta. Falta confirmar costo y límites de uso.
- [ ] ¿Qué tipos de activo entran primero? Con CEDEARs, acciones y bonos soberanos ya se cubre lo que pediste.
- [ ] ¿Solo seguimiento o también importar la cartera real del bróker (RF-30)?
- [ ] ¿Hace falta mobile o alcanza con desktop, como en el video?
- [ ] ¿Entran las noticias? Es el módulo que menos aporta al análisis.

## Fuentes de datos a evaluar

Es la diferencia más grande con el video, que no usa datos reales. Revisé dos opciones; costos y límites de uso quedan por confirmar en cada una.

| Fuente | Qué ofrece | Condiciones |
| --- | --- | --- |
| [API de InvertirOnline](https://www.invertironline.com/api) | Cotizaciones en tiempo real e históricas del mercado argentino (acciones, bonos, opciones, cauciones, futuros, monedas), además de portafolio y operaciones. Responde en JSON y tiene entorno de pruebas. | Requiere una cuenta en IOL. El costo figura en su página de tarifas. Falta confirmar en la [documentación](https://api.invertironline.com/) la cobertura de CEDEARs y FCI. |
| [BYMA Market Data](https://www.byma.com.ar/productos/productos-de-datos) | Datos en tiempo real, con 20 minutos de demora, históricos, de cierre y de referencia de instrumentos. Acceso por API o por protocolo FIX. | El tiempo real exige un contrato de Market Data con BYMA (marketdata@byma.com.ar). |

El dólar MEP y el CCL no necesitan una fuente aparte: se calculan con los precios de un mismo bono en pesos y en dólares (por ejemplo AL30 contra AL30D y AL30C).

Los ratios fundamentales (PER, ganancia por acción, dividendos) son un dato aparte: no confirmé que estas dos fuentes los incluyan, así que puede hacer falta una tercera.
