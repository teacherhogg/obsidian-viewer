#!/bin/sh
set -e

CONF_DIR=/etc/nginx/conf.d

# Remove any existing generated configs
rm -f "$CONF_DIR"/pair_*.conf

n=1
while true; do
  eval "NAME=\$PAIR_${n}_NAME"
  eval "PORT=\$PAIR_${n}_PORT"
  [ -z "$NAME" ] && break

  SITE_ROOT="/sites/$n"
  CONF_FILE="$CONF_DIR/pair_${n}.conf"

  cat > "$CONF_FILE" <<EOF
server {
    listen ${PORT};
    server_name _;
    root ${SITE_ROOT};
    index index.html;
    charset utf-8;

    location /auth/ {
        proxy_pass         http://miraview-server:3001;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_cookie_path  / /;
    }

    location /api/ {
        proxy_pass         http://miraview-server:3001;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
    }

    location / {
        try_files \$uri \$uri.html \$uri/ =404;
    }

    # Serve _nav.json with correct content-type and no-cache so the sidebar stays fresh
    location = /_nav.json {
        add_header Cache-Control "no-cache, must-revalidate";
        add_header Content-Type "application/json";
    }

    error_page 404 /index.html;
}
EOF

  echo "[nginx-init] Configured site '${NAME}' on port ${PORT} → ${SITE_ROOT}"
  n=$((n + 1))
done

if [ "$n" -eq 1 ]; then
  echo "[nginx-init] WARNING: No PAIR_n_NAME variables found — no sites configured"
fi

exec nginx -g 'daemon off;'
