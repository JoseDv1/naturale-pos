FROM caddy:alpine

ARG WHATSAPP_ENABLED=""
ARG WHATSAPP_NUMBER=""
ARG INSTAGRAM_URL=""

ENV WHATSAPP_ENABLED=${WHATSAPP_ENABLED}
ENV WHATSAPP_NUMBER=${WHATSAPP_NUMBER}
ENV INSTAGRAM_URL=${INSTAGRAM_URL}

RUN rm -rf /usr/share/caddy/*
COPY . /usr/share/caddy/
RUN rm -f /usr/share/caddy/Dockerfile /usr/share/caddy/.dockerignore /usr/share/caddy/README.md

RUN printf '#!/bin/sh\n\
if [ -f /usr/share/caddy/.env ]; then\n\
  set -a\n\
  . /usr/share/caddy/.env\n\
  set +a\n\
  rm -f /usr/share/caddy/.env\n\
fi\n\
if [ -n "$WHATSAPP_ENABLED" ]; then\n\
  VAL=$(printf "%%s" "$WHATSAPP_ENABLED" | tr "[:upper:]" "[:lower:]")\n\
  if [ "$VAL" = "false" ] || [ "$VAL" = "0" ] || [ "$VAL" = "no" ]; then\n\
    sed -i "s/whatsappEnabled: *[a-z]*/whatsappEnabled: false/" /usr/share/caddy/config.js\n\
  else\n\
    sed -i "s/whatsappEnabled: *[a-z]*/whatsappEnabled: true/" /usr/share/caddy/config.js\n\
  fi\n\
fi\n\
if [ -n "$WHATSAPP_NUMBER" ]; then\n\
  CLEAN_WA=$(printf "%%s" "$WHATSAPP_NUMBER" | tr -cd "0-9")\n\
  sed -i "s/whatsappNumber: *\\\"[^\\\"]*\\\"/whatsappNumber: \\\"$CLEAN_WA\\\"/" /usr/share/caddy/config.js\n\
fi\n\
if [ -n "$INSTAGRAM_URL" ]; then\n\
  sed -i "s|instagram: *\\\"[^\\\"]*\\\"|instagram: \\\"$INSTAGRAM_URL\\\"|" /usr/share/caddy/config.js\n\
fi\n\
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile\n' > /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 80

CMD ["/entrypoint.sh"]
