FROM caddy:alpine

RUN rm -rf /usr/share/caddy/*
COPY index.html styles.css app.js config.js /usr/share/caddy/
COPY data /usr/share/caddy/data

EXPOSE 80
