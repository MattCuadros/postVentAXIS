---
name: formato-axis
description: Aplica el manual de marca de Axis Desarrollos Constructivos (colores oficiales, logo, tipografía, huincha tricolor, frase "Construimos cambios", pie corporativo) a cualquier cosa que se haga para Axis — aplicaciones web y sus pantallas, componentes, dashboards, presentaciones, documentos Word/PDF, correos, comunicados, planillas, afiches o mockups. Úsala SIEMPRE que el usuario diga "para Axis", "formato Axis", "marca Axis", "estilo Axis", "corporativo Axis" o cuando el trabajo sea claramente de Axis (postventa Axis, obras Axis, formularios AXIS-SGC, comunicados internos), aunque no pida el formato explícitamente. En trabajos de Axis tiene prioridad sobre cualquier otro estilo visual del proyecto (por ejemplo, apple-design-style).
---

# Formato Axis

Resumen operativo del *Manual de Uso de Marca AXIS 2024 (v3)*. El objetivo es que todo lo que se produzca para Axis se reconozca como Axis a primera vista, sin alterar la marca.

## 1. Colores oficiales

Usa estos valores literalmente. El manual pide usar **solo** los valores RGB para cualquier soporte digital.

| Rol | Nombre | HEX | Pantone | CMYK |
|---|---|---|---|---|
| Primario | Azul Axis | `#003399` | 293 C | 100/70/1/0 |
| Acento | Naranjo Axis | `#FF6600` | 021 Orange C | 2/80/100/0 |
| Neutro de marca | Gris concreto | `#CCCCCC` | 427 C | K 20% |

Colores de apoyo para interfaces (derivados, no son de marca; úsalos solo para texto, fondos y estados):

- Texto principal `#1A1A1A`, texto secundario `#4D4D4D`, texto tenue `#737373`.
- Fondos: blanco `#FFFFFF`, gris claro de banda `#F2F2F2`, carbón `#1E1E1E` (el negro que usa el manual en fondos).
- Estados de UI: éxito `#1E8E3E`, advertencia `#B26A00`, error `#C62828`. El naranjo es de marca, **no** lo uses para errores.

Reglas de uso:

- El **azul** es el color dominante: títulos, encabezados, botones principales, barras de navegación, bloques de fondo.
- El **naranjo** es acento puntual: la primera línea de un título, un subtítulo destacado, una barra vertical, un indicador. Nunca como fondo grande detrás del logo.
- El **gris** evoca el "bloque de concreto" del logo: fondos de bandas, pie de página, contenedores suaves.

Tokens listos en `references/axis-tokens.json` y `references/axis-tokens.css`.

## 2. Logo

Archivos en `assets/`: `logo-axis-600.png` (web/pantallas), `logo-axis-300.png` (miniaturas), `logo-axis-alta.jpg` (impresión/Word).

- Es un bloque: rectángulo gris con el recuadro azul "AXIS", la línea naranja y la bajada "DESARROLLOS CONSTRUCTIVOS". **No se redibuja, no se recolorea, no se deforma, no se rota** y no se le agregan sombras ni efectos. Siempre se inserta la imagen original, escalando proporcionalmente.
- **Área de resguardo:** alrededor del logo deja libre un espacio "X" (≈ la altura de la letra X del logotipo; en la práctica, ~12% del ancho del logo) sin texto ni elementos.
- **Tamaño mínimo:** impreso 25 mm de ancho con bajada; bajo eso (hasta 15 mm) solo sin la bajada. En pantalla, no bajes de ~120 px de ancho con bajada.
- **Fondos permitidos:** blanco, gris de marca, azul de marca y carbón/negro, o fotografías aplicadas fuera del área de resguardo. En fondos de otros colores se prioriza la legibilidad.
- **Usos prohibidos:** invertir los colores del logo (gris↔azul), cambiar la línea naranja a otro color, poner el logo sobre fondo naranjo, o combinaciones que no estén en el manual.
- El logo de 35 años solo se usa con autorización del Área de Comunicaciones: no lo generes por iniciativa propia.

## 3. Tipografía

- Logotipo: Helvetica Neue LT Pro 93 Black Extended (solo en el logo; no se imita en títulos).
- Frase de apoyo y titulares: Helvetica Neue Bold.
- Texto corporativo: el manual sugiere Arial, Calibri o Century Gothic.

Stacks recomendados:

- Web/app: `"Helvetica Neue", Helvetica, Arial, sans-serif` para todo; títulos en 700, cuerpo en 400.
- Word/PowerPoint: Arial (títulos en negrita, azul) o Calibri para cuerpo.

No uses tipografías decorativas, serif ni monoespaciadas en piezas de marca (monoespaciada solo para código real).

## 4. Elementos gráficos de apoyo

