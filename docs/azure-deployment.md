# Azure demo deployment

This setup targets the existing Ubuntu x64 VM (1 vCPU, 2 GiB), using its persistent
OS disk. No separate data disk or Azure Web App is needed.

| Setting           | Value                                                       |
| ----------------- | ----------------------------------------------------------- |
| Repository        | `ryzom2008/presight-exercise`                               |
| Deployment branch | `develop`                                                   |
| Resource group    | `presight-demo-rg`                                          |
| VM                | `presight-demo-vm`                                          |
| Registry          | `presightdemo.azurecr.io`                                   |
| Region            | `southeastasia`                                             |
| Website           | https://presight-demo-2008.southeastasia.cloudapp.azure.com |

## What the workflow does

`.github/workflows/azure-demo.yml` has four jobs:

1. **validate**: install locked dependencies, typecheck, run server/client tests.
2. **build**: build the Linux AMD64 production image, check health, frontend and
   database search, then recreate a container to verify SQLite persistence.
3. **publish**: upload the exact tested image to ACR, tagged with the Git commit.
4. **deploy**: install Docker/Compose and Azure CLI on the VM if needed, pull the
   image by digest, back up existing SQLite data, start the app and Caddy, and
   verify the public HTTPS URL.

Pull requests into `develop` and pushes to `develop` run the first two jobs.
Publishing and deployment run only through **Run workflow**, with `develop`
selected. This keeps the first deployment manual. The workflow serializes runs
for each branch and never cancels an ongoing deployment.

The VM does not compile the application. Express serves the built frontend and
API; Caddy forwards HTTPS requests to Express and obtains/renews its certificate.
Only Caddy exposes public ports. The app's port 3001 is internal to Docker.

## 1. Check the Azure resources

- The VM must be running, with its Azure VM agent healthy and outbound HTTPS
  access for package downloads, ACR and certificate issuance.
- Its public DNS name must resolve to its public IP.
- Allow inbound TCP 80 and 443 in the network security group (and any OS firewall).
- Keep SSH 22 restricted to your IP. The workflow uses Azure Run Command, not SSH.
- The registry must allow access from GitHub-hosted runners and the VM.

## 2. Create the GitHub deployment identity

The VM identity pulls images. A **separate** user-assigned identity authenticates
GitHub Actions using OIDC; no Azure password, client secret, or SSH key is stored
in GitHub.

Open Azure Cloud Shell, choose **Bash**, and upload the local file
`docker/azure/setup-identity.sh` using Cloud Shell's upload control. Run:

```bash
bash setup-identity.sh
```

Review the script before running it. It creates `presight-github` in the existing
resource group, configures federation for
`repo:ryzom2008@24992981/presight-exercise@1385960439:environment:azure-demo`, enables the VM identity,
and assigns these roles:

| Identity        | Scope         | Permission                                          |
| --------------- | ------------- | --------------------------------------------------- |
| GitHub identity | This registry | Repository Writer (or AcrPush for legacy RBAC mode) |
| GitHub identity | This VM only  | Virtual Machine Contributor                         |
| VM identity     | This registry | Repository Reader (or AcrPull for legacy RBAC mode) |

Virtual Machine Contributor allows VM administration, including root commands
through Run Command; it is scoped to this demo VM. The user running setup needs
permission to create identities and role assignments at these scopes, such as
Owner on this resource group. Role assignments can take a few minutes to propagate.

The script prints three values for the next step. It does not deploy the app,
create compute resources, or modify the database.

## 3. Configure GitHub

In the repository, open **Settings → Environments → New environment**, and create
`azure-demo`. Restrict its deployment branches to **Selected branches and tags →
develop**. This matters because the Azure trust is tied to this environment.

Add the values printed by the setup script as **environment secrets**:

- `AZURE_CLIENT_ID`: client ID of `presight-github`, not the VM's identity.
- `AZURE_TENANT_ID`: `3af28441-f30b-48cc-848c-4ba8f03cd5e8`.
- `AZURE_SUBSCRIPTION_ID`: `dc3ee9d3-a317-4b8f-9056-959e9f93911a`.

These IDs identify the account; OIDC provides authentication. Do not create an
ACR admin password or upload your private SSH key.

## 4. Run the first deployment

