# isoledadss.github.io

Sitio personal de Isaac Soledad Martínez, economista financiero y desarrollador de
software. También está en inglés con el botón EN de la barra superior.

[isoledadss.github.io](https://isoledadss.github.io/)

## Sobre el sitio

Una sola página que presenta tres desarrollos distintos y lo que tienen en común.
El primero es la plataforma interna de operación, información y analítica de una
firma de asesoría financiera. El segundo es IDóneo, una aplicación Android y web
que captura credenciales y pasaportes a tamaño real. El tercero es un sistema de
estudio adaptativo para el examen CFA. Completan la página lo que puedo construir
para otros, mis capacidades, mi trayectoria y mi formación.

Las capturas del portal provienen de un entorno de desarrollo, sin identidad
corporativa ni información de clientes. Las de IDóneo usan un espécimen sintético.

## Cómo está construido

Sin dependencias, sin framework y sin proceso de compilación, con HTML, CSS y
JavaScript estándar. Las fuentes están dentro del propio sitio y no hay CDN, así
que la página funciona sin conexión y no expone a quien la visita a terceros.

```
index.html             contenido en español e inglés
css/tokens.css         variables de diseño, temas claro y oscuro, fuentes
css/base.css           tipografía, secciones, impresión
css/components.css     componentes
js/main.js             idioma, tema, navegación, galería, lightbox
assets/                capturas, fuentes, CV y favicon
idoneo/privacidad.html política de privacidad de IDóneo
```

Para verlo en local basta con abrir `index.html` o servir la carpeta.

```bash
python3 -m http.server 8000
```

## Detalles de implementación

### Bilingüe en un solo archivo

Cada texto lleva sus dos versiones y el CSS oculta la que no corresponde al idioma
activo. El idioma arranca según el navegador y se recuerda la elección.

### Tema claro y oscuro

Arranca según la preferencia del sistema y recuerda la elección. El acceso a
`localStorage` está protegido para no fallar en modo privado.

### Accesibilidad

Enlace de salto al contenido, foco visible, `aria` en el menú, las pestañas y el
lightbox, y respeto a `prefers-reduced-motion`.

### Rendimiento

Las capturas de las pestañas inactivas se piden en segundo plano con
`requestIdleCallback`, de modo que cambiar de pestaña es inmediato sin retrasar la
primera pintura.

## Contacto

[isoledadmz@gmail.com](mailto:isoledadmz@gmail.com) ·
[LinkedIn](https://linkedin.com/in/isaacsoledad) ·
[GitHub](https://github.com/ISoledadSS)
