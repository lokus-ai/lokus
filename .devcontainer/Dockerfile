# Use Ubuntu 22.04 as base
FROM ubuntu:22.04

# Set Node.js version
ARG NODE_VERSION=20
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

# Avoid warnings by switching to noninteractive
ENV DEBIAN_FRONTEND=noninteractive

# Update package list and install basic dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    pkg-config \
    libssl-dev \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Tauri system dependencies
RUN apt-get update && apt-get install -y \
    libwebkit2gtk-4.1-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    patchelf \
    libxdo-dev \
    libxcb-shape0-dev \
    libxcb-xfixes0-dev \
    libappimage-dev \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
    && apt-get update \
    && apt-get install -y sudo \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME \
    && rm -rf /var/lib/apt/lists/*

# Switch to non-root user for Rust installation
USER $USERNAME

# Install Rust via rustup
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    && echo 'source $HOME/.cargo/env' >> $HOME/.bashrc

# Add Rust to PATH
ENV PATH="/home/${USERNAME}/.cargo/bin:${PATH}"

# Install Tauri CLI globally (using cargo)
RUN /home/${USERNAME}/.cargo/bin/cargo install tauri-cli --version "^2.0.0"

# Set working directory
WORKDIR /workspace

# Switch back to root temporarily to set workspace ownership
USER root
RUN chown -R $USERNAME:$USERNAME /workspace

# Switch back to non-root user
USER $USERNAME

# Set environment variables for better Rust compilation
ENV CARGO_HOME="/home/${USERNAME}/.cargo"
ENV RUSTUP_HOME="/home/${USERNAME}/.rustup"
ENV RUST_BACKTRACE=1

# Switch back to dialog for any ad-hoc use of apt-get
ENV DEBIAN_FRONTEND=dialog

# Expose common ports (Vite dev server, Tauri)
EXPOSE 5173 1420

# Default command
CMD ["/bin/bash"]
