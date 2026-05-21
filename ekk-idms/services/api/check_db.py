from database import SessionLocal
from sqlalchemy import text

db = SessionLocal()

# Check plan_data location
result = db.execute(text("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'plan_data'")).fetchall()
print("Plan data table location:")
for r in result:
    print(f"Schema: {r[0]}, Table: {r[1]}")

# Check current database
current_db = db.execute(text("SELECT current_database()")).scalar()
print(f"\nCurrent database: {current_db}")

# List all tables
all_tables = db.execute(text("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name")).fetchall()
print(f"\nAll tables in {current_db}:")
for schema, table in all_tables:
    print(f"  {schema}.{table}")

# Try direct query
try:
    count = db.execute(text("SELECT COUNT(*) FROM plan_data")).scalar()
    print(f"\nDirect query result: {count} records in plan_data")
except Exception as e:
    print(f"\nDirect query failed: {e}")

db.close()
