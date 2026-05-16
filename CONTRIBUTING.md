# Contributing to CyberKid

Thank you for your interest in contributing to CyberKid! This document outlines the process for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct (available upon request). Be respectful, inclusive, and constructive.

## Getting Started

1. **Fork the repository** (if you have access)
2. **Clone your fork**:
   ```bash
   git clone https://github.com/your-username/cyberkid-core.git
   cd cyberkid-core

Install dependencies:
bash

npm install

Run development server:
bash

npm run dev

Development Workflow
Branch Naming

    feature/xxx – new features

    fix/xxx – bug fixes

    docs/xxx – documentation updates

    test/xxx – test additions or modifications

Commit Messages

Follow Conventional Commits:
text

feat: add new command FOR_N
fix: correct pathfinder teleport logic
docs: update README with installation guide
test: add tests for ExplorationMode

Pull Request Process

    Ensure your code passes all tests:
    bash

npm test

    Update documentation if needed.

    Create a PR against the main branch.

    Wait for review. All PRs require at least one approval.

Coding Standards
TypeScript

    Use strict mode (no any unless absolutely necessary)

    Export types/interfaces when they are used outside the module

    Use enum for fixed sets of values (Command, TileType, etc.)

    Prefer interface over type for object shapes

Phaser

    Never access Phaser's global game instance directly; use this.scene or injected references

    Use this.add, this.load, this.tweens, etc. within scenes

    Clean up event listeners in shutdown or destroy methods

EventBus

    All inter-module communication must go through EventBus

    Define new event types in src/types/index.ts (GameEvent union)

    Use eventBus.emit() and eventBus.on() with typed payloads

Managers

    All managers must be singletons (getInstance())

    Persist data using localStorage (or IndexedDB for larger datasets)

    Emit events when state changes

Testing

    Write unit tests for all public methods

    Mock external dependencies (localStorage, EventBus, Phaser)

    Aim for >70% coverage
# Contributing to CyberKid

Thank you for your interest in contributing to CyberKid! This document outlines the process for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct (available upon request). Be respectful, inclusive, and constructive.

## Getting Started

1. **Fork the repository** (if you have access)
2. **Clone your fork**:
   ```bash
   git clone https://github.com/your-username/cyberkid-core.git
   cd cyberkid-core

Install dependencies:
bash

npm install

Run development server:
bash

npm run dev

Development Workflow
Branch Naming

    feature/xxx – new features

    fix/xxx – bug fixes

    docs/xxx – documentation updates

    test/xxx – test additions or modifications

Commit Messages

Follow Conventional Commits:
text

feat: add new command FOR_N
fix: correct pathfinder teleport logic
docs: update README with installation guide
test: add tests for ExplorationMode

Pull Request Process

    Ensure your code passes all tests:
    bash

npm test

    Update documentation if needed.

    Create a PR against the main branch.

    Wait for review. All PRs require at least one approval.

Coding Standards
TypeScript

    Use strict mode (no any unless absolutely necessary)

    Export types/interfaces when they are used outside the module

    Use enum for fixed sets of values (Command, TileType, etc.)

    Prefer interface over type for object shapes

Phaser

    Never access Phaser's global game instance directly; use this.scene or injected references

    Use this.add, this.load, this.tweens, etc. within scenes

    Clean up event listeners in shutdown or destroy methods

EventBus

    All inter-module communication must go through EventBus

    Define new event types in src/types/index.ts (GameEvent union)

    Use eventBus.emit() and eventBus.on() with typed payloads

Managers

    All managers must be singletons (getInstance())

    Persist data using localStorage (or IndexedDB for larger datasets)

    Emit events when state changes

Testing

    Write unit tests for all public methods

    Mock external dependencies (localStorage, EventBus, Phaser)

    Aim for >70% coverage

Reporting Issues

Use GitHub Issues (if repository is public) or contact directly at schkyola@gmail.com.
License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0 license (with commercial licensing exceptions as defined by the project).
Reporting Issues

Use GitHub Issues (if repository is public) or contact directly at schkyola@gmail.com.
License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0 license (with commercial licensing exceptions as defined by the project).
