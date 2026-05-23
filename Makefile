# ============================================
# AirPool - Development Commands
# ============================================

.PHONY: help setup dev stop clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ============================================
# Setup
# ============================================

setup: ## Initial project setup (run once)
	@echo "🚀 Setting up AirPool development environment..."
	yarn install
	cp packages/backend/.env.example packages/backend/.env
	cp packages/mobile/.env.example packages/mobile/.env
	docker-compose up -d
	@echo "⏳ Waiting for services to start..."
	sleep 10
	cd packages/backend && yarn seed
	@echo "✅ Setup complete! Run 'make dev' to start development."

install: ## Install all dependencies
	yarn install

# ============================================
# Development
# ============================================

dev: ## Start all services for development
	@echo "🐳 Starting Docker services..."
	docker-compose up -d
	@echo "🖥️  Starting backend..."
	cd packages/backend && yarn dev &
	@echo "📱 Starting mobile app..."
	cd packages/mobile && yarn start &
	@echo "🎛️  Starting admin panel..."
	cd packages/admin && yarn dev &
	@echo "✅ All services started!"

dev-backend: ## Start only backend
	docker-compose up -d
	cd packages/backend && yarn dev

dev-mobile: ## Start only mobile app
	cd packages/mobile && yarn start

dev-admin: ## Start only admin panel
	cd packages/admin && yarn dev

# ============================================
# Docker
# ============================================

docker-up: ## Start Docker containers
	docker-compose up -d

docker-down: ## Stop Docker containers
	docker-compose down

docker-logs: ## View Docker logs
	docker-compose logs -f

docker-reset: ## Reset all Docker data
	docker-compose down -v
	docker-compose up -d

# ============================================
# Production
# ============================================

prod-build: ## Build for production
	cd packages/admin && yarn build
	docker-compose -f docker-compose.prod.yml build

prod-up: ## Start production stack
	docker-compose -f docker-compose.prod.yml up -d

prod-down: ## Stop production stack
	docker-compose -f docker-compose.prod.yml down

# ============================================
# Database
# ============================================

seed: ## Seed database with default data
	cd packages/backend && yarn seed

db-reset: ## Reset database (WARNING: deletes all data)
	docker-compose exec mongodb mongosh -u airpool_admin -p airpool_secret_2024 --eval "use airpool; db.dropDatabase();"
	cd packages/backend && yarn seed

# ============================================
# Utilities
# ============================================

clean: ## Clean all node_modules and build artifacts
	rm -rf node_modules
	rm -rf packages/backend/node_modules
	rm -rf packages/mobile/node_modules
	rm -rf packages/admin/node_modules
	rm -rf packages/admin/dist

lint: ## Run linting
	cd packages/backend && yarn lint
	cd packages/admin && yarn lint

logs: ## View backend logs
	cd packages/backend && tail -f logs/combined.log
