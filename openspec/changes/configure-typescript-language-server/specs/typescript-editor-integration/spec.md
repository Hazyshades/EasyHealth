## ADDED Requirements

### Requirement: Editor discovers every maintained TypeScript project
The repository SHALL commit editor workspace configuration that identifies the root application TypeScript project and the document worker TypeScript project without requiring a contributor to create local configuration files.

#### Scenario: Fresh VS Code checkout opens the repository
- **WHEN** a contributor opens a clean checkout in VS Code
- **THEN** the editor receives recommendations for TypeScript tooling
- **AND** diagnostics are available for both `tsconfig.json` and `worker/tsconfig.json`

### Requirement: Project configuration is independently verifiable
The repository SHALL expose one documented command that validates the existence and TypeScript compilation of the root application and document worker projects without emitting build artifacts.

#### Scenario: A project configuration is missing or invalid
- **WHEN** the verification command runs with a missing project file or a TypeScript error in either project
- **THEN** the command SHALL exit non-zero
- **AND** its output SHALL identify the failing project

### Requirement: Editor-independent fallback is documented
The repository SHALL document the TypeScript verification command as the fallback for editors or automated environments that do not run a language server.

#### Scenario: Contributor uses a non-VS-Code editor
- **WHEN** the editor does not consume VS Code workspace recommendations
- **THEN** the contributor can run the documented command to obtain equivalent compiler diagnostics.