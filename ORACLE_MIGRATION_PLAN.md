# Oracle Cloud Infrastructure (OCI) Migration Strategy for PageMD

**Reference Plan for Future Migration**

Based on your move toward a high-density, multi-clinic EMR for PageMD, switching to Oracle Cloud Infrastructure (OCI) is a savvy architectural move. Since you are already using PostgreSQL (via Docker and the pg client), the transition is actually smoother than you might think.

## Why Oracle is the Better Option for You

Oracle is often overlooked by startups, but for a data-heavy EMR, it offers "Enterprise" specs at "Startup" prices.

1.  **The RAM Advantage:** As you noticed, AWS Free Tier gives you 1GB. Oracle’s "Always Free" ARM instances give you 24GB. For a PostgreSQL database serving multiple clinics, 24GB of RAM is the difference between a system that crashes under load and one that stays snappy.
2.  **PostgreSQL Compatibility:** You do not need to switch to Oracle’s proprietary database. OCI has a first-class managed service called OCI Database with PostgreSQL. It is significantly cheaper than AWS RDS (often 40-50% less) and offers better performance for high-concurrency workloads.
3.  **Predictable Scaling:** Oracle’s "Flexible Shapes" allow you to add 1GB of RAM or 1 OCPU at a time. AWS usually forces you to double your instance size (and price) just to get a little more memory.

## The HIPAA Strategy on Oracle (2026 Rules)

To legally host PageMD on Oracle, you must follow this specific compliance path:

| Phase | Account Type | HIPAA Status | Action |
| :--- | :--- | :--- | :--- |
| **Development** | Always Free | Not Compliant | Use dummy data only. Build your multi-tenant logic here. |
| **Production** | Pay-As-You-Go | Compliant | Upgrade (still $0 if under limits). Sign the BAA in the console. |

### 1. The BAA (Business Associate Agreement)
Oracle will sign a BAA with you, but typically only once you upgrade to a "Pay As You Go" account. You can stay within the free limits and pay $0, but the upgrade "verifies" your identity, which is a legal prerequisite for the BAA.

### 2. Multi-Tenancy via "Compartments"
For hosting many clinics, use OCI Compartments. This is a feature AWS doesn't have an equivalent for at this price point. You can create a "Clinic-A" compartment and a "Clinic-B" compartment. This ensures:
*   **Isolation:** Policies can prevent a user in Clinic A from ever seeing Clinic B's resources.
*   **Auditing:** HIPAA auditors love compartments because you can show exactly where each clinic's data lives and who has access.

### 3. New 2026 Security Requirements
Under the updated 2026 HIPAA guidelines, "Addressable" safeguards are now Mandatory. Oracle makes this easy:
*   **Encryption at Rest:** Enabled by default on all OCI Block Volumes.
*   **MFA:** Mandatory for all administrative access (Identity Domains).
*   **Vault:** Use OCI Vault (KMS) to manage the encryption keys for your Postgres database.

## Technical Recommendation

1.  **Don't rewrite a single line of code yet.**
2.  **Spin up an OCI "Ampere" instance** (the 4 OCPU / 24GB RAM model).
3.  **Install Docker** and move your current `docker-compose` setup there. It will run faster and more reliably than it ever did on Lightsail or EC2 Free Tier.
4.  **Upgrade to Pay-As-You-Go immediately.** It costs nothing if you stay in the free resources, but it starts the "clock" on your professional relationship with Oracle so you can sign that BAA.

## Detailed Migration Roadmap

Since Amazon Lightsail is not on the official AWS HIPAA-eligible list, migrating is the right move for PageMD to ensure legal compliance as you move toward production with cardiology clinics.

Transitioning from a limited 1GB Lightsail instance to the 24GB RAM available in Oracle’s free tier will not only solve your compliance issues but also provide the overhead needed for a cardiology-focused EMR.

### Phase 1: The "Safe Harbor" (Setup in OCI)
Before moving any data, you must build the "container" that meets the 2026 HIPAA technical requirements.

1.  **Sign up for OCI Always Free:** This gives you the Ampere A1 Compute (4 OCPUs, 24GB RAM).
2.  **Upgrade to "Pay-As-You-Go":** You must do this to sign the Business Associate Agreement (BAA). You will still keep your free resources and pay $0 as long as you stay within the "Always Free" limits.
3.  **Accept the BAA:** In the OCI Console, navigate to **Governance & Administration > Compliance > Agreements**. Select the **HIPAA BAA** and click **Accept**.
4.  **Create Compartments:** Instead of putting everything in one place, create a `PageMD_Production` compartment. This isolates the patient data from your development experiments.

### Phase 2: Data Migration (PostgreSQL)
Since you are using PostgreSQL 15 in Docker, we will perform a "Lift and Shift" migration.

1.  **Export from Lightsail:** Run this command on your current server to create a compressed backup of your database:
    ```bash
    docker exec -t <postgres_container_name> pg_dump -U <username> -d <db_name> -F c -f /tmp/pagemd_backup.dump
    ```

2.  **Transfer the File:** Use `scp` or a secure transfer to move `pagemd_backup.dump` from Lightsail to your new OCI instance.

3.  **Restore in OCI:** On your new OCI instance, launch your Docker container and restore the data:
    ```bash
    docker exec -i <new_postgres_container> pg_restore -U <username> -d <db_name> -v /tmp/pagemd_backup.dump
    ```

### Phase 3: 2026 HIPAA Hardening
In 2026, HIPAA safeguards are no longer "optional." You must prove they are active.

1.  **Encryption at Rest:** Ensure the OCI Block Volume where your Postgres data lives has "Encryption using Oracle-managed Keys" or "Vault-managed Keys" enabled.
2.  **MFA Everywhere:** Enable Multi-Factor Authentication for the OCI Console and your SSH access.
3.  **Audit Logging:** Enable OCI Logging for your compartment to track who accesses the server.

## Required Agent Skills for Implementation

When implementing this plan, the following skills **MUST** be proactively used for a smooth and secure transition:

*   **`docker-expert`**: Mandatory for all container exports, imports, and multi-architecture (ARM/Ampere) build optimizations.
*   **`deployment-procedures`**: Mandatory for managing the migration sequence, creating rollback strategies, and performing health-check verifications.
*   **`api-security-best-practices`**: Mandatory for Phase 3 (HIPAA Hardening) to verify OCI security rules, encryption vault configurations, and MFA enforcement.
*   **`bash-linux`**: Mandatory for executing precise terminal commands on both source and target servers, and for creating automated backup/maintenance scripts.
