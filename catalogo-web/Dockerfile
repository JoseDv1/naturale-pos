FROM caddy:alpine

ARG WHATSAPP_ENABLED=""
ARG WHATSAPP_NUMBER=""
ARG INSTAGRAM_URL=""

ENV WHATSAPP_ENABLED=${WHATSAPP_ENABLED}
ENV WHATSAPP_NUMBER=${WHATSAPP_NUMBER}
ENV INSTAGRAM_URL=${INSTAGRAM_URL}

RUN rm -rf /usr/share/caddy/*
COPY . /usr/share/caddy/
RUN mv /usr/share/caddy/entrypoint.sh /entrypoint.sh && \
    chmod +x /entrypoint.sh && \
    rm -f /usr/share/caddy/Dockerfile /usr/share/caddy/.dockerignore /usr/share/caddy/README.md

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
