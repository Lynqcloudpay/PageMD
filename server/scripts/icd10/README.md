# ICD-10 Importer

This script imports ICD-10-CM codes into the `icd10_codes` table. It supports the official CMS fixed-width order files and custom CSV formats.

## Table of Contents
- [Usage](#usage)
- [File Formats](#file-formats)
  - [CMS Fixed-Width](#cms-fixed-width-cms)
  - [CSV](#csv)
- [Data Sources](#data-sources)

## Usage

```bash
# General usage
node scripts/icd10/import.js --file <path_to_file> --format <csv|cms> [options]

# Import official CMS order file
node scripts/icd10/import.js --file ./icd10cm_order_2024.txt --format cms

# Import CSV file with deactivation of missing codes (for annual updates)
node scripts/icd10/import.js --file ./icd10_update.csv --format csv --deactivate-missing

# Full help
node scripts/icd10/import.js --help
```

### Options
- `--file, -f`: (Required) Path to the source file.
- `--format, -m`: (Required) Format of the source file (`csv` or `cms`).
- `--deactivate-missing`: Mark any codes in the database NOT in the current file as `is_active = false`. Useful for annual cleanup.
- `--year`: Specify effective year for logging/internal use.

## File Formats

### CMS Fixed-Width (cms)
Matches the official CMS ICD-10-CM "Order File" format:
- Position 7-13: ICD-10 Code (automatically formatted with dot)
- Position 15: Billable flag (0=No, 1=Yes)
- Position 78+: Long Description

### CSV
Expects a headerless or header-compatible comma-separated file with these columns:
1. `code`: e.g., "A00.0" or "A000"
2. `description`: Full text description
3. `is_billable`: `true`/`false` or `1`/`0` (optional)
4. `effective_date`: YYYY-MM-DD (optional)
5. `termination_date`: YYYY-MM-DD (optional)

## Data Sources
Official ICD-10-CM release files can be downloaded from:
- [CMS.gov ICD-10 Resources](https://www.cms.gov/medicare/coding-billing/icd-10-codes)
- [CDC.gov ICD-10-CM](https://www.cdc.gov/nchs/icd/icd10cm.htm)

Look for the "Order File" or "Code Descriptions" zip packages.