1. **Huincha tricolor.** Barra horizontal gris → azul → naranjo, en proporciones aproximadas 58% / 30% / 12%, de izquierda a derecha. Va al pie de páginas, documentos y correos. Es el recurso más reconocible de la papelería Axis: úsalo en todo documento o pantalla de inicio.
2. **Línea divisoria naranja.** Filete delgado (1–2 px) naranjo que separa secciones grandes.
3. **Bloque "Construimos cambios".** Barra vertical naranja + "Construimos cambios" en naranjo + "que trascienden para el futuro sostenible de nuestra sociedad." en azul, en negrita. Usa `assets/construimos-cambios.png` o recréalo con texto real respetando esos colores. Va en pies de documentos, portadas y cierres.
4. **Bloques redondeados inclinados.** En portadas y comunicados, rectángulos de esquinas redondeadas en azul y naranjo, levemente rotados, combinados con fotografías de obra recortadas con la misma forma. Úsalos en portadas y piezas de comunicación, no dentro de interfaces operativas.
5. **Pie corporativo.** Banda gris clara con el bloque "Construimos cambios" a la izquierda, el logo a la derecha y una línea azul al borde inferior.


## 5. Composición: proporción áurea + disciplina tipo Apple

La identidad (colores, logo, tipografía, huincha) es 100% Axis. La composición toma dos principios que no chocan con el manual:

- **Proporción áurea (φ ≈ 1,618).** Divide el espacio en razón 1 : 1,618. En una lámina de 1920 px: columnas de 1187 px y 733 px (por ejemplo, contenido a la izquierda y bloque azul de marca a la derecha en la portada; título y contenido en láminas de dos columnas). Escala tipográfica φ: 24 · 39 · 63 · 102 · 165 px (en web: 16 · 26 · 42 · 68 px). Espaciados φ: 15 · 24 · 39 · 63 px.
- **Disciplina Apple.** Una idea por lámina o pantalla, mucho aire, titulares grandes y cortos alineados a la izquierda, bandas de fondo alternadas: blanco, gris claro `#F2F2F2` y **azul Axis** (el azul cumple el rol que el negro tiene en Apple). Nada de sombras ni degradados decorativos.
- **Motivos de marca como acentos.** La barra naranja redondeada del logo se usa como subrayado bajo titulares (ancho 382 px ≈ 1187/φ²). Los antetítulos llevan una barra vertical naranja + texto azul bold, en eco del bloque "Construimos cambios". El naranjo nunca va como texto informativo.
- **Pie constante.** En láminas claras: bloque "Construimos cambios" a la izquierda, logo a la derecha y huincha tricolor al borde inferior. En láminas azules: logo y huincha (la frase azul no se lee sobre azul).

## 6. Tono

Profesional, directo y cercano; en español de Chile. La frase institucional es "Construimos cambios que trascienden para el futuro sostenible de nuestra sociedad." y el sitio oficial es www.axisdc.cl. Evita superlativos de marketing.

## 7. Cómo aplicarlo según el entregable

Lee `references/aplicaciones.md` para el detalle de cada caso. En corto:

- **Apps y sitios web:** barra superior blanca con logo a la izquierda (o azul con el logo sobre su gris, que es un fondo permitido), botones primarios azules, acentos naranjos puntuales, huincha tricolor en el pie o bajo la barra superior de la pantalla de inicio de sesión. Tokens en `references/axis-tokens.css`.
- **Presentaciones:** portada blanca con bloques inclinados azul/naranjo y fotos, título en naranjo y subtítulo en azul, bloque "Construimos cambios" y logo al pie, línea azul inferior.
- **Documentos (Word/PDF, hoja carta):** logo arriba a la derecha, contenido en Arial, pie con bloque "Construimos cambios" y huincha/línea azul inferior.
- **Correos:** cuerpo limpio y cierre con huincha tricolor sobre la firma.

## 8. Checklist antes de entregar

- [ ] Solo `#003399`, `#FF6600` y `#CCCCCC` como colores de marca; naranjo solo como acento.
- [ ] Logo original, sin alterar, con área de resguardo y sobre un fondo permitido.
- [ ] Tipografía Helvetica Neue / Arial.
- [ ] Huincha tricolor o pie corporativo presente en documentos y pantallas de portada.
- [ ] Composición en proporción áurea y una idea por lámina/pantalla.
- [ ] Contraste legible (texto azul o casi negro sobre blanco/gris claro; blanco sobre azul).

## Fuera de alcance

Letreros de obra, adhesivos de vehículos, maquinaria, ropa de trabajo y merchandising tienen medidas fijas que **no pueden modificarse** y sus archivos de impresión se piden al Área de Comunicaciones (Axiscomunicaciones@axisdc.cl). Si piden algo así, indícalo en vez de diseñarlo.
