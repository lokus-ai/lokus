# The Lokus relay as one small container. Build from the repo root:
#   docker build -f crates/lokus-server/Dockerfile -t lokus-relay .
FROM rust:1-bookworm AS build
WORKDIR /src
COPY . .
RUN cargo build --release -p lokus-server

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/lokus-server /usr/local/bin/lokus-server
# Keep the data file on a volume. Set SUPABASE_URL to accept real logins, and
# SUPABASE_JWT_SECRET too if the project signs logins with a shared secret.
ENV LOKUS_DATA=/data/relay.sqlite PORT=8787
VOLUME /data
EXPOSE 8787
CMD ["lokus-server"]
