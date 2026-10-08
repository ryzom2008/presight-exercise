#!/usr/bin/env bash
# Run once in Azure Cloud Shell (Bash), as an account allowed to assign roles.
# Creates only a deployment identity, its federation, and scoped role assignments.
set -euo pipefail

subscription=dc3ee9d3-a317-4b8f-9056-959e9f93911a
resource_group=presight-demo-rg
vm_name=presight-demo-vm
registry=presightdemo
identity_name=presight-github
az account set --subscription "$subscription"

az identity create --resource-group "$resource_group" --name "$identity_name" \
  --location southeastasia --output none
identity_id=$(az identity show -g "$resource_group" -n "$identity_name" --query principalId -o tsv)
client_id=$(az identity show -g "$resource_group" -n "$identity_name" --query clientId -o tsv)
az identity federated-credential create \
  --resource-group "$resource_group" --identity-name "$identity_name" \
  --name github-azure-demo --issuer https://token.actions.githubusercontent.com \
  --subject 'repo:ryzom2008@24992981/presight-exercise@1385960439:environment:azure-demo' \
  --audiences api://AzureADTokenExchange --output none

vm_id=$(az vm show -g "$resource_group" -n "$vm_name" --query id -o tsv)
az vm identity assign -g "$resource_group" -n "$vm_name" -o none
# Read from the VM resource: identity-assign output varies between CLI versions.
vm_identity=$(az vm show -g "$resource_group" -n "$vm_name" --query identity.principalId -o tsv)
registry_id=$(az acr show -n "$registry" --query id -o tsv)
mode=$(az acr show -n "$registry" --query roleAssignmentMode -o tsv)
if [ "$mode" = AbacRepositoryPermissions ]; then
  pull_role='Container Registry Repository Reader'
  push_role='Container Registry Repository Writer'
else
  pull_role=AcrPull
  push_role=AcrPush
fi

az role assignment create --assignee-object-id "$identity_id" \
  --assignee-principal-type ServicePrincipal --role "$push_role" --scope "$registry_id" -o none
az role assignment create --assignee-object-id "$identity_id" \
  --assignee-principal-type ServicePrincipal --role 'Virtual Machine Contributor' --scope "$vm_id" -o none
az role assignment create --assignee-object-id "$vm_identity" \
  --assignee-principal-type ServicePrincipal --role "$pull_role" --scope "$registry_id" -o none

printf '\nAdd these GitHub environment secrets under azure-demo:\n'
printf 'AZURE_CLIENT_ID=%s\n' "$client_id"
printf 'AZURE_TENANT_ID=%s\n' '3af28441-f30b-48cc-848c-4ba8f03cd5e8'
printf 'AZURE_SUBSCRIPTION_ID=%s\n' "$subscription"
