import subprocess
import os

def run(cmd):
    return subprocess.check_output(cmd, shell=True, text=True).strip()

# 1. Get User Changed Files
# We use the raw log output from the other repo
log_output = run('git --git-dir=../../.git --work-tree=../.. log 123c2dc..HEAD --name-only')
user_files = set()
for line in log_output.split('\n'):
    line = line.strip()
    if line.startswith('Desktop/paper emr/'):
        user_files.add(line.replace('Desktop/paper emr/', ''))

print(f"User changed {len(user_files)} files")

# 2. Get Git Status
status_output = run('git status --porcelain')
modified_files = set()
deleted_files = []

for line in status_output.split('\n'):
    if not line: continue
    status = line[:2]
    path = line[3:]
    if status.strip() == 'M':
        modified_files.add(path)
    elif status.strip() == 'D':
        deleted_files.append(path)

print(f"Found {len(modified_files)} modified files (differ from remote)")
print(f"Found {len(deleted_files)} deleted files (missing remote files)")

# 3. Restore Missing Remote Files (D)
# These are files on remote that are missing locally. User didn't delete them (presumably), their old copy just lacked them.
# UNLESS user EXPLICITLY deleted them in their commits.
# Check if any deleted file is in user_files.
deleted_by_user = [f for f in deleted_files if f in user_files]
missing_from_remote = [f for f in deleted_files if f not in user_files]

print(f"Restoring {len(missing_from_remote)} missing remote files...")
if missing_from_remote:
    # Do in chunks
    chunk_size = 50
    for i in range(0, len(missing_from_remote), chunk_size):
        chunk = missing_from_remote[i:i+chunk_size]
        subprocess.run(['git', 'checkout', '--'] + chunk)

# For deleted_by_user: We leave them deleted (status D). Standard commit will record deletion.

# 4. Handle Modified Files
conflicts = modified_files.intersection(user_files)
safe_to_update = modified_files - user_files

print(f"Updating {len(safe_to_update)} safe files to remote version...")
if safe_to_update:
    files_list = list(safe_to_update)
    chunk_size = 50
    for i in range(0, len(files_list), chunk_size):
        chunk = files_list[i:i+chunk_size]
        subprocess.run(['git', 'checkout', '--'] + chunk)

print(f"\n--- CONFLICTS ({len(conflicts)}) ---")
# These are files user modified AND remote modified (or user modified from old base).
# We need to manually inspect/merge these.
for f in conflicts:
    print(f)

