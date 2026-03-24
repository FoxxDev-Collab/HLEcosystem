-- HLEcosystem PostgreSQL initialization
-- Runs automatically on first boot via docker-entrypoint-initdb.d

-- App schemas (all within the 'foxxlab' database)
CREATE SCHEMA IF NOT EXISTS family_manager;
CREATE SCHEMA IF NOT EXISTS familyhub;
CREATE SCHEMA IF NOT EXISTS family_finance;
CREATE SCHEMA IF NOT EXISTS family_health;
CREATE SCHEMA IF NOT EXISTS family_home_care;
CREATE SCHEMA IF NOT EXISTS file_server;
CREATE SCHEMA IF NOT EXISTS meal_prep;
CREATE SCHEMA IF NOT EXISTS family_wiki;

-- Grant the admin user access to all schemas
GRANT ALL PRIVILEGES ON SCHEMA family_manager TO foxxlab_admin;
GRANT ALL PRIVILEGES ON SCHEMA familyhub TO foxxlab_admin;
GRANT ALL PRIVILEGES ON SCHEMA family_finance TO foxxlab_admin;
GRANT ALL PRIVILEGES ON SCHEMA family_health TO foxxlab_admin;
GRANT ALL PRIVILEGES ON SCHEMA family_home_care TO foxxlab_admin;
GRANT ALL PRIVILEGES ON SCHEMA file_server TO foxxlab_admin;
GRANT ALL PRIVILEGES ON SCHEMA meal_prep TO foxxlab_admin;
GRANT ALL PRIVILEGES ON SCHEMA family_wiki TO foxxlab_admin;

-- Cross-schema access: all apps can read Family Manager's User table
-- Family Manager is the central identity provider for the ecosystem
ALTER DEFAULT PRIVILEGES IN SCHEMA family_manager GRANT SELECT ON TABLES TO foxxlab_admin;
