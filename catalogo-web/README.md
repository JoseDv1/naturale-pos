# 🌿 Naturale - Catálogo Web para Clientes

Catálogo web independiente, liviano y moderno para **Naturale (Mercado Saludable & Café)**. Diseñado específicamente para clientes, mostrando el menú y productos con sus precios al consumidor y botones directos para ordenar por **WhatsApp**.

---

## 🚀 Características Principales

- **Completamente independiente del POS**: No requiere base de datos en vivo, ni autenticación, ni backend para funcionar.
- **Funciona sin servidor**: Puede abrirse directamente en cualquier navegador haciendo doble clic sobre `index.html` o servirse en la nube.
- **Conexión Directa a WhatsApp**:
  - Cada tarjeta de producto genera un mensaje personalizado pre-redactado con el nombre del producto, variante seleccionada, precio en COP y código de referencia.
  - Botón flotante para consultas generales y preguntas frecuentes.
- **Soporte para Variantes**: Si un producto tiene tamaños (ej. 350gr / 60gr) o sabores, el cliente puede alternar entre ellos viendo cómo cambia el precio y el pedido de WhatsApp de inmediato.
- **Buscador Instantáneo**: Búsqueda en tiempo real por nombre, categoría o palabra clave.
- **Filtros por Departamento y Categoría**: Filtro rápido entre *Todos*, *☕ Café* y *🛒 Mercado*, más carrusel de categorías con conteo de productos.
- **Diseño Editorial & Responsive**: Optimizado para celulares (la gran mayoría de clientes que piden por WhatsApp están en móviles) y computadores de escritorio.

---

## 📁 Estructura de Archivos

```text
catalogo-web/
├── index.html            # Estructura principal y maquetación web
├── styles.css            # Estilos botánicos, tipografía y responsive
├── app.js                # Lógica del catálogo (búsqueda, variantes, filtros, WhatsApp)
├── config.js             # Configuración de número de WhatsApp, textos y redes
├── README.md             # Esta documentación
└── data/
    ├── products.js       # Catálogo de productos exportado (embebido en JS para funcionar offline)
    └── products.json     # Catálogo en formato JSON estándar
```

---

## ⚙️ ¿Cómo Configurar el Número de WhatsApp y la Tienda?

Abre el archivo `config.js` con cualquier editor de texto o bloc de notas:

```javascript
window.CATALOG_CONFIG = {
  // Nombre de la tienda
  storeName: "Naturale",
  subtitle: "Mercado Saludable & Café",
  tagline: "Alimentación consciente, café de especialidad y bienestar.",

  // Número de WhatsApp al que llegarán los pedidos:
  // (Código de país sin el símbolo '+'. Ej: 57 para Colombia + celular de 10 dígitos)
  whatsappNumber: "573001234567",

  // Mensaje que verá el cliente prellenado en WhatsApp
  whatsappGreeting: "¡Hola Naturale! 🌿 Vengo del catálogo web y me interesa ordenar:",

  // Redes y ubicación
  social: {
    instagram: "https://instagram.com/naturale_col",
    location: "Guatapé, Antioquia, Colombia",
    hours: "Lunes a Domingo: 8:00 AM - 7:00 PM"
  }
};
```

Solo cambia `"573001234567"` por el número real del comercio.

---

## 🔄 ¿Cómo Actualizar los Productos y Precios del Catálogo?

En el proyecto del POS hay un script automático para exportar los productos de la base de datos local hacia el catálogo web:

```bash
bun run export:catalog
```

Este comando tomará todos los productos y variantes actuales de la base de datos SQLite y actualizará automáticamente tanto `data/odoo-catalog.json` como `catalogo-web/data/products.js` y `catalogo-web/data/products.json`.

---

## 🌐 Opciones de Publicación / Despliegue en Internet (100% Gratis)

Dado que es una página web estática (HTML, CSS, JS plano sin servidor):

### Opción 1: GitHub Pages (Recomendada)
1. Puedes crear un repositorio en GitHub (o una rama `gh-pages` en el repositorio).
2. En la configuración de GitHub -> **Pages**, selecciona la carpeta que contiene el catálogo.
3. Te dará un enlace permanente tipo `https://tu-usuario.github.io/naturale-catalogo/`.

### Opción 2: Netlify / Vercel / Cloudflare Pages
1. Arrastra y suelta la carpeta `catalogo-web` en [Netlify Drop](https://app.netlify.com/drop) o crea un proyecto en Vercel o Cloudflare Pages.
2. Obtienes un dominio HTTPS gratuito al instante (ej: `naturale-catalogo.netlify.app`), e incluso puedes conectarle tu propio dominio personalizado (ej: `catalogo.naturalecafe.com`).

### Opción 3: Uso Local / Red Local / USB
Simplemente copia la carpeta `catalogo-web` a cualquier dispositivo y abre `index.html` en Google Chrome, Safari, Edge o Firefox. Funciona sin necesidad de tener internet ni servidor web.
