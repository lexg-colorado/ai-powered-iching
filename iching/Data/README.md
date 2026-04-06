# Colorado Business Entity Data (CDOS)

Python toolkit for loading, cleaning, querying, splitting, and exporting Colorado Secretary of State business entity registration data.

## Overview

The Colorado Department of State (CDOS) publishes business entity registration data covering corporations, LLCs, partnerships, trusts, and other entities registered with the Colorado Secretary of State. The dataset contains ~3 million rows across 35 columns, with records dating back to the 1860s and roughly 2,000 new businesses added each week.

The `cdos` package provides a 5-class pipeline for working with this data:

1. **Load** the raw CSV with proper dtypes
2. **Clean** whitespace, casing, zip codes, and extract derived columns
3. **Parse** and filter subsets (by status, type, city, zip, name, date range, agents)
4. **Split** into named groups by category, custom mapping, or date
5. **Export** to CSV files with optional summary statistics

## Data Source

- **Source**: [Colorado Information Marketplace](https://data.colorado.gov/Business/Business-Entities-in-Colorado/4ykn-tg5h)
- **File**: `data/Business_Entities_in_Colorado_20260312.csv` (~750MB)
- **Not included in this repo** — download from the link above and place in `data/`

## Setup

Requires Python 3.10+ and pandas.

```bash
python -m venv venv
source venv/bin/activate
pip install pandas "psycopg[binary]"
```

No `setup.py` or `pyproject.toml` — import the `cdos` package directly from the project root.

## Quick Start

```python
from cdos import DataLoader, DataCleaner, DataParser, DataSplitter, DataExporter

# Load (use nrows for quick exploration)
df = DataLoader().load(nrows=10_000)

# Clean
cleaned = DataCleaner(df).clean_all().df

# Query
active = DataParser(cleaned).active_entities()
denver = DataParser(cleaned).by_city("Denver")

# Split
by_type = DataSplitter(cleaned).split_by_column("entitytype")

# Export
DataExporter("output").save(active, "active_entities.csv")
DataExporter("output").save_splits(by_type, prefix="type", subdirectory="by_type")
```

See `scripts/example_usage.py` for a complete end-to-end demo.

## Package Architecture

```
cdos/
    __init__.py        # Convenience imports
    constants.py       # Column groups, entity type map, status lists, regex patterns
    loader.py          # DataLoader
    cleaner.py         # DataCleaner
    parser.py          # DataParser
    splitter.py        # DataSplitter
    exporter.py        # DataExporter
    db.py              # DatabaseManager
    ingestor.py        # DataIngestor
    sql/
        00_extensions.sql    # pg_trgm for fuzzy search
        01_create_tables.sql # Normalized schema
        02_create_indexes.sql # Indexes (post-load)
        03_seed_lookups.sql  # Entity type and status data
        04_create_views.sql  # 7 analytical views
        05_drop_all.sql      # Teardown
scripts/
    example_usage.py         # CSV pipeline demo
    ingest_to_postgres.py    # PostgreSQL ingestion CLI
data/
    Business_Entities_in_Colorado_20260312.csv
    Business_Entities_in_Colorado_cleaned.csv
```

## API Reference

### DataLoader

Loads the CSV with proper dtypes (all string except `entityformdate` as datetime).

```python
loader = DataLoader()                          # default file path
loader = DataLoader("path/to/custom.csv")      # custom file

df = loader.load()                             # full dataset (~3M rows)
df = loader.load(nrows=10_000)                 # first N rows
df = loader.load(columns=["entityid", "entityname"])  # column subset

for chunk in loader.load_chunked(chunksize=100_000):  # chunked iteration
    process(chunk)
```

### DataCleaner

Chainable cleaning pipeline. Each method modifies the internal DataFrame and returns `self`. Access the result via `.df`.

```python
# Run all cleaning steps
cleaned = DataCleaner(df).clean_all().df

# Or chain specific steps
cleaned = (
    DataCleaner(df)
    .strip_whitespace()
    .extract_clean_entity_name()
    .normalize_city_casing()
    .normalize_zipcode()
    .df
)
```

#### Cleaning Steps (in recommended order)

| Method | What it does |
|--------|-------------|
| `strip_whitespace()` | Strips leading/trailing whitespace from all string columns |
| `drop_empty_rows()` | Removes rows with null/empty `entityid` |
| `extract_clean_entity_name()` | Splits `entityname` into `entityname_clean` and `entityname_status_suffix` |
| `normalize_entity_name_casing()` | Title-cases names, preserving acronyms (LLC, INC, LTD, etc.) |
| `normalize_city_casing()` | Title-cases all city columns |
| `normalize_state_casing()` | Uppercases all state columns |
| `normalize_zipcode()` | Truncates ZIP+4 to 5-digit |
| `fill_missing_country()` | Infers "US" when state is a US abbreviation and country is blank |
| `add_entity_type_label()` | Adds `entitytype_label` with human-readable type names |
| `add_agent_type_column()` | Adds `agent_type`: "person", "organization", "both", or "none" |
| `parse_entityformdate()` | Ensures `entityformdate` is datetime type |

#### Columns Added by Cleaning

- `entityname_clean` — Business name with legal suffix preserved, embedded status removed
- `entityname_status_suffix` — The status string (e.g., "Dissolved January 3, 2026") or NaN
- `entitytype_label` — Human-readable entity type (e.g., "Domestic Limited Liability Company")
- `agent_type` — Whether the agent is a person, organization, both, or none

#### Entity Name Cleaning Detail

Many entity names in the raw data have status and date information appended:

```
SOUTHWEST CONTRACTING, LLC, Delinquent May 1, 2016
MOUNTAIN CHEMICALS CO., INC., Dissolved March 6, 1967
```

`extract_clean_entity_name()` splits these into the clean business name (preserving legal suffixes like LLC, Inc.) and the status suffix:

```
entityname_clean:          Southwest Contracting, LLC
entityname_status_suffix:  Delinquent May 1, 2016
```

### DataParser

Filter and extract subsets. All methods return new DataFrames — the source is never modified.

```python
parser = DataParser(cleaned)

# Filter by single or multiple values
parser.by_status("Good Standing")
parser.by_status(["Good Standing", "Exists"])
parser.by_type("DLLC")
parser.by_type(["DLLC", "DPC"])

# Filter by location (address_group: "principal", "mailing", "agent_principal", "agent_mailing")
parser.by_zipcode("80202")
parser.by_zipcode("80202", address_group="mailing")
parser.by_city("Denver")
parser.by_state("CO")
parser.by_jurisdiction("DE")

# Filter by date range
parser.by_date_range(start="2020-01-01", end="2025-12-31")

# Search entity names (substring or regex)
parser.by_name("brewing")
parser.by_name(r"^(mountain|peak)", regex=True)

# Shortcuts
parser.active_entities()     # Good Standing + Exists
parser.inactive_entities()   # Everything else

# Registered agents (deduplicated by name + address, with entity lists)
agents = parser.registered_agents()
# Returns: agent columns, entity_count, entity_ids (list)

# Compound filter (AND logic)
parser.query(principalcity="Denver", entitytype="DLLC", entitystatus="Good Standing")
```

### DataSplitter

Split a DataFrame into multiple named DataFrames.

```python
splitter = DataSplitter(cleaned)

# By categorical column -> {value: DataFrame}
by_type = splitter.split_by_column("entitytype")
# -> {"DPC": df, "DLLC": df, "DNC": df, ...}

# By custom value grouping
by_activity = splitter.split_by_mapping("entitystatus", {
    "active": ["Good Standing", "Exists"],
    "dissolved": ["Voluntarily Dissolved", "Administratively Dissolved"],
    "delinquent": ["Delinquent", "Noncompliant"],
})

# By arbitrary predicates
by_pred = splitter.split_by_predicate({
    "colorado_llcs": lambda df: (df["entitytype"] == "DLLC") & (df["principalstate"] == "CO"),
    "out_of_state": lambda df: df["principalstate"] != "CO",
})

# By date period (Y=year, M=month, Q=quarter, 10Y=decade)
by_year = splitter.split_by_date(freq="Y")
# -> {"2020": df, "2021": df, ...}
```

### DataExporter

Save DataFrames to CSV files.

```python
exporter = DataExporter("output")       # creates directory if needed

# Single file
exporter.save(df, "active_entities.csv")

# Batch save from a split dict
exporter.save_splits(by_type, prefix="type", subdirectory="by_type")
# -> output/by_type/type_dpc.csv, output/by_type/type_dllc.csv, ...

# Save with companion summary file
exporter.save_with_summary(df, "active_entities.csv")
# -> output/active_entities.csv + output/active_entities_summary.txt
```

The summary file includes row/column counts, date range, status distribution, entity type distribution, and null percentages.

## PostgreSQL Database

### Schema

The cleaned data is normalized into 6 tables:

| Table | Description |
|-------|-------------|
| `entity_type` | Lookup — 33 type codes with human-readable labels |
| `entity_status` | Lookup — 15 statuses with `is_active` flag |
| `jurisdiction` | Lookup — dynamically populated from source data (~1,368 freetext values) |
| `address` | Deduplicated addresses shared across all 4 address groups |
| `agent` | Deduplicated registered agents with FK references to their addresses |
| `entity` | Core table (~3M rows) with FKs to all lookup and reference tables |

### Views

| View | Description |
|------|-------------|
| `v_entity_full` | Flat reconstitution of the original CSV shape (all joins) |
| `v_active_entities` | Active entities only (Good Standing + Exists) |
| `v_entity_summary_by_type` | Entity counts by type (total/active/inactive) |
| `v_entity_summary_by_status` | Entity counts by status |
| `v_top_agents` | Agents ranked by number of entities represented |
| `v_entity_by_city` | Entity counts by principal city/state |
| `v_formation_by_year` | Formation counts by year and entity type |

### DatabaseManager

```python
from cdos import DatabaseManager

# Connection via constructor or CDOS_DATABASE_URL env var
with DatabaseManager("postgresql://user:pass@localhost/cdos") as db:
    db.create_schema()     # tables + seed lookups + views
    # ... ingest data ...
    db.create_indexes()    # after bulk load for speed

    db.rebuild_schema()    # drop + recreate (no data)
```

### DataIngestor

Three-phase ingestion respecting FK dependencies. Supports upsert for incremental refreshes.

```python
from cdos import DatabaseManager, DataIngestor

with DatabaseManager() as db:
    db.create_schema()

    # Full pipeline
    DataIngestor(db).ingest_all("data/Business_Entities_in_Colorado_cleaned.csv")

    # Or staged
    ingestor = DataIngestor(db)
    (ingestor
        .load_csv("data/Business_Entities_in_Colorado_cleaned.csv", chunksize=50_000)
        .ingest_addresses()    # Phase 1: deduplicate and insert addresses
        .ingest_agents()       # Phase 2: deduplicate and insert agents (needs address IDs)
        .ingest_entities())    # Phase 3: insert entities (needs all FK IDs)

    db.create_indexes()
```

### CLI Ingestion

```bash
# Set connection
export CDOS_DATABASE_URL="postgresql://user:pass@localhost/cdos"

# Ingest
python scripts/ingest_to_postgres.py

# With options
python scripts/ingest_to_postgres.py --db "postgresql://..." --chunksize 100000

# Full rebuild (drops existing data)
python scripts/ingest_to_postgres.py --rebuild
```

## Entity Type Reference

| Code | Description |
|------|-------------|
| `DPC` | Domestic Profit Corporation |
| `FPC` | Foreign Profit Corporation |
| `DNC` | Domestic Nonprofit Corporation |
| `FNC` | Foreign Nonprofit Corporation |
| `DLLC` | Domestic Limited Liability Company |
| `FLLC` | Foreign Limited Liability Company |
| `DLP` | Domestic Limited Partnership |
| `FLP` | Foreign Limited Partnership |
| `DLLP` | Domestic Limited Liability Partnership |
| `FLLP` | Foreign Limited Liability Partnership |
| `DLLLP` | Domestic Limited Liability Limited Partnership |
| `FLLLP` | Foreign Limited Liability Limited Partnership |
| `DPC-PBC` | Domestic Public Benefit Corporation |
| `DLCA` | Domestic Limited Cooperative Association |
| `DLCA-PBC` | Domestic Limited Cooperative Association Public Benefit Corporation |
| `DLPA` | Domestic Limited Partnership Association |
| `DT` | Domestic Trust |
| `GP` | General Partnership |
| `IC` | Insurance Company |
| `WC` | Water Company |
| `CU` | Credit Union |
| `FCOOP` | Foreign Cooperative |
| `FO` | Foreign Other |
| `DC55` | Ditch Company (C.R.S. 7-42-101) |
| `DC56` | Ditch Company (C.R.S. 7-42-101) |
| `SL` | State Land Board |
| `CS` | Common-Law or Statutory |
| `SP` | Sole Proprietorship |
| `UNA` | Unincorporated Nonprofit Association |

## Entity Status Reference

**Active**: Good Standing, Exists

**Inactive**: Delinquent, Administratively Dissolved, Voluntarily Dissolved, Revoked, Withdrawn, Merged, Consolidated, Noncompliant, Converted, Dissolved (Term Expired), Registered Agent Resigned

## Column Reference

| Group | Columns |
|-------|---------|
| Entity Core | `entityid`, `entityname`, `entitystatus`, `entitytype`, `entityformdate`, `jurisdictonofformation` |
| Principal Address | `principaladdress1`, `principaladdress2`, `principalcity`, `principalstate`, `principalzipcode`, `principalcountry` |
| Mailing Address | `mailingaddress1`, `mailingaddress2`, `mailingcity`, `mailingstate`, `mailingzipcode`, `mailingcountry` |
| Agent Person | `agentfirstname`, `agentmiddlename`, `agentlastname`, `agentsuffix` |
| Agent Organization | `agentorganizationname` |
| Agent Principal Address | `agentprincipaladdress1`, `agentprincipaladdress2`, `agentprincipalcity`, `agentprincipalstate`, `agentprincipalzipcode`, `agentprincipalcountry` |
| Agent Mailing Address | `agentmailingaddress1`, `agentmailingaddress2`, `agentmailingcity`, `agentmailingstate`, `agentmailingzipcode`, `agentmailingcountry` |

**Note**: `jurisdictonofformation` is misspelled in the source data. The package preserves this spelling to match the CSV headers.

## Notes

- **Principal address** is not always the physical business location — some list PO boxes or out-of-state addresses
- **Mailing address fields** are ~86% empty; agent mailing address fields are ~94% empty
- **Agent** is either a person or an organization (rarely both); ~19% of entities have neither
- **~43% of entity names** contain embedded status+date suffixes that `DataCleaner.extract_clean_entity_name()` parses out
- The CSV is ~750MB; on memory-constrained systems, use `DataLoader.load_chunked()` or the `nrows` parameter