Commit and push the deployment files, and merge them into `develop`.
GitHub also requires the workflow file to exist on the repository's **default
branch** for the **Run workflow** button to appear. If the default branch differs
from `develop`, include the workflow there too, or intentionally change the default
branch in repository settings. Always select `develop` when running this deployment.

Open **Actions → Azure demo → Run workflow → develop**.
The first run installs VM dependencies and seeds 10,000 users. Subsequent runs
preserve existing data. The public URL is ready only after all four jobs succeed.

## Persistence, backups and recovery

Deployment files are stored at `/opt/presight/releases/<commit>`;
`/opt/presight/current` points to the last deployment that passed the VM HTTPS check.
The previous successful release path is recorded in `/opt/presight/previous-release`.

The fixed `presight-demo_directory-data` Docker volume holds SQLite on the OS disk,
including the WAL files. It survives container replacement, deployment directory
changes, VM restarts and deallocation. This is a new deployment volume; it does not
import data from a local Docker Desktop volume.

Before changing a running deployment, the script uses SQLite's online backup API
to save a consistent snapshot under `/opt/presight/backups`. Backups remain on the
same VM disk, so they protect against deployment mistakes, not disk deletion.
Download a backup before deleting the VM's OS disk if you want to keep the data.

Startup runs the existing schema migrations and preserves seeded data. A failed
deployment fails the workflow and prints logs. It does **not** automatically roll
back the database: future schema changes may make older application code incompatible.
For a code-only rollback with compatible schema, rerun `deploy.sh` in the previous
release directory as root. A database restore requires stopping the app, restoring
the chosen backup, clearing obsolete WAL/SHM files, and starting compatible code.
Do not restore a database while the app is running.

Never run `docker compose down -v` against this project: it deletes the database
and certificate volumes. App logs rotate (three 10 MB files per container); backups
and older images are retained for this short demo and need a retention policy for
longer use.

## Troubleshooting

Connect over SSH, then inspect the containers without changing their data:

```bash
cd /opt/presight/current
sudo docker compose --env-file .env -f compose.yml ps
sudo docker compose --env-file .env -f compose.yml logs --tail 100 app proxy
df -h
free -h
```

If the **first** deployment failed, `current` may not exist. Use the release
directory named with that workflow's commit SHA instead. Run Command output is
limited to its last 4 KB; full container logs remain on the VM.

- **Azure login fails**: verify the three environment secrets, federated subject
  and `develop` environment restriction. For `AADSTS700213`, compare the exact
  `subject claim` printed by `azure/login` with the Azure federated credential.
  This repository's token includes owner and repository IDs (`@24992981` and
  `@1385960439`); the subject without those IDs does not match. If you ran the
  earlier setup script, update the existing credential in Azure Cloud Shell:

  ```bash
  az identity federated-credential update \
    --subscription dc3ee9d3-a317-4b8f-9056-959e9f93911a \
    --resource-group presight-demo-rg \
    --identity-name presight-github \
    --name github-azure-demo \
    --issuer https://token.actions.githubusercontent.com \
    --audiences api://AzureADTokenExchange \
    --subject 'repo:ryzom2008@24992981/presight-exercise@1385960439:environment:azure-demo'
  ```

  Wait a few minutes for propagation, then rerun the failed jobs. Updating this
  credential does not change the client ID or require new GitHub secrets.

- **Image pull/push denied**: verify registry permissions mode and corresponding
  Reader/Writer or AcrPull/AcrPush roles; allow time for role propagation.
- **Run Command denied**: verify the GitHub identity's VM-scoped role.
- **Certificate/site unavailable**: check public DNS, inbound 80/443, Caddy logs,
  and that no other service occupies those ports.
- **Deployment failed after migrations**: inspect app logs and the pre-deployment
  backup before attempting recovery.

After the two-day demo, deallocate the VM to stop compute charges. Disks, the
public IP and registry can continue to cost money. Delete the dedicated resource
group only when you no longer need any of its resources or stored data.

## References

- [GitHub OIDC with Azure](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-azure)
- [ACR managed identity authentication](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-authentication-managed-identity)
- [Azure Run Command](https://learn.microsoft.com/en-us/azure/virtual-machines/run-command-overview)
- [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)
