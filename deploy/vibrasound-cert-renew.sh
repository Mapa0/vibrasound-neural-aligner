#!/bin/sh
# Reload only for this application's renewed certificate.
if [ "$RENEWED_LINEAGE" = "/etc/letsencrypt/live/vibrasound.mapazero.com" ]; then
    /usr/sbin/nginx -t && /bin/systemctl reload nginx
fi
