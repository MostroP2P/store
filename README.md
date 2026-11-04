# Remeras Mostro

Visor para ver cómo queda cada diseño sobre una remera de cualquier color. Es la base de la futura tienda `store.mostro.network`.

```bash
npm start      # http://localhost:8000   (servidor local sin caché, no hace falta npm install)
npm test       # tests unitarios
```

- **Agregar una remera de una serie:** sumá `{ "image": "designs/stickers/…png", "text": "Tu mensaje" }` en `items` de la serie, en `catalog.json`.
- **Agregar un diseño completo:** dejá el PNG transparente en `designs/` y sumalo en `designs` del catálogo.
- **Cambiar la fuente:** copiá el archivo a `assets/fonts/` y cambiá `"font"` en el `style` de la serie.
- **Calibrar el área de impresión:** abrí `http://localhost:8000/?debug`.

El detalle completo, incluido el plan para la tienda con pago Lightning, está en [docs/SPEC.md](docs/SPEC.md).

## Publicar en store.mostro.network

`.github/workflows/pages.yml` corre los tests y publica el sitio en GitHub Pages en cada push a `main`. Los pull requests solo corren los tests. Se publican solo `index.html`, `styles.css`, `catalog.json`, `src/`, `assets/` y `designs/`.

Configuración (una sola vez):

1. **Settings → Pages → Build and deployment → Source:** elegir **GitHub Actions**.
2. **DNS de `mostro.network`:** crear un registro `CNAME` de `store` → `mostrop2p.github.io`. Si el repo no está en la organización MostroP2P, apuntarlo a `<usuario>.github.io`.
3. **Settings → Pages → Custom domain:** poner `store.mostro.network`. Cuando GitHub valide el DNS, tildar **Enforce HTTPS**.
4. **Recomendado:** verificar `mostro.network` en la organización (**Settings → Pages → Verified domains**), así nadie más puede tomar el subdominio.

> Con el deploy por Actions, GitHub ignora el archivo `CNAME`: el dominio se configura solo en Settings (paso 3).
