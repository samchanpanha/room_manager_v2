-- Phase 22: create the CI/test database (created once on first init of the
-- postgres volume). Host-side `npm test` connects to localhost:5432/rentmanager_test.
CREATE DATABASE rentmanager_test;
