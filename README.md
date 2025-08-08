# Lianxin Social Media Platform

A comprehensive social media platform built with microservices architecture, featuring secure user management, real-time messaging, and China compliance.

## Architecture Overview

This project follows a microservices architecture with the following services:

- **User Service** (`services/user-service/`) - User authentication, profiles, and account management
- **Shared Libraries** (`shared/`) - Common utilities, database connections, and authentication strategies

## Features

### 🔐 Security & Compliance
- Phone-based authentication with OTP verification
- Field-level encryption for sensitive data
- JWT token management with refresh rotation
- China compliance (PIPL, Cybersecurity Law, Data Security Law)
- Comprehensive audit logging

### 👤 User Management
- User registration and authentication
- Profile management with avatar/cover photo upload
- Privacy settings and preferences
- Session management across devices
- Account deactivation and deletion with grace periods

### 🛡️ Security Features
- Rate limiting and abuse prevention
- Password strength validation
- Account lockout protection
- Multi-factor authentication support
- Device fingerprinting and tracking

## Quick Start with Docker Compose

### Prerequisites
- Docker Desktop (or Docker Engine and Docker Compose) installed
- Git (for cloning the repository)

### Installation and Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lianxin-platform
   ```

2. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration (database passwords, JWT secrets, etc.)
   ```

3. **Build and run with Docker Compose**
   ```bash
   # Build the Docker images for all services
   docker compose build

   # Start all services in detached mode
   docker compose up -d

   # View logs (optional)
   docker compose logs -f user-service

   # Check service health
   docker compose ps
   ```

4. **Access the services**
   - **User Service API**: http://localhost:3001
   - **Health Check**: http://localhost:3001/health
   - **Database Admin (Adminer)**: http://localhost:8080
   - **MySQL Database**: localhost:3306
   - **Redis Cache**: localhost:6379

5. **Stop the services**
   ```bash
   # Stop and remove all services
   docker compose down

   # Stop and remove all services including volumes (WARNING: This will delete all data)
   docker compose down -v
   ```

### Database Migrations

The database migrations for the user service will run automatically when the MySQL container starts for the first time. The migration files are located in `db/migrations/` and are mounted to the MySQL container's initialization directory.

For ongoing development and applying new migrations, you can:

```bash
# Run migrations manually inside the user-service container
docker compose exec user-service npm run migrate

# Or access the container shell
docker compose exec user-service sh
```

## Development Setup (Without Docker)

If you prefer to run the services locally without Docker:

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- Redis 6.0+

### Installation

1. **Install dependencies**
   ```bash
   cd services/user-service
   npm install
   ```

2. **Database setup**
   ```bash
   # Create database and run migrations
   mysql -u root -p < db/migrations/users.sql
   mysql -u root -p < db/migrations/user_sessions.sql
   mysql -u root -p < db/migrations/otp_verifications.sql
   mysql -u root -p < db/migrations/user_settings.sql
   mysql -u root -p < db/migrations/audit_logs.sql
   ```

3. **Start the services**
   ```bash
   # Start Redis (in separate terminal)
   redis-server

   # Start the user service
   cd services/user-service
   npm run dev
   ```

## API Documentation

Comprehensive API documentation is available in the `docs/` directory:

- **API Documentation**: `docs/API_DOCUMENTATION.md`
- **API Flowcharts**: `docs/API_FLOWCHARTS.md`
- **Workflow Diagrams**: `docs/API_WORKFLOW_DIAGRAMS.md`
- **Frontend Integration Guide**: `docs/FRONTEND_INTEGRATION_GUIDE.md`

### Key API Endpoints

- `POST /api/v1/auth/register/otp` - Request registration OTP
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/user/profile` - Get user profile
- `PUT /api/v1/user/profile` - Update user profile
- `GET /api/v1/user/settings` - Get user settings
- `PUT /api/v1/user/settings` - Update user settings

## Project Structure

```
/
├── docker-compose.yml          # Root-level service orchestration
├── .env                        # Environment variables
├── .env.example               # Environment template
├── README.md                  # This file
├── docs/                      # Documentation
│   ├── API_DOCUMENTATION.md
│   ├── API_FLOWCHARTS.md
│   └── API_WORKFLOW_DIAGRAMS.md
├── db/                        # Database migrations
│   └── migrations/
├── services/                  # Microservices
│   └── user-service/         # User management microservice
│       ├── Dockerfile
│       ├── package.json
│       ├── src/              # Source code
│       ├── seeders/          # Database seeders
│       └── logs/             # Service logs
└── shared/                   # Shared libraries and utilities
    ├── libraries/
    │   ├── auth/
    │   ├── cache/
    │   ├── database/
    │   └── logging/
    └── utils/
```

## Configuration

### Environment Variables

Key environment variables that need to be configured in your `.env` file:

```bash
# Database
DB_PASSWORD=your_secure_mysql_password
MYSQL_ROOT_PASSWORD=your_secure_mysql_root_password

# Redis
REDIS_PASSWORD=your_secure_redis_password

# JWT Secrets (Generate strong, random keys)
JWT_ACCESS_TOKEN_SECRET=your_jwt_access_secret
JWT_REFRESH_TOKEN_SECRET=your_jwt_refresh_secret

# Encryption Keys (Generate strong, random keys)
ENCRYPTION_PRIMARY_KEY=your_32_character_encryption_key
ENCRYPTION_SECONDARY_KEY=your_32_character_secondary_key

# Alibaba Cloud SMS (Optional)
ALIBABA_SMS_ACCESS_KEY_ID=your_alibaba_access_key
ALIBABA_SMS_ACCESS_KEY_SECRET=your_alibaba_secret_key
```

### Security Configuration

The application includes comprehensive security features:

- **Field-level encryption** for sensitive PII data
- **Password hashing** with bcrypt (12 rounds)
- **JWT token security** with rotation and blacklisting
- **Session management** with Redis storage
- **Rate limiting** to prevent abuse
- **Audit logging** for compliance

## Monitoring and Logging

### Health Checks
- **User Service**: `GET http://localhost:3001/health`
- **Database**: Built-in MySQL health checks
- **Redis**: Built-in Redis health checks

### Logs
- Application logs are stored in `services/user-service/logs/`
- Docker logs can be viewed with `docker compose logs -f [service-name]`

### Database Administration
- **Adminer** is available at http://localhost:8080
- Use the database credentials from your `.env` file to connect

## Testing

```bash
# Run tests for user service
cd services/user-service
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

## Production Deployment

For production deployment:

1. **Update environment variables** in `.env` with production values
2. **Generate strong secrets** for JWT and encryption keys
3. **Configure SSL/TLS** for database and Redis connections
4. **Set up monitoring** and alerting
5. **Configure backup strategies** for data persistence

## Support

For technical support or questions:

1. Check the comprehensive API documentation in the `docs/` directory
2. Review the troubleshooting guide
3. Submit issues through the project repository

## License

This project is proprietary software developed for the Lianxin social media platform.