.PHONY: help test test-unit test-integration test-e2e test-cov lint format clean

# Default target
help:
	@echo "Available commands:"
	@echo "  make test          - Run all tests"
	@echo "  make test-unit     - Run unit tests only"
	@echo "  make test-integration - Run integration tests only"
	@echo "  make test-e2e      - Run end-to-end tests only"
	@echo "  make test-cov      - Run tests with coverage report"
	@echo "  make test-verbose  - Run tests with verbose output"
	@echo "  make lint          - Run flake8 linting"
	@echo "  make format        - Format code with black"
	@echo "  make check-format  - Check if code is formatted"
	@echo "  make clean         - Clean test artifacts"

# Install test dependencies
install:
	pip install -r requirements-test.txt

# Run all tests
test:
	pytest tests/ -v

# Run unit tests only
test-unit:
	pytest tests/unit/ -v -m unit

# Run integration tests only
test-integration:
	pytest tests/integration/ -v -m integration

# Run end-to-end tests only
test-e2e:
	pytest tests/e2e/ -v -m e2e

# Run tests with coverage
test-cov:
	pytest tests/ -v --cov=rooms --cov-report=term-missing --cov-report=html
	@echo "\nCoverage report generated in htmlcov/index.html"

# Run tests with coverage for specific app
test-cov-app:
	pytest tests/ -v --cov=$(APP) --cov-report=term-missing --cov-report=html

# Run tests in parallel (faster)
test-parallel:
	pytest tests/ -v -n auto

# Run specific test file
test-file:
	pytest $(FILE) -v

# Run specific test function
test-func:
	pytest tests/ -v -k $(NAME)

# Run tests with verbose output
test-verbose:
	pytest tests/ -vv --tb=long

# Run tests and stop on first failure
test-failfast:
	pytest tests/ -v -x

# Run linting
lint:
	flake8 rooms config tests --exclude=migrations --max-line-length=88 --extend-ignore=E203,W503

# Format code with black
format:
	black rooms config tests --exclude=migrations

# Check if code is properly formatted
check-format:
	black rooms config tests --check --exclude=migrations

# Clean test artifacts
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.pyc" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "htmlcov" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name ".coverage" -exec rm -f {} + 2>/dev/null || true
	find . -type f -name "coverage.xml" -exec rm -f {} + 2>/dev/null || true

# Run Django migrations check
migrations-check:
	python manage.py makemigrations --check --dry-run

# Create missing migrations
migrations-make:
	python manage.py makemigrations

# Apply migrations
migrate:
	python manage.py migrate

# Development server
run:
	python manage.py runserver

# Create superuser
createsuperuser:
	python manage.py createsuperuser

# Django shell
shell:
	python manage.py shell

# Database reset (WARNING: Deletes all data)
reset-db:
	python manage.py flush --noinput

# Collect static files
collectstatic:
	python manage.py collectstatic --noinput

# Check for security issues
check-security:
	python manage.py check --deploy

# Full test suite (lint + test)
ci: lint test-cov

# Watch tests (requires pytest-watch)
watch:
	ptw tests/ -v
