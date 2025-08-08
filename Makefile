# Makefile for Lianxin Platform
# Provides convenient commands for development and deployment

.PHONY: help build up down logs clean test migrate seed

# Default target
help:
	@echo "Lianxin Platform - Available Commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development environment"
	@echo "  make build        - Build all Docker images"
	@echo "  make up           - Start all services"
	@echo "  make down         - Stop all services"
	@echo "  make logs         - View logs from all services"
	@echo "  make logs-user    - View logs from user-service only"
	@echo ""
	@echo "Database:"
	@echo "  make migrate      - Run database migrations"
	@echo "  make seed         - Seed database with demo data"
	@echo "  make db-reset     - Reset database (WARNING: Deletes all data)"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run all tests"
	@echo "  make test-user    - Run user-service tests"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean        - Clean up Docker resources"
	@echo "  make restart      - Restart all services"
	@echo "  make status       - Show service status"

# Development environment
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Production environment
prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Build all images
build:
	docker compose build

# Start all services
up:
	docker compose up -d

# Stop all services
down:
	docker compose down

# View logs
logs:
	docker compose logs -f

# View user-service logs only
logs-user:
	docker compose logs -f user-service

# Run database migrations
migrate:
	docker compose exec user-service npm run migrate

# Seed database with demo data
seed:
	docker compose exec user-service npm run seed

# Reset database (WARNING: Deletes all data)
db-reset:
	docker compose down -v
	docker compose up -d mysql redis
	sleep 30
	docker compose up -d user-service

# Run all tests
test:
	docker compose exec user-service npm test

# Run user-service tests specifically
test-user:
	docker compose exec user-service npm run test:unit

# Clean up Docker resources
clean:
	docker compose down -v
	docker system prune -f
	docker volume prune -f

# Restart all services
restart:
	docker compose restart

# Show service status
status:
	docker compose ps

# Enter user-service container shell
shell-user:
	docker compose exec user-service sh

# Enter MySQL container shell
shell-mysql:
	docker compose exec mysql mysql -u root -p

# Enter Redis container shell
shell-redis:
	docker compose exec redis redis-cli

# Backup database
backup-db:
	docker compose exec mysql mysqldump -u root -p$(DB_PASSWORD) $(DB_NAME) > backup_$(shell date +%Y%m%d_%H%M%S).sql

# View real-time resource usage
stats:
	docker stats

# Pull latest images
pull:
	docker compose pull

# Show Docker Compose configuration
config:
	docker compose config

# Validate Docker Compose file
validate:
	docker compose config --quiet