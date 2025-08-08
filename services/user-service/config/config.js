const databaseConfig = require('../src/config/database.config');

module.exports = {
  development: {
    username: databaseConfig.username,
    password: databaseConfig.password,
    database: databaseConfig.database,
    host: databaseConfig.host,
    dialect: databaseConfig.dialect,
    port: databaseConfig.port,
    dialectOptions: databaseConfig.dialectOptions,
    logging: databaseConfig.logging,
    timezone: databaseConfig.timezone,
    pool: databaseConfig.pool,
    retry: databaseConfig.retry
  },
  test: {
    username: databaseConfig.username,
    password: databaseConfig.password,
    database: databaseConfig.database,
    host: databaseConfig.host,
    dialect: databaseConfig.dialect,
    port: databaseConfig.port,
    dialectOptions: databaseConfig.dialectOptions,
    logging: databaseConfig.logging,
    timezone: databaseConfig.timezone,
    pool: databaseConfig.pool,
    retry: databaseConfig.retry
  },
  production: {
    username: databaseConfig.username,
    password: databaseConfig.password,
    database: databaseConfig.database,
    host: databaseConfig.host,
    dialect: databaseConfig.dialect,
    port: databaseConfig.port,
    dialectOptions: databaseConfig.dialectOptions,
    logging: databaseConfig.logging,
    timezone: databaseConfig.timezone,
    pool: databaseConfig.pool,
    retry: databaseConfig.retry
  }
};