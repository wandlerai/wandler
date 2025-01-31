# Contributing to Wandler

Thank you for your interest in contributing to Wandler! This document will guide you through our
release process.

## Release Process

We use [changesets](https://github.com/changesets/changesets) to manage our versioning and package
releases. This helps us maintain a clear history of changes and automate our release process.

### Manual Release Process

1. **Make your changes**

   - Write your code
   - Add/update tests
   - Update documentation

2. **Create a changeset**

   ```bash
   npm run changeset
   ```

   This will:

   - Ask which packages you've changed
   - Ask what type of version change it is (major/minor/patch)
   - Ask for a description of the changes

3. **Version packages**

   ```bash
   npm run version
   ```

   This command:

   - Updates package versions based on changesets
   - Updates changelogs
   - Creates a commit with these changes

4. **Publish packages**
   ```bash
   npm run release
   ```
   This command:
   - Builds all packages
   - Publishes packages to npm
   - Creates git tags

### Automated Release Process

We have GitHub Actions set up to automate parts of this process:

1. **Create a PR with changes**

   - Make your changes in a feature branch
   - Add a changeset using `npm run changeset`
   - Push your changes

2. **Let CI handle the release** Our GitHub Actions workflow will:
   - Run tests and type checks
   - Create a release PR when changesets are present
   - Publish to npm when merged to main

The workflow files are:

- `.github/workflows/ci.yml` - Runs tests and type checks
- `.github/workflows/release.yml` - Handles the release process

### Version Bump Types

- `patch` (0.0.x) - Bug fixes and minor changes
- `minor` (0.x.0) - New features (non-breaking)
- `major` (x.0.0) - Breaking changes

### Example Changeset

```markdown
---
"@wandler/core": patch
"@wandler/react": patch
---

Added new Wandler logo and updated READMEs to use it.
```

### Tips

- Always create a changeset for user-facing changes
- Let the GitHub Actions handle the actual publishing
- Monitor the release PR for any conflicts or issues

## Development Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add a changeset
5. Create a pull request

## Questions?

If you have any questions about the release process, please open an issue or ask in our discussions.
