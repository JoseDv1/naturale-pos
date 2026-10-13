FROM caddy:alpine

ARG WHATSAPP_NUMBER=""
ARG INSTAGRAM_URL=""
ARG STORE_HOURS=""
ARG STORE_LOCATION=""

ENV WHATSAPP_NUMBER=${WHATSAPP_NUMBER}
ENV INSTAGRAM_URL=${INSTAGRAM_URL}
ENV STORE_HOURS=${STORE_HOURS}
ENV STORE_LOCATION=${STORE_LOCATION}

RUN rm -rf /usr/share/caddy/*
COPY index.html styles.css app.js config.js /usr/share/caddy/
COPY data /usr/share/caddy/data

RUN printf '#!/bin/sh\n\
if [ -n "$WHATSAPP_NUMBER" ]; then\n\
  CLEAN_WA=$(printf "%%s" "$WHATSAPP_NUMBER" | tr -cd "0-9")\n\
  sed -i "s/whatsappNumber: *\\\"[^\\\"]*\\\"/whatsappNumber: \\\"$CLEAN_WA\\\"/" /usr/share/caddy/config.js\n\
fi\n\
if [ -n "$INSTAGRAM_URL" ]; then\n\
  sed -i "s|instagram: *\\\"[^\\\"]*\\\"|instagram: \\\"$INSTAGRAM_URL\\\"|" /usr/share/caddy/config.js\n\
fi\n\
if [ -n "$STORE_HOURS" ]; then\n\
  sed -i "s/hours: *\\\"[^\\\"]*\\\"/hours: \\\"$STORE_HOURS\\\"/" /usr/share/caddy/config.js\n\
fi\n\
if [ -n "$STORE_LOCATION" ]; then\n\
  sed -i "s/location: *\\\"[^\\\"]*\\\"/location: \\\"$STORE_LOCATION\\\"/" /usr/share/caddy/config.js\n\
fi\n\
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile\n' > /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 80

CMD ["/entrypoint.sh"]
