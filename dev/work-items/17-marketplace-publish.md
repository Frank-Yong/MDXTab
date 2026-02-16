# Work Item: Marketplace publish

## Status
- State: TODO

## Description
Prepare the VS Code extension for Marketplace publication with branding and listing metadata.

## Sub-items
- Create publisher account and verify settings.
- Produce logo/icon assets and screenshots.
- Refine README/metadata for Marketplace listing.
- Validate packaging and publish flow with vsce.

## Publisher checklist
- Publisher profile: publisher ID (slug), display name, contact email, and website.
- Ownership: confirm the account is tied to your Azure DevOps org and visible at https://marketplace.visualstudio.com/manage.
- Access token: create a PAT with Marketplace > Publish scope (Azure DevOps), and confirm `vsce login <publisher>` works.
- Extension identifiers: `publisher` in package.json matches your publisher ID.
- Listing basics: ensure icon, README, license, repository URL, and categories are set.
