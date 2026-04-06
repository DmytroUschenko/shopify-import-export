.PHONY: help deploy redeploy redeploy-api redeploy-web \
        start stop restart logs logs-api logs-web \
        ps health db-shell db-tables down down-volumes \
        dev dev-down dev-logs dev-logs-api dev-logs-web dev-ps dev-down-volumes

# ─── Load .env if present ────────────────────────────────────────────────────
-include .env
export

# ─── Colours ────────────────────────────────────────────────────────────────
CYAN  := \033[0;36m
RESET := \033[0m

help: ## Show this help
	@echo ""
	@echo "$(CYAN)Shopify Import — available targets$(RESET)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

# ─── First-time deploy ───────────────────────────────────────────────────────

deploy: ## First-time deploy: copy .env.example → .env (if missing), build images, start all services
	@if [ ! -f .env ]; then \
		echo "$(CYAN)No .env found — copying .env.example to .env$(RESET)"; \
		cp .env.example .env; \
		echo "$(CYAN)Fill in the required values in .env, then run 'make deploy' again.$(RESET)"; \
		exit 1; \
	fi
	@echo "$(CYAN)Building images and starting postgres + redis…$(RESET)"
	docker compose up --build -d postgres redis
	@echo "$(CYAN)Waiting for postgres to be healthy…$(RESET)"
	@until docker compose exec postgres pg_isready -U $${POSTGRES_USER:-postgres} > /dev/null 2>&1; do sleep 1; done
	@echo "$(CYAN)Ensuring database exists…$(RESET)"
	docker compose exec postgres psql -U $${POSTGRES_USER:-postgres} -tc \
		"SELECT 1 FROM pg_database WHERE datname = '$${POSTGRES_DB:-shopify_import}'" \
		| grep -q 1 || docker compose exec postgres psql -U $${POSTGRES_USER:-postgres} \
		-c "CREATE DATABASE $${POSTGRES_DB:-shopify_import};"
	@echo "$(CYAN)Starting remaining services…$(RESET)"
	docker compose up --build -d
	@echo "$(CYAN)Waiting for services to become healthy…$(RESET)"
	@$(MAKE) ps
	@echo ""
	@echo "$(CYAN)Running health check…$(RESET)"
	@$(MAKE) health

# ─── Redeploy after code changes ────────────────────────────────────────────

redeploy: ## Pull latest git changes and rebuild + restart all services
	@echo "$(CYAN)Pulling latest changes from git…$(RESET)"
	git pull
	@echo "$(CYAN)Rebuilding and restarting all services…$(RESET)"
	docker compose up --build -d
	@$(MAKE) ps

redeploy-api: ## Pull latest git changes, rebuild and restart the api service only
	@echo "$(CYAN)Pulling latest changes from git…$(RESET)"
	git pull
	@echo "$(CYAN)Rebuilding api…$(RESET)"
	docker compose build --no-cache api
	docker compose up -d api
	@$(MAKE) ps

redeploy-web: ## Pull latest git changes, rebuild and restart the web service only
	@echo "$(CYAN)Pulling latest changes from git…$(RESET)"
	git pull
	@echo "$(CYAN)Rebuilding web…$(RESET)"
	docker compose build --no-cache web
	docker compose up -d web
	@$(MAKE) ps

# ─── Routine operations ──────────────────────────────────────────────────────

start: ## Start all services (no rebuild)
	docker compose up -d

stop: ## Stop all services (keep containers and volumes)
	docker compose stop

restart: ## Restart all services
	docker compose restart

ps: ## Show status of all services
	docker compose ps

health: ## Hit the /health endpoint through nginx
	@curl -sf http://localhost:8082/health | python3 -m json.tool 2>/dev/null \
		|| curl -sf http://localhost:8082/health \
		|| echo "Health check failed — services may still be starting"

logs: ## Tail logs for all services (Ctrl-C to exit)
	docker compose logs -f

logs-api: ## Tail api logs only
	docker compose logs -f api

logs-web: ## Tail web logs only
	docker compose logs -f web

# ─── Database helpers ────────────────────────────────────────────────────────

db-shell: ## Open a psql shell inside the postgres container
	docker compose exec postgres psql -U $${POSTGRES_USER:-user} -d $${POSTGRES_DB:-shopify_import}

db-tables: ## List all tables in the database
	docker compose exec postgres psql -U $${POSTGRES_USER:-user} -d $${POSTGRES_DB:-shopify_import} -c '\dt'

# ─── Teardown ────────────────────────────────────────────────────────────────

down: ## Stop and remove containers (keeps the postgres-data volume)
	docker compose down

down-volumes: ## Stop and remove containers AND all volumes — DESTROYS ALL DATA
	@echo "$(CYAN)WARNING: this will destroy all stored data including the database.$(RESET)"
	@read -r -p "Type 'yes' to confirm: " confirm; \
	[ "$$confirm" = "yes" ] || (echo "Aborted."; exit 1)
	docker compose down -v

# ─── Local development (hot-reload) ─────────────────────────────────────────

dev: ## Start local dev environment with hot-reload (postgres, redis, api, web)
	@if [ ! -f .env ]; then \
		echo "$(CYAN)No .env found — copying .env.example to .env$(RESET)"; \
		cp .env.example .env; \
		echo "$(CYAN)Fill in the required values in .env, then run 'make dev' again.$(RESET)"; \
		exit 1; \
	fi
	@echo "$(CYAN)Starting dev environment (first run installs node_modules in Docker volumes)…$(RESET)"
	docker compose -f docker-compose.dev.yml up -d
	@echo ""
	@echo "$(CYAN)Services starting — tailing logs (Ctrl-C to detach, services keep running):$(RESET)"
	docker compose -f docker-compose.dev.yml logs -f

dev-down: ## Stop and remove dev containers (keeps volumes / node_modules cache)
	docker compose -f docker-compose.dev.yml down

dev-down-volumes: ## Stop dev containers AND remove all dev volumes (forces fresh pnpm install)
	docker compose -f docker-compose.dev.yml down -v

dev-ps: ## Show dev service status
	docker compose -f docker-compose.dev.yml ps

dev-logs: ## Tail all dev logs (Ctrl-C to exit)
	docker compose -f docker-compose.dev.yml logs -f

dev-logs-api: ## Tail dev api logs only
	docker compose -f docker-compose.dev.yml logs -f api

dev-logs-web: ## Tail dev web logs only
	docker compose -f docker-compose.dev.yml logs -f web
