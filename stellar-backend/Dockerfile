# Stage 1: Builder
FROM rust:1.88.0 AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    git \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy Cargo files first for dependency caching
COPY Cargo.toml ./
COPY Cargo.loc[k] ./

# Create a dummy main.rs to build dependencies
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy the actual source code
COPY src ./src

# Build the actual application
RUN touch src/main.rs && \
    cargo build --release

# Prepare base_project template
COPY base_project ./base_project

# Stage 2: Runtime
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    bash \
    ca-certificates \
    libssl3 \
    libssl-dev \
    libdbus-1-dev \
    libudev-dev \
    build-essential \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install Rust and Cargo (needed for Stellar CLI installation)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:$PATH"

# Install wasm32 targets (Stellar requires both)
RUN rustup target add wasm32-unknown-unknown && \
    rustup target add wasm32v1-none

# Install Stellar CLI (auto-detects ARM64 or x86_64 architecture)
RUN cargo install --locked stellar-cli --version 23.0.0

# Verify Stellar CLI installation
RUN stellar --version

# Create non-root user with specific UID/GID for volume permissions
RUN groupadd -g 1000 stellar && useradd -u 1000 -g 1000 -m -d /home/stellar stellar

# Move Rust toolchain to system-wide location and give stellar user ownership
RUN mkdir -p /opt/cargo /opt/rustup && \
    cp -r /root/.cargo/* /opt/cargo/ && \
    cp -r /root/.rustup/* /opt/rustup/ && \
    chown -R stellar:stellar /opt/cargo && \
    chown -R stellar:stellar /opt/rustup

# Update environment variables to use system-wide Rust installation
ENV CARGO_HOME=/opt/cargo
ENV RUSTUP_HOME=/opt/rustup
ENV PATH="/opt/cargo/bin:/usr/local/bin:${PATH}"

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/target/release/stellar-playground-backend /app/stellar-playground-backend

# Copy base_project template
COPY --from=builder /app/base_project /app/base_project

# Create necessary directories with proper permissions
RUN mkdir -p /app/projects && \
    mkdir -p /var/log/stellar-playground && \
    chown -R stellar:stellar /app && \
    chown -R stellar:stellar /home/stellar && \
    chown -R stellar:stellar /var/log/stellar-playground && \
    chmod -R 777 /app/projects

# Environment variables
ENV RUST_LOG=info
ENV HOST=0.0.0.0
ENV PORT=8080

# Expose port
EXPOSE 8080

# Switch to non-root user
USER stellar

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the application
CMD ["/app/stellar-playground-backend"]
