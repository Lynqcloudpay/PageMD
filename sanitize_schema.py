
import re
import sys

def sanitize_schema(sql):
    # Remove schema prefix
    sql = sql.replace('tenant_sandbox.', '')
    
    # Remove dangerous/unnecessary lines
    lines = sql.split('\n')
    cleaned_lines = []
    
    skip_blocks = [
        'CREATE SCHEMA public;',
        '-- Name: tenant_sandbox;',
        'CREATE SCHEMA tenant_sandbox;',
        'SET search_path',
        'SELECT pg_catalog.set_config(\'search_path\'',
        '-- PostgreSQL database dump',
        '-- Dumped from database version',
        '-- Dumped by pg_dump version',
        '-- Name: ', # This removes the metadata comments from pg_dump which often contain schema names
        '\\restrict'
    ]
    
    for line in lines:
        if any(skip in line for skip in skip_blocks):
            continue
        
        # Add IF NOT EXISTS to CREATE TABLE
        line = re.sub(r'CREATE TABLE (\w+)', r'CREATE TABLE IF NOT EXISTS \1', line)
        # Add IF NOT EXISTS to CREATE TYPE (PostgreSQL doesn't support IF NOT EXISTS for TYPE easily, but we can wrap it)
        # For simplicity in this template, we'll keep types as is or wrap them in DO blocks if needed.
        # Actually, let's just make it a clean creation template.
        
        cleaned_lines.append(line)
    
    sql = '\n'.join(cleaned_lines)
    
    # Remove empty comments and extra whitespace
    sql = re.sub(r'\n--\n--', '\n', sql)
    sql = re.sub(r'\n\n+', '\n\n', sql)
    
    return sql

with open("/Volumes/Mel's SSD/paper emr/sandbox_schema_dump.sql", 'r') as f:
    dump = f.read()

sanitized = sanitize_schema(dump)

# Wrap types in DO blocks to avoid errors if they exist
sanitized = re.sub(
    r'CREATE TYPE (\w+) AS ENUM \((.*?)\);',
    r"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '\1') THEN CREATE TYPE \1 AS ENUM (\2); END IF; END $$;",
    sanitized,
    flags=re.DOTALL
)

with open("/Volumes/Mel's SSD/paper emr/server/config/tenantSchema.js", 'w') as f:
    f.write("/**\n * Complete Tenant Schema Template (Generated from Production Sandbox)\n * Updated: 2026-01-11\n */\n\nconst tenantSchemaSQL = `\n")
    f.write(sanitized)
    f.write("\n`;\n\nmodule.exports = tenantSchemaSQL;\n")

print("Successfully updated tenantSchema.js")
