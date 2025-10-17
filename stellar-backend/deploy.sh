#!/bin/bash

# Stellar Playground Backend Deployment Script
# This script automates the entire deployment process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run this script as root"
    exit 1
fi

print_info "Starting Stellar Playground Backend Deployment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is available (v1 or v2)
DOCKER_COMPOSE_CMD=""
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
    print_info "Using Docker Compose V2"
elif command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
    print_info "Using Docker Compose V1"
else
    print_error "Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

# Check if .env.production exists
if [ ! -f .env.production ]; then
    print_error ".env.production file not found!"
    print_info "Please create .env.production with your configuration:"
    echo ""
    echo "Required variables:"
    echo "  STELLAR_NETWORK=testnet"
    echo "  STELLAR_SECRET_KEY=SXXXXXXXXX..."
    echo "  STELLAR_RPC_URL=https://soroban-testnet.stellar.org"
    echo "  STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org"
    echo "  STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015"
    echo "  EMAIL=your-email@example.com"
    exit 1
fi

# Load environment variables to check
source .env.production

# Validate required environment variables
REQUIRED_VARS=(
    "STELLAR_SECRET_KEY"
    "STELLAR_RPC_URL"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    print_error "Missing required environment variables in .env.production:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    exit 1
fi

print_success "Environment variables validated"

# Create data directory with proper permissions
print_info "Creating data directory..."
if [ ! -d "/data/stellar-projects" ]; then
    sudo mkdir -p /data/stellar-projects
    sudo chown -R 1000:1000 /data/stellar-projects
    sudo chmod -R 777 /data/stellar-projects
    print_success "Data directory created at /data/stellar-projects"
else
    print_info "Data directory already exists, fixing permissions..."
    sudo chown -R 1000:1000 /data/stellar-projects
    sudo chmod -R 777 /data/stellar-projects
    print_success "Permissions fixed"
fi

# Create logs directory
print_info "Creating logs directory..."
mkdir -p logs
print_success "Logs directory ready"

# Check if proxy network exists
print_info "Checking Docker proxy network..."
if ! docker network inspect proxy &> /dev/null; then
    print_warning "Docker network 'proxy' does not exist"
    print_info "Creating proxy network..."
    docker network create proxy
    print_success "Proxy network created"
else
    print_info "Proxy network exists"
fi

# Stop existing container if running
print_info "Checking for existing container..."
if docker ps -a | grep -q stellar-playground-backend; then
    print_info "Stopping existing container..."
    $DOCKER_COMPOSE_CMD down
    print_success "Existing container stopped"
fi

# Build and start the service
print_info "Building Docker image (this may take several minutes)..."
$DOCKER_COMPOSE_CMD build --no-cache

if [ $? -ne 0 ]; then
    print_error "Docker build failed"
    exit 1
fi

print_success "Docker image built successfully"

print_info "Starting service..."
$DOCKER_COMPOSE_CMD up -d

if [ $? -ne 0 ]; then
    print_error "Failed to start service"
    exit 1
fi

# Wait for service to be healthy
print_info "Waiting for service to be healthy..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if docker ps | grep -q stellar-playground-backend; then
        HEALTH=$(docker inspect --format='{{.State.Health.Status}}' stellar-playground-backend 2>/dev/null || echo "starting")

        if [ "$HEALTH" = "healthy" ]; then
            print_success "Service is healthy!"
            break
        elif [ "$HEALTH" = "unhealthy" ]; then
            print_error "Service is unhealthy. Check logs with: docker compose logs -f"
            exit 1
        fi
    fi

    echo -n "."
    sleep 2
    ATTEMPT=$((ATTEMPT + 1))
done

echo ""

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    print_warning "Health check timeout. Service may still be starting."
    print_info "Check status with: docker compose ps"
    print_info "Check logs with: docker compose logs -f"
fi

# Display service information
echo ""
print_success "=== Deployment Complete ==="
echo ""
print_info "Service Status:"
$DOCKER_COMPOSE_CMD ps
echo ""
print_info "API Endpoint: https://api.stellarplay.app"
print_info "Health Check: https://api.stellarplay.app/health"
echo ""
print_info "Useful Commands:"
echo "  View logs:        $DOCKER_COMPOSE_CMD logs -f stellar-backend"
echo "  Stop service:     $DOCKER_COMPOSE_CMD down"
echo "  Restart service:  $DOCKER_COMPOSE_CMD restart"
echo "  Rebuild:          $DOCKER_COMPOSE_CMD up -d --build"
echo ""
print_info "Testing the API:"
echo "  curl https://api.stellarplay.app/health"
echo ""

# Show recent logs
print_info "Recent logs:"
$DOCKER_COMPOSE_CMD logs --tail=50 stellar-backend

print_success "Deployment script completed!"
