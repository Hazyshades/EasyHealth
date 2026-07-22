# EasyHealth GitHub Issues Import v4

This version fixes Windows PowerShell 5.1 parsing of a top-level JSON array.
The previous script could treat all 61 records as one nested Object[] and then
report that the `id` property was missing.

## Run

```powershell
gh auth refresh -h github.com -s project
Set-ExecutionPolicy -Scope Process Bypass
.\Import-EasyHealth-Roadmap.ps1
```

Targets:

- Repository: `Hazyshades/EasyHealth`
- Project: `Hazyshades` Project #1

The script validates all records before making changes and skips any issue whose GitHub `number` already exists on the repo; it derives the roadmap ID (e.g. `EH-101`) from the title prefix `[EH-101] …` solely to detect duplicate roadmap IDs.
