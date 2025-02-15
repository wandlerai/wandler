# Contributing to Wandler

Thank you for your interest in contributing to Wandler! This document will guide you through our
development and release process.

## Testing

We use Jest for testing. Here's what you need to know:

### Running Tests

```bash
npm test               # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Writing Tests

Key points:

- Tests go in `tests/unit/` or `tests/browser/`
- Use relative imports in test files
- Use `@wandler/*` imports in source files
- Mock external dependencies in `tests/setup.ts`

Example test:

```typescript
// tests/unit/something.test.ts
import { Something } from "../../packages/wandler/utils/something";

// Mock external dependencies
jest.mock("@huggingface/transformers", () => ({
	// mock implementation
}));

describe("Something", () => {
	it("should work", () => {
		// test implementation
	});
});
```

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
"wandler": patch
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

## Imports

For source files:

- Use `@wandler/*` imports in source files (NOT `@wandler/wandler/*`)
- Never use relative imports (`../`, `./`) in source files
- Never use `index` files for exports/imports
- Always import from the specific file

Example for source files:

```ts
// Good
import { WorkerManager } from "@wandler/utils/worker-manager";
import type { BaseModel } from "@wandler/types/model";

// Bad
import { WorkerManager } from "./worker-manager";
import type { BaseModel } from "../types/model";
```

For test files:

- Use relative imports in test files
- Import from the full path (e.g., `../../packages/wandler/utils/something`)

Example for test files:

```ts
// Good
import { WorkerManager } from "../../packages/wandler/utils/worker-manager";
import type { BaseModel } from "../../packages/wandler/types/model";

// Bad
import { WorkerManager } from "@wandler/utils/worker-manager";
import type { BaseModel } from "@wandler/types/model";
```
