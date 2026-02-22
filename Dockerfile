FROM alpine:3.20

RUN apk add --no-cache curl ca-certificates busybox-extras

WORKDIR /app

ENV KEEPALIVE_URL="https://msu-snd-rgms-jcsg.onrender.com/health"
ENV KEEPALIVE_INTERVAL_SECONDS=300

CMD ["sh", "-c", ": \"${PORT:=10000}\"; echo \"ROTC keepalive image starting on port $PORT\"; ( while true; do echo \"[keepalive] pinging $KEEPALIVE_URL\"; curl -fsS \"$KEEPALIVE_URL\" || echo \"[keepalive] request failed\"; sleep \"$KEEPALIVE_INTERVAL_SECONDS\"; done ) & busybox httpd -f -p 0.0.0.0:$PORT"]
