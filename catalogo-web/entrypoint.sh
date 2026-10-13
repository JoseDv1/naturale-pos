#!/bin/sh
set -e

if [ -f /usr/share/caddy/.env ]; then
  set -a
  . /usr/share/caddy/.env
  set +a
  rm -f /usr/share/caddy/.env
fi

if [ -n "$WHATSAPP_ENABLED" ]; then
  VAL=$(printf "%s" "$WHATSAPP_ENABLED" | tr "[:upper:]" "[:lower:]")
  if [ "$VAL" = "false" ] || [ "$VAL" = "0" ] || [ "$VAL" = "no" ]; then
    sed -i 's/whatsappEnabled: *[a-z]*/whatsappEnabled: false/' /usr/share/caddy/config.js
  else
    sed -i 's/whatsappEnabled: *[a-z]*/whatsappEnabled: true/' /usr/share/caddy/config.js
  fi
fi

if [ -n "$WHATSAPP_NUMBER" ]; then
  CLEAN_WA=$(printf "%s" "$WHATSAPP_NUMBER" | tr -cd "0-9")
  sed -i "s/whatsappNumber: *\"[^\"]*\"/whatsappNumber: \"$CLEAN_WA\"/" /usr/share/caddy/config.js
fi

if [ -n "$INSTAGRAM_URL" ]; then
  sed -i "s|instagram: *\"[^\"]*\"|instagram: \"$INSTAGRAM_URL\"|" /usr/share/caddy/config.js
fi

TS=$(date +%s)
sed -i "s/src=\"config.js[^\"]*\"/src=\"config.js?v=$TS\"/" /usr/share/caddy/index.html
sed -i "s/src=\"app.js[^\"]*\"/src=\"app.js?v=$TS\"/" /usr/share/caddy/index.html
sed -i "s|src=\"data/products.js[^\"]*\"|src=\"data/products.js?v=$TS\"|" /usr/share/caddy/index.html
sed -i "s/href=\"styles.css[^\"]*\"/href=\"styles.css?v=$TS\"/" /usr/share/caddy/index.html

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
