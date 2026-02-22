FROM alpine:3.20
RUN apk add --no-cache curl ca-certificates
WORKDIR /app
CMD ["sh", "-c", "echo ROTC keepalive image ready"]
