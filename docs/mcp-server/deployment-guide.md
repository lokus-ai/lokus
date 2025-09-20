# MCP Server Deployment Guide

## Overview

This guide covers deploying the Lokus MCP server in various environments, from development to production. Whether you're running a local instance for personal use or deploying to serve multiple users, this document provides the configurations and best practices you need.

## Table of Contents

- [Deployment Options](#deployment-options)
- [Local Development Deployment](#local-development-deployment)
- [Production Deployment](#production-deployment)
- [Container Deployment](#container-deployment)
- [Cloud Deployment](#cloud-deployment)
- [Configuration Management](#configuration-management)
- [Security Hardening](#security-hardening)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting](#troubleshooting)

## Deployment Options

### Deployment Architectures

1. **Standalone Local** - Single user, desktop application
2. **Local Server** - Multi-user, local network
3. **VPS/Dedicated Server** - Remote server deployment
4. **Container Orchestration** - Docker, Kubernetes
5. **Cloud Platform** - AWS, Azure, GCP
6. **Serverless** - Function-as-a-Service deployment

### Choosing the Right Deployment

| Use Case | Recommended Deployment | Complexity | Scalability |
|----------|----------------------|------------|-------------|
| Personal Use | Standalone Local | Low | Single User |
| Team (< 10 users) | Local Server | Low | Limited |
| Small Business | VPS/Dedicated | Medium | Moderate |
| Enterprise | Cloud Platform | High | High |
| SaaS Service | Container Orchestration | High | Very High |

## Local Development Deployment

### Prerequisites

- Node.js 18+
- Rust 1.70+
- Git
- 4GB RAM minimum
- 10GB free disk space

### Quick Start

```bash
# Clone repository
git clone https://github.com/lokus-ai/lokus.git
cd lokus

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env

# Start in development mode
npm run tauri dev
```

### Environment Configuration

```bash
# .env - Development Configuration
NODE_ENV=development
MCP_SERVER_ENABLED=true
MCP_SERVER_PORT=3001
MCP_SERVER_HOST=localhost

# Security
MCP_API_KEYS=dev-key-123,admin-key-456
MCP_ENABLE_CORS=true
MCP_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080

# Storage
WORKSPACE_PATH=./workspace
PLUGIN_PATH=./plugins
LOG_PATH=./logs

# Features
ENABLE_TELEMETRY=false
ENABLE_AUTO_UPDATE=false
DEBUG=lokus:mcp:*
```

### Development Server Features

- Hot reload for code changes
- Debug logging enabled
- CORS enabled for cross-origin requests
- Relaxed security for testing
- File watching for workspace changes

## Production Deployment

### System Requirements

**Minimum Requirements:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB SSD
- Network: 100 Mbps

**Recommended for Production:**
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 50GB+ SSD
- Network: 1 Gbps
- Load balancer capability

### Production Build

```bash
# Build for production
npm run build:production

# Create distribution package
npm run package

# Or build with Tauri
npm run tauri build
```

### Systemd Service Setup

Create a systemd service for automatic startup:

```bash
# /etc/systemd/system/lokus-mcp.service
[Unit]
Description=Lokus MCP Server
After=network.target
Wants=network.target

[Service]
Type=simple
User=lokus
Group=lokus
WorkingDirectory=/opt/lokus
ExecStart=/opt/lokus/bin/lokus-mcp-server
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=MCP_CONFIG_PATH=/etc/lokus/mcp.conf

# Security
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/lokus
ReadWritePaths=/var/log/lokus

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable lokus-mcp
sudo systemctl start lokus-mcp
sudo systemctl status lokus-mcp
```

### Production Configuration

```bash
# /etc/lokus/mcp.conf
[server]
host = 0.0.0.0
port = 3001
workers = 4
max_connections = 1000

[security]
api_keys_file = /etc/lokus/api-keys.json
enable_rate_limiting = true
rate_limit_window = 60
rate_limit_max_requests = 1000
enable_request_logging = true

[storage]
workspace_path = /var/lib/lokus/workspace
plugin_path = /var/lib/lokus/plugins
log_path = /var/log/lokus
backup_path = /var/backup/lokus

[performance]
enable_caching = true
cache_size_mb = 512
enable_compression = true
worker_timeout = 30

[features]
enable_telemetry = true
enable_metrics = true
enable_health_checks = true
auto_backup_interval = 3600
```

### Reverse Proxy Setup (Nginx)

```nginx
# /etc/nginx/sites-available/lokus-mcp
upstream lokus_mcp {
    server 127.0.0.1:3001;
    keepalive 32;
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name mcp.yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/mcp.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;

    # Security Headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=mcp_api:10m rate=100r/m;
    limit_req zone=mcp_api burst=20 nodelay;

    # WebSocket support
    location /mcp {
        proxy_pass http://lokus_mcp;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 300s;
    }

    # HTTP API
    location /api/mcp {
        proxy_pass http://lokus_mcp;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Security
        proxy_hide_header X-Powered-By;
        
        # Caching for static responses
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Health check endpoint
    location /health {
        proxy_pass http://lokus_mcp;
        access_log off;
    }

    # Redirect HTTP to HTTPS
    if ($scheme != "https") {
        return 301 https://$host$request_uri;
    }
}
```

### Database Setup (Optional)

For enterprise deployments, configure external database:

```bash
# PostgreSQL setup
sudo apt install postgresql postgresql-contrib
sudo -u postgres createuser --interactive lokus
sudo -u postgres createdb lokus_mcp

# Configuration
echo "DATABASE_URL=postgresql://lokus:password@localhost/lokus_mcp" >> /etc/lokus/mcp.conf
```

## Container Deployment

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

# Install Rust for Tauri
RUN apk add --no-cache \
    build-base \
    curl \
    wget \
    openssl-dev \
    libc6-compat

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build:production

# Production image
FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 -S lokus && \
    adduser -S lokus -u 1001

# Install runtime dependencies
RUN apk add --no-cache \
    tini \
    dumb-init

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create directories
RUN mkdir -p /app/workspace /app/plugins /app/logs && \
    chown -R lokus:lokus /app

USER lokus

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node dist/health-check.js

EXPOSE 3001

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  lokus-mcp:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    volumes:
      - ./workspace:/app/workspace
      - ./plugins:/app/plugins
      - ./logs:/app/logs
      - ./config:/app/config:ro
    environment:
      - NODE_ENV=production
      - MCP_CONFIG_PATH=/app/config/mcp.conf
    restart: unless-stopped
    depends_on:
      - redis
      - postgres
    networks:
      - lokus-net

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    restart: unless-stopped
    networks:
      - lokus-net

  postgres:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=lokus_mcp
      - POSTGRES_USER=lokus
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    restart: unless-stopped
    networks:
      - lokus-net

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl/certs:ro
    depends_on:
      - lokus-mcp
    restart: unless-stopped
    networks:
      - lokus-net

volumes:
  redis_data:
  postgres_data:

networks:
  lokus-net:
    driver: bridge
```

### Kubernetes Deployment

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: lokus-mcp
---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: lokus-mcp-config
  namespace: lokus-mcp
data:
  mcp.conf: |
    [server]
    host = 0.0.0.0
    port = 3001
    workers = 4
    
    [security]
    enable_rate_limiting = true
    
    [storage]
    workspace_path = /app/workspace
    plugin_path = /app/plugins
---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lokus-mcp
  namespace: lokus-mcp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: lokus-mcp
  template:
    metadata:
      labels:
        app: lokus-mcp
    spec:
      containers:
      - name: lokus-mcp
        image: lokus/mcp-server:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: MCP_CONFIG_PATH
          value: "/app/config/mcp.conf"
        volumeMounts:
        - name: config
          mountPath: /app/config
        - name: workspace
          mountPath: /app/workspace
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: config
        configMap:
          name: lokus-mcp-config
      - name: workspace
        persistentVolumeClaim:
          claimName: lokus-mcp-workspace
---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: lokus-mcp-service
  namespace: lokus-mcp
spec:
  selector:
    app: lokus-mcp
  ports:
  - port: 80
    targetPort: 3001
  type: ClusterIP
---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: lokus-mcp-ingress
  namespace: lokus-mcp
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - mcp.yourdomain.com
    secretName: lokus-mcp-tls
  rules:
  - host: mcp.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: lokus-mcp-service
            port:
              number: 80
```

## Cloud Deployment

### AWS Deployment

#### EC2 Instance Setup

```bash
# Launch EC2 instance
aws ec2 run-instances \
  --image-id ami-0abcdef1234567890 \
  --count 1 \
  --instance-type t3.medium \
  --key-name my-key-pair \
  --security-group-ids sg-12345678 \
  --subnet-id subnet-12345678 \
  --user-data file://user-data.sh

# user-data.sh
#!/bin/bash
yum update -y
yum install -y docker git

# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# Clone and setup Lokus
cd /opt
git clone https://github.com/lokus-ai/lokus.git
cd lokus
npm install
npm run build:production

# Setup systemd service
cp scripts/lokus-mcp.service /etc/systemd/system/
systemctl enable lokus-mcp
systemctl start lokus-mcp
```

#### Application Load Balancer

```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name lokus-mcp-alb \
  --subnets subnet-12345678 subnet-87654321 \
  --security-groups sg-12345678

# Create target group
aws elbv2 create-target-group \
  --name lokus-mcp-targets \
  --protocol HTTP \
  --port 3001 \
  --vpc-id vpc-12345678 \
  --health-check-path /health
```

#### Auto Scaling Group

```bash
# Create launch template
aws ec2 create-launch-template \
  --launch-template-name lokus-mcp-template \
  --launch-template-data '{
    "ImageId": "ami-0abcdef1234567890",
    "InstanceType": "t3.medium",
    "KeyName": "my-key-pair",
    "SecurityGroupIds": ["sg-12345678"],
    "UserData": "'$(base64 -w 0 user-data.sh)'"
  }'

# Create auto scaling group
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name lokus-mcp-asg \
  --launch-template LaunchTemplateName=lokus-mcp-template,Version=1 \
  --min-size 2 \
  --max-size 10 \
  --desired-capacity 3 \
  --target-group-arns arn:aws:elasticloadbalancing:region:account:targetgroup/lokus-mcp-targets
```

### Azure Deployment

#### Container Instance

```bash
# Create resource group
az group create --name lokus-mcp-rg --location eastus

# Create container instance
az container create \
  --resource-group lokus-mcp-rg \
  --name lokus-mcp-container \
  --image lokus/mcp-server:latest \
  --dns-name-label lokus-mcp \
  --ports 3001 \
  --environment-variables NODE_ENV=production \
  --cpu 2 \
  --memory 4
```

#### App Service

```bash
# Create App Service plan
az appservice plan create \
  --name lokus-mcp-plan \
  --resource-group lokus-mcp-rg \
  --sku B2 \
  --is-linux

# Create web app
az webapp create \
  --resource-group lokus-mcp-rg \
  --plan lokus-mcp-plan \
  --name lokus-mcp-app \
  --deployment-container-image-name lokus/mcp-server:latest

# Configure app settings
az webapp config appsettings set \
  --resource-group lokus-mcp-rg \
  --name lokus-mcp-app \
  --settings NODE_ENV=production MCP_PORT=3001
```

### Google Cloud Platform

#### Cloud Run Deployment

```bash
# Deploy to Cloud Run
gcloud run deploy lokus-mcp \
  --image gcr.io/PROJECT_ID/lokus-mcp-server:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --set-env-vars NODE_ENV=production

# Set up custom domain
gcloud run domain-mappings create \
  --service lokus-mcp \
  --domain mcp.yourdomain.com \
  --region us-central1
```

## Configuration Management

### Environment-Specific Configurations

```bash
# config/production.json
{
  "server": {
    "host": "0.0.0.0",
    "port": 3001,
    "workers": 4,
    "cluster": true
  },
  "security": {
    "enableRateLimit": true,
    "rateLimitWindow": 60000,
    "rateLimitMax": 1000,
    "enableCors": false,
    "allowedOrigins": ["https://yourdomain.com"],
    "apiKeyRequired": true
  },
  "performance": {
    "enableCaching": true,
    "cacheSize": 512,
    "enableCompression": true,
    "compressionLevel": 6
  },
  "logging": {
    "level": "info",
    "format": "json",
    "destination": "/var/log/lokus/mcp.log",
    "rotation": "daily",
    "maxFiles": 30
  },
  "monitoring": {
    "enableMetrics": true,
    "metricsPort": 9090,
    "healthCheckPath": "/health",
    "enableTracing": true
  }
}
```

### Secrets Management

#### Using HashiCorp Vault

```bash
# Store secrets in Vault
vault kv put secret/lokus-mcp \
  api_key="super-secret-api-key" \
  db_password="database-password" \
  jwt_secret="jwt-signing-secret"

# Retrieve in application
export VAULT_ADDR="https://vault.yourdomain.com"
export VAULT_TOKEN="your-vault-token"

# Application startup script
#!/bin/bash
API_KEY=$(vault kv get -field=api_key secret/lokus-mcp)
DB_PASSWORD=$(vault kv get -field=db_password secret/lokus-mcp)
JWT_SECRET=$(vault kv get -field=jwt_secret secret/lokus-mcp)

export MCP_API_KEY="$API_KEY"
export DB_PASSWORD="$DB_PASSWORD"
export JWT_SECRET="$JWT_SECRET"

node dist/server.js
```

#### Using Kubernetes Secrets

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: lokus-mcp-secrets
  namespace: lokus-mcp
type: Opaque
data:
  api-key: <base64-encoded-api-key>
  db-password: <base64-encoded-db-password>
  jwt-secret: <base64-encoded-jwt-secret>
```

## Security Hardening

### Firewall Configuration

```bash
# UFW (Ubuntu Firewall)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow from 10.0.0.0/8 to any port 3001  # Internal access only
sudo ufw enable

# iptables rules
iptables -A INPUT -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -p tcp -s 10.0.0.0/8 --dport 3001 -j ACCEPT
iptables -A INPUT -j DROP
```

### SSL/TLS Certificate Setup

```bash
# Let's Encrypt with Certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d mcp.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Security Headers

```javascript
// security/headers.js
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};
```

### API Rate Limiting

```javascript
// middleware/rateLimit.js
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export const apiLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // limit failed auth attempts
  skipSuccessfulRequests: true,
});
```

## Monitoring and Logging

### Prometheus Metrics

```javascript
// monitoring/metrics.js
import prometheus from 'prom-client';

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

const mcpConnections = new prometheus.Gauge({
  name: 'mcp_active_connections',
  help: 'Number of active MCP connections'
});

const mcpRequestsTotal = new prometheus.Counter({
  name: 'mcp_requests_total',
  help: 'Total number of MCP requests',
  labelNames: ['method', 'status']
});

// Middleware to collect metrics
export function metricsMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  
  next();
}

// Metrics endpoint
export function metricsHandler(req, res) {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(prometheus.register.metrics());
}
```

### Structured Logging

```javascript
// logging/logger.js
import winston from 'winston';
import 'winston-daily-rotate-file';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'lokus-mcp-server' },
  transports: [
    new winston.transports.DailyRotateFile({
      filename: '/var/log/lokus/mcp-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      compress: true
    }),
    new winston.transports.DailyRotateFile({
      level: 'error',
      filename: '/var/log/lokus/mcp-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      compress: true
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export default logger;
```

### Health Checks

```javascript
// health/checks.js
export class HealthChecker {
  constructor() {
    this.checks = new Map();
  }

  addCheck(name, checkFn) {
    this.checks.set(name, checkFn);
  }

  async runChecks() {
    const results = {};
    
    for (const [name, checkFn] of this.checks) {
      try {
        const start = Date.now();
        const result = await checkFn();
        const duration = Date.now() - start;
        
        results[name] = {
          status: 'healthy',
          duration,
          ...result
        };
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          error: error.message
        };
      }
    }
    
    const isHealthy = Object.values(results).every(r => r.status === 'healthy');
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: results
    };
  }
}

// Setup health checks
const healthChecker = new HealthChecker();

healthChecker.addCheck('database', async () => {
  await db.query('SELECT 1');
  return { connected: true };
});

healthChecker.addCheck('redis', async () => {
  await redis.ping();
  return { connected: true };
});

healthChecker.addCheck('disk_space', async () => {
  const stats = await fs.promises.statfs('/var/lib/lokus');
  const freeSpace = stats.free / stats.size;
  
  if (freeSpace < 0.1) {
    throw new Error('Low disk space');
  }
  
  return { free_space_percent: Math.round(freeSpace * 100) };
});
```

## Backup and Recovery

### Automated Backup Strategy

```bash
#!/bin/bash
# scripts/backup.sh

set -e

BACKUP_DIR="/var/backup/lokus"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="lokus_backup_${TIMESTAMP}"

# Create backup directory
mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}"

# Backup workspace
echo "Backing up workspace..."
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}/workspace.tar.gz" /var/lib/lokus/workspace

# Backup configuration
echo "Backing up configuration..."
cp -r /etc/lokus "${BACKUP_DIR}/${BACKUP_NAME}/config"

# Backup database
echo "Backing up database..."
pg_dump lokus_mcp > "${BACKUP_DIR}/${BACKUP_NAME}/database.sql"

# Create backup manifest
cat > "${BACKUP_DIR}/${BACKUP_NAME}/manifest.json" << EOF
{
  "timestamp": "${TIMESTAMP}",
  "version": "$(git describe --tags)",
  "hostname": "$(hostname)",
  "files": [
    "workspace.tar.gz",
    "config/",
    "database.sql"
  ]
}
EOF

# Compress entire backup
echo "Compressing backup..."
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
rm -rf "${BACKUP_NAME}"

# Clean old backups (keep last 30 days)
find "${BACKUP_DIR}" -name "lokus_backup_*.tar.gz" -mtime +30 -delete

echo "Backup completed: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
```

### Restoration Process

```bash
#!/bin/bash
# scripts/restore.sh

set -e

if [ $# -ne 1 ]; then
  echo "Usage: $0 <backup_file>"
  exit 1
fi

BACKUP_FILE="$1"
RESTORE_DIR="/tmp/lokus_restore_$$"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Stop services
echo "Stopping Lokus services..."
sudo systemctl stop lokus-mcp
sudo systemctl stop nginx

# Extract backup
echo "Extracting backup..."
mkdir -p "$RESTORE_DIR"
tar -xzf "$BACKUP_FILE" -C "$RESTORE_DIR"

BACKUP_NAME=$(basename "$BACKUP_FILE" .tar.gz)
BACKUP_PATH="${RESTORE_DIR}/${BACKUP_NAME}"

# Restore workspace
echo "Restoring workspace..."
sudo rm -rf /var/lib/lokus/workspace.backup
sudo mv /var/lib/lokus/workspace /var/lib/lokus/workspace.backup
sudo mkdir -p /var/lib/lokus/workspace
sudo tar -xzf "${BACKUP_PATH}/workspace.tar.gz" -C /

# Restore configuration
echo "Restoring configuration..."
sudo cp -r /etc/lokus /etc/lokus.backup
sudo rm -rf /etc/lokus
sudo cp -r "${BACKUP_PATH}/config" /etc/lokus

# Restore database
echo "Restoring database..."
sudo -u postgres psql -c "DROP DATABASE IF EXISTS lokus_mcp_backup;"
sudo -u postgres psql -c "CREATE DATABASE lokus_mcp_backup AS TEMPLATE lokus_mcp;"
sudo -u postgres psql -c "DROP DATABASE lokus_mcp;"
sudo -u postgres psql -c "CREATE DATABASE lokus_mcp;"
sudo -u postgres psql lokus_mcp < "${BACKUP_PATH}/database.sql"

# Set permissions
sudo chown -R lokus:lokus /var/lib/lokus/workspace
sudo chown -R root:root /etc/lokus
sudo chmod -R 644 /etc/lokus

# Start services
echo "Starting services..."
sudo systemctl start lokus-mcp
sudo systemctl start nginx

# Cleanup
rm -rf "$RESTORE_DIR"

echo "Restore completed successfully"
```

### Disaster Recovery Plan

1. **Recovery Time Objectives (RTO)**
   - Critical: 1 hour
   - Important: 4 hours
   - Normal: 24 hours

2. **Recovery Point Objectives (RPO)**
   - Critical data: 15 minutes
   - Important data: 1 hour
   - Normal data: 24 hours

3. **Backup Strategy**
   - Continuous: Database transaction logs
   - Hourly: Application state
   - Daily: Full system backup
   - Weekly: Long-term archive

## Troubleshooting

### Common Issues

#### High Memory Usage

```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head

# Analyze Node.js heap
node --inspect=0.0.0.0:9229 dist/server.js
# Connect with Chrome DevTools

# Enable heap dumps
export NODE_OPTIONS="--max-old-space-size=4096 --heapsnapshot-signal=SIGUSR2"
```

#### Connection Issues

```bash
# Check port availability
netstat -tlnp | grep :3001
sudo lsof -i :3001

# Test connectivity
curl -v http://localhost:3001/health
telnet localhost 3001

# Check WebSocket connectivity
wscat -c ws://localhost:3001/mcp
```

#### Performance Issues

```bash
# Monitor system resources
top -p $(pgrep -f lokus-mcp)
iotop -p $(pgrep -f lokus-mcp)

# Check application metrics
curl http://localhost:9090/metrics

# Analyze slow queries
tail -f /var/log/lokus/mcp.log | grep -E "(slow|timeout|error)"
```

#### SSL/TLS Issues

```bash
# Test SSL configuration
openssl s_client -connect mcp.yourdomain.com:443 -servername mcp.yourdomain.com

# Check certificate validity
openssl x509 -in /etc/letsencrypt/live/mcp.yourdomain.com/fullchain.pem -text -noout

# Verify SSL score
curl -s "https://api.ssllabs.com/api/v3/analyze?host=mcp.yourdomain.com"
```

### Debug Mode

```bash
# Enable debug logging
export DEBUG=lokus:mcp:*
export NODE_ENV=development
export LOG_LEVEL=debug

# Start with debugging
node --inspect=0.0.0.0:9229 dist/server.js

# Or use PM2 for production debugging
pm2 start dist/server.js --name lokus-mcp-debug -- --inspect=9229
```

### Performance Monitoring

```bash
# Monitor with htop
htop -p $(pgrep -f lokus-mcp)

# Use perf for CPU profiling
sudo perf record -p $(pgrep -f lokus-mcp) -g -- sleep 30
sudo perf report

# Memory profiling with valgrind (if using native modules)
valgrind --tool=massif --heap=yes node dist/server.js
```

## Maintenance

### Regular Maintenance Tasks

```bash
#!/bin/bash
# scripts/maintenance.sh

# Update system packages
sudo apt update && sudo apt upgrade -y

# Clean up logs
sudo find /var/log/lokus -name "*.log" -mtime +30 -delete
sudo journalctl --vacuum-time=30d

# Clean up temporary files
sudo find /tmp -name "lokus-*" -mtime +7 -delete

# Update Node.js dependencies
npm audit fix
npm update

# Restart services if needed
if [ "$1" = "--restart" ]; then
  sudo systemctl restart lokus-mcp
fi

# Generate maintenance report
echo "Maintenance completed at $(date)" >> /var/log/lokus/maintenance.log
```

### Automated Maintenance

```bash
# Add to crontab
sudo crontab -e

# Daily backup at 2 AM
0 2 * * * /opt/lokus/scripts/backup.sh

# Weekly maintenance on Sunday at 3 AM
0 3 * * 0 /opt/lokus/scripts/maintenance.sh

# Monthly security updates on first Sunday at 4 AM
0 4 1-7 * 0 /opt/lokus/scripts/maintenance.sh --restart

# Log rotation
0 0 * * * /usr/sbin/logrotate /etc/logrotate.d/lokus-mcp
```

---

This deployment guide provides comprehensive coverage for deploying Lokus MCP server in various environments. Follow the security best practices and monitoring guidelines to ensure a robust production deployment.