# isoledadss.github.io

Sitio personal de **Isaac Soledad Martínez** — economista financiero y desarrollador
de plataformas de datos financieros.

**→ [isoledadss.github.io](https://isoledadss.github.io/)**

## Sobre el sitio

Una sola página que documenta el proyecto central de mi trabajo: la plataforma
interna de operación, información y analítica de una firma de asesoría financiera
—backend, frontend, base de datos, pipelines de ingesta, motor de BI y salida
documental—, además de mis capacidades, trayectoria y formación.

Las capturas provienen de un entorno de desarrollo, sin identidad corporativa ni
información de clientes.

## Cómo está construido

Sin dependencias, sin framework y sin proceso de compilación: HTML, CSS y
JavaScript estándar. Ni fuentes remotas ni CDN, así que la página funciona sin
conexión y no expone a quien la visita a terceros.

```
index.html          contenido
css/tokens.css      variables de diseño y temas claro/oscuro
css/base.css        tipografía, secciones, impresión
css/components.css  componentes
js/main.js          tema, navegación, galería, lightbox
assets/             capturas, CV y favicon
```

Para verlo en local basta con abrir `index.html`, o servir la carpeta:

```bash
python3 -m http.server 8000
```

## Detalles de implementación

- **Tema claro y oscuro.** Arranca según la preferencia del sistema y recuerda la
  elección. El acceso a `localStorage` está protegido para no fallar en modo privado.
- **Accesibilidad.** Enlace de salto al contenido, foco visible, `aria` en el menú,
  las pestañas y el lightbox, y respeto a `prefers-reduced-motion`.
- **Rendimiento.** Las capturas de las pestañas inactivas se piden en segundo plano
  con `requestIdleCallback`, de modo que cambiar de pestaña es inmediato sin
  retrasar la primera pintura.
- **Impresión.** Hoja de estilos propia: quita la barra, la cinta y las animaciones.

## Contacto

[isoledadmz@gmail.com](mailto:isoledadmz@gmail.com) ·
[LinkedIn](https://linkedin.com/in/isaacsoledad) ·
[GitHub](https://github.com/ISoledadSS)
