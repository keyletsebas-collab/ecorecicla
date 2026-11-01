# EcoRecicla / ReciminsaApp - PWA estática servida con Nginx
FROM nginx:1.27-alpine

RUN rm -rf /usr/share/nginx/html/*
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

COPY index.html manifest.json service-worker.js version.json \
     favicon.png icon-192.png icon-512.png \
     logo-no-white-lines.png logo-white-lines.png \
     /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ >/dev/null || exit 1
